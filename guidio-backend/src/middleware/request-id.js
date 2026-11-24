import { randomUUID } from "node:crypto";

/**
 * Middleware that assigns a unique X-Request-ID to incoming requests if not already present.
 */
export function requestIdMiddleware(req, res, next) {
  const requestId = req.headers["x-request-id"] || randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}
