import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { sendError } from "../utils/api-response.js";

export function notFoundHandler(req, res) {
  return sendError(
    res,
    `Route not found: ${req.method} ${req.originalUrl.split("?")[0]}`,
    404,
    null,
    "not_found"
  );
}

const DATABASE_UNAVAILABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

const DATABASE_UNAVAILABLE_MESSAGE =
  "The database is temporarily unavailable. Please try again in a moment.";

/**
 * Turns known technical errors into a status, a safe message and a code.
 * Returns null when the error is not one we recognise.
 */
function classifyError(error) {
  // Invalid JSON or an oversized body (thrown by express.json).
  if (error.type === "entity.parse.failed") {
    return { status: 400, message: "The request body is not valid JSON.", code: "invalid_json" };
  }

  if (error.type === "entity.too.large") {
    return { status: 413, message: "The request body is too large.", code: "payload_too_large" };
  }

  // Prisma errors, recognised by name so this file never imports Prisma.
  if (error.name === "PrismaClientKnownRequestError") {
    if (error.code === "P2002") {
      return { status: 409, message: "This item already exists.", code: "conflict" };
    }

    if (error.code === "P2025") {
      return { status: 404, message: "The requested item was not found.", code: "not_found" };
    }

    if (error.code === "P2023") {
      return { status: 400, message: "The request contains an invalid identifier.", code: "invalid_id" };
    }

    if (DATABASE_UNAVAILABLE_CODES.has(error.code)) {
      return { status: 503, message: DATABASE_UNAVAILABLE_MESSAGE, code: "database_unavailable" };
    }
  }

  if (error.name === "PrismaClientInitializationError") {
    return { status: 503, message: DATABASE_UNAVAILABLE_MESSAGE, code: "database_unavailable" };
  }

  if (
    error.name === "PrismaClientUnknownRequestError" &&
    /server selection timeout|timed out|connection/i.test(error.message || "")
  ) {
    return { status: 503, message: DATABASE_UNAVAILABLE_MESSAGE, code: "database_unavailable" };
  }

  return null;
}

export function errorHandler(error, req, res, next) {
  // The response already started (for example an SSE stream). Let Express close it.
  if (res.headersSent) {
    return next(error);
  }

  const known = classifyError(error);

  const libraryStatus = error.statusCode ?? error.status;
  const hasStatus =
    Number.isInteger(libraryStatus) && libraryStatus >= 400 && libraryStatus <= 599;

  const status = known?.status ?? (hasStatus ? libraryStatus : 500);
  const code = known?.code ?? error.code;

  // Messages of 4xx errors are written for users. 5xx messages stay private in production.
  // AiError messages are written for users, so they are shown even for 5xx.
  const exposeMessage = status < 500 || !env.isProduction || error.expose === true;

  const message =
    known?.message ??
    (exposeMessage && error.message
      ? error.message
      : "Something went wrong on the server. Please try again later.");

  // AiError is already logged by the AI layer, so it is not logged twice.
  if (status >= 500 && !error.expose) {
    logger.error("unhandled_error", {
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status,
      error,
    });
  }

  // Tell the browser how long to wait: the AI provider's own Retry-After when
  // known, otherwise 5 seconds for a temporary 503.
  if (Number.isFinite(error.retryAfterSeconds)) {
    res.setHeader("Retry-After", String(Math.ceil(error.retryAfterSeconds)));
  } else if (status === 503) {
    res.setHeader("Retry-After", "5");
  }

  return sendError(
    res,
    message,
    status,
    error.details ?? null,
    typeof code === "string" ? code : undefined
  );
}