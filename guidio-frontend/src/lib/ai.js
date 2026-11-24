
import { ApiError } from "@/lib/api-client";

// Used when the server does not tell us how long to wait.
export const DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS = 60;

/**
 * Turns any error from an AI request into a friendly, honest message.
 *
 * Returns { kind, title, message, retryAfterSeconds }.
 * retryAfterSeconds is only set for rate limits, so the UI can pause
 * the "send" button instead of repeating a request that will fail again.
 */
export function getFriendlyAiError(error) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "rate_limited":
        return {
          kind: "rate_limited",
          title: "AI limit reached for now",
          message:
            "Guidio AI runs on free AI services, which have request limits. The limit has been reached, so please wait a little and try again. Your text has been kept.",
          retryAfterSeconds:
            error.retryAfterSeconds ?? DEFAULT_RATE_LIMIT_COOLDOWN_SECONDS,
        };

      case "unavailable":
      case "timeout":
      case "network":
        return {
          kind: "unavailable",
          title: "AI service is temporarily unavailable",
          message: error.message,
          retryAfterSeconds: null,
        };

      case "unauthorized":
        return {
          kind: "auth",
          title: "Please sign in again",
          message: error.message,
          retryAfterSeconds: null,
        };

      case "validation":
        return {
          kind: "validation",
          title: "Please check your input",
          message: error.message,
          retryAfterSeconds: null,
        };

      default:
        return {
          kind: "error",
          title: "Something went wrong",
          message: error.message,
          retryAfterSeconds: null,
        };
    }
  }

  return {
    kind: "error",
    title: "Something went wrong",
    message:
      error?.message || "Unable to complete the request. Please try again.",
    retryAfterSeconds: null,
  };
}
