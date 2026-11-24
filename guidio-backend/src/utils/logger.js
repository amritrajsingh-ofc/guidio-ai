import { env } from "../config/env.js";

/*
 * Small structured logger (no extra dependency).
 *  - Production: one JSON object per line (easy to search in Render logs).
 *  - Development: readable single lines.
 *
 * Personal data and secrets are removed in two ways:
 *  1. Keys: any field whose NAME looks sensitive (token, email, name, prompt...)
 *     is replaced by "[REDACTED]".
 *  2. Text: emails, JWTs, Bearer tokens, API keys and MongoDB connection
 *     strings inside any string (for example an error message) are masked.
 *
 * Never put chat messages, prompts, answers or profile text in log fields.
 * The logger can never throw: a logging problem must not crash the server.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const threshold =
  LEVELS[env.logLevel] ?? (env.isProduction ? LEVELS.info : LEVELS.debug);

// `token(?!s)` hides "accessToken" but keeps counters such as "maxOutputTokens".
const SENSITIVE_KEY =
  /authorization|token(?!s)|secret|password|passcode|cookie|api[-_]?key|email|database_?url|connection|first_?name|last_?name|full_?name|phone|content|prompt|answer|body|resume/i;

// Order matters: connection strings and Bearer tokens first, emails last.
const SCRUBBERS = [
  [/mongodb(\+srv)?:\/\/[^\s"']+/gi, "mongodb://[REDACTED]"],
  [/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]"],
  [/\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, "[REDACTED_JWT]"],
  [/\b(?:sk|pk)_(?:test|live)_[A-Za-z0-9]+/g, "[REDACTED_KEY]"],
  [/\bAIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_KEY]"],
  [/\bgsk_[A-Za-z0-9]{10,}/g, "[REDACTED_KEY]"],
  [/([?&](?:key|api_?key|token|access_token)=)[^&\s"']+/gi, "$1[REDACTED]"],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]"],
];

/** Masks secrets in text. The length cap keeps the patterns fast on huge strings. */
function scrub(text, maxLength = 1000) {
  let output = String(text ?? "").slice(0, maxLength);

  for (const [pattern, replacement] of SCRUBBERS) {
    output = output.replace(pattern, replacement);
  }

  return output;
}

/**
 * Prisma error messages start with the failed query, including the data that
 * was sent (names, emails...). Only the last line is the actual reason.
 */
function safeErrorMessage(error) {
  const message = String(error.message ?? "");

  if (typeof error.name === "string" && error.name.startsWith("PrismaClient")) {
    const lastLine = message.trim().split("\n").filter(Boolean).pop() ?? "";
    return scrub(lastLine, 300);
  }

  return scrub(message, 500);
}

function serializeError(error) {
  return {
    name: error.name,
    message: safeErrorMessage(error),
    code: error.code,
    status: error.statusCode ?? error.status,
    ...(env.isProduction || !error.stack ? {} : { stack: scrub(error.stack, 4000) }),
  };
}

function redact(value, depth = 0) {
  if (value instanceof Error) return serializeError(value);
  if (typeof value === "string") return scrub(value);
  if (typeof value === "bigint") return value.toString();
  if (value === null || typeof value !== "object") return value;
  if (depth > 3) return "[Truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redact(item, depth + 1));
  }

  const output = {};

  for (const [key, item] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(item, depth + 1);
  }

  return output;
}

function write(level, message, meta) {
  if (LEVELS[level] < threshold) return;

  try {
    const time = new Date().toISOString();
    const safeMessage = scrub(message, 300);
    const safeMeta = meta ? redact(meta) : {};

    const line = env.isProduction
      ? JSON.stringify({ ...safeMeta, level, time, msg: safeMessage })
      : `${time} ${level.toUpperCase().padEnd(5)} ${safeMessage}${
          Object.keys(safeMeta).length ? ` ${JSON.stringify(safeMeta)}` : ""
        }`;

    if (level === "error" || level === "warn") {
      console.error(line);
    } else {
      console.log(line);
    }
  } catch {
    // Last resort: say that logging failed, without printing the original data.
    try {
      console.error(
        JSON.stringify({ level: "error", time: new Date().toISOString(), msg: "logger_failed" })
      );
    } catch {
      // Nothing more can be done.
    }
  }
}

export const logger = {
  debug: (message, meta) => write("debug", message, meta),
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta),
};

/** Express middleware: one log line per request (no query strings, no headers, no body). */
export function requestLogger(req, res, next) {
  if (req.path === "/api/health") return next();

  const startedAt = process.hrtime.bigint();

  res.once("close", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const status = res.statusCode;
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

    logger[level]("request", {
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status,
      ms: Math.round(durationMs),
      ...(res.writableFinished ? {} : { aborted: true }),
    });
  });

  return next();
}