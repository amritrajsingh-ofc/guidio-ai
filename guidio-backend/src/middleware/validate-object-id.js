import { sendError } from "../utils/api-response.js";

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/**
 * Rejects malformed MongoDB ObjectIds in route params before they reach Prisma.
 * Usage: router.get("/:planId", requireAuth, validateObjectId("planId"), handler)
 */
export function validateObjectId(...paramNames) {
  return (req, res, next) => {
    for (const name of paramNames) {
      const value = req.params[name];

      if (typeof value !== "string" || !OBJECT_ID_PATTERN.test(value)) {
        return sendError(
          res,
          "The requested item was not found.",
          404,
          null,
          "not_found"
        );
      }
    }

    return next();
  };
}