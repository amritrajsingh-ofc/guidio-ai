
import { getAuth } from "@clerk/express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { sendError } from "../utils/api-response.js";

/*
 * Limits are counted per signed-in user when possible (requireAuth must run
 * first on that route), and per client IP otherwise.
 * "trust proxy" is configured in app.js so req.ip is the real visitor on Render.
 * express-rate-limit also sends the Retry-After header on a 429.
 */

/**
 * The signed-in user, when known. requireAuth sets req.authenticatedUserId on
 * routes that use it. The general /api limiter runs before requireAuth, so it
 * reads the user from Clerk instead (the token is already verified by then).
 * Students often share one college Wi-Fi address, so counting signed-in
 * students per person, not per IP, keeps one busy campus from blocking
 * everyone on it.
 */
function getUserId(req) {
  if (req.authenticatedUserId) return req.authenticatedUserId;

  try {
    return getAuth(req)?.userId ?? null;
  } catch {
    return null;
  }
}

function createLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,

    keyGenerator: (req) => {
      const userId = getUserId(req);

      return userId ? `user:${userId}` : ipKeyGenerator(req.ip ?? "unknown");
    },

    handler: (req, res) =>
      sendError(res, message, 429, null, "rate_limited"),
  });
}

/** Every /api request, per signed-in user (per IP when signed out). Generous: one dashboard load makes several calls. */
export const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: "Too many requests. Please try again later.",
});

/** AI assistant, career guidance, skill gap: per user. */
export const aiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: "Too many AI requests. Please try again later.",
});

/** Starting interviews and submitting answers: per user. */
export const interviewLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  message: "Too many interview requests. Please try again later.",
});

/** Saving the profile, creating or deleting chats, marking notifications read: per user. */
export const writeLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: "Too many changes in a short time. Please try again later.",
});
