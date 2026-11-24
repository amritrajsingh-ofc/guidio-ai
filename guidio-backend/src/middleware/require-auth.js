import { getAuth } from "@clerk/express";
import { sendError } from "../utils/api-response.js";

/**
 * Requires a valid Clerk session token (Authorization: Bearer <token>).
 * Never logs the user id or the token.
 */
export function requireAuth(req, res, next) {
  const { isAuthenticated, userId } = getAuth(req);

  if (!isAuthenticated || !userId) {
    return sendError(
      res,
      "Unauthorized. Please sign in first.",
      401,
      null,
      "unauthorized"
    );
  }

  req.authenticatedUserId = userId;

  return next();
}