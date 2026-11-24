/*
 * Standard AI errors.
 *
 * Every provider failure is converted into an AiError, so the rest of the
 * backend (and the frontend) never has to understand Gemini, Groq or Ollama
 * specific error formats.
 *
 * `message` is ALWAYS safe to show to a user. Technical details stay in the
 * logs and never contain prompts, answers or credentials.
 */

export const AI_ERROR = Object.freeze({
  RATE_LIMITED: "rate_limited",
  UNAVAILABLE: "ai_unavailable",
  TIMEOUT: "timeout",
  AUTH: "ai_auth_failed",
  MODEL_NOT_FOUND: "ai_model_not_found",
  INVALID_REQUEST: "ai_invalid_request",
  SAFETY: "ai_safety_blocked",
  INVALID_OUTPUT: "ai_invalid_output",
  CANCELLED: "ai_cancelled",
  NOT_CONFIGURED: "ai_not_configured",
});

const HTTP_STATUS = {
  [AI_ERROR.RATE_LIMITED]: 429,
  [AI_ERROR.UNAVAILABLE]: 503,
  [AI_ERROR.TIMEOUT]: 504,
  [AI_ERROR.AUTH]: 503,
  [AI_ERROR.MODEL_NOT_FOUND]: 503,
  [AI_ERROR.INVALID_REQUEST]: 502,
  [AI_ERROR.SAFETY]: 422,
  [AI_ERROR.INVALID_OUTPUT]: 502,
  [AI_ERROR.CANCELLED]: 499,
  [AI_ERROR.NOT_CONFIGURED]: 503,
};

const PUBLIC_MESSAGES = {
  [AI_ERROR.UNAVAILABLE]:
    "The AI service is temporarily unavailable. Please try again in a moment.",
  [AI_ERROR.TIMEOUT]: "The AI response took too long. Please try again.",
  [AI_ERROR.AUTH]:
    "The AI service is not configured correctly. Please contact the administrator.",
  [AI_ERROR.MODEL_NOT_FOUND]:
    "The AI service is not configured correctly. Please contact the administrator.",
  [AI_ERROR.INVALID_REQUEST]:
    "The AI service could not process this request. Please try again.",
  [AI_ERROR.SAFETY]:
    "The AI could not answer this request. Please rephrase it and try again.",
  [AI_ERROR.INVALID_OUTPUT]:
    "The AI returned an incomplete response. Please try again.",
  [AI_ERROR.CANCELLED]: "The request was cancelled.",
  [AI_ERROR.NOT_CONFIGURED]:
    "No AI provider is configured. Please contact the administrator.",
};

/** Codes for which another provider may be tried. */
const FAILOVER_CODES = new Set([
  AI_ERROR.RATE_LIMITED,
  AI_ERROR.UNAVAILABLE,
  AI_ERROR.TIMEOUT,
  AI_ERROR.AUTH,
  AI_ERROR.MODEL_NOT_FOUND,
  AI_ERROR.NOT_CONFIGURED,
  AI_ERROR.INVALID_OUTPUT,
]);

function publicMessage(code, retryAfterSeconds) {
  if (code === AI_ERROR.RATE_LIMITED) {
    // "limit has been reached" is also what the existing frontend looks for
    // to recognise a rate limit inside a stream.
    return Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? `The AI usage limit has been reached. Please wait about ${Math.ceil(
          retryAfterSeconds,
        )} seconds and try again.`
      : "The AI usage limit has been reached. Please wait a minute and try again.";
  }

  return PUBLIC_MESSAGES[code] ?? PUBLIC_MESSAGES[AI_ERROR.UNAVAILABLE];
}

export class AiError extends Error {
  constructor(
    code,
    {
      provider,
      providerStatus,
      retryAfterSeconds,
      cause,
      partialText,
      attempts,
    } = {},
  ) {
    super(publicMessage(code, retryAfterSeconds));

    this.name = "AiError";
    this.code = code;
    this.statusCode = HTTP_STATUS[code] ?? 503;
    this.expose = true; // the error handler may show `message` to the user
    this.provider = provider;
    this.providerStatus = providerStatus;
    this.retryAfterSeconds = Number.isFinite(retryAfterSeconds)
      ? Math.max(0, retryAfterSeconds)
      : undefined;
    this.partialText = partialText;
    this.attempts = attempts;

    if (cause) this.cause = cause;
  }
}

export function isAiError(error) {
  return error instanceof AiError;
}

/** True when the manager may continue with the next provider. */
export function canFailOver(error) {
  return isAiError(error) && FAILOVER_CODES.has(error.code);
}

/** Maps an HTTP status from any provider to a standard code. */
export function codeFromHttpStatus(status) {
  if (status === 429) return AI_ERROR.RATE_LIMITED;
  if (status === 401 || status === 403) return AI_ERROR.AUTH;
  if (status === 404) return AI_ERROR.MODEL_NOT_FOUND;
  if (status === 408) return AI_ERROR.TIMEOUT;
  if (status === 400 || status === 413 || status === 422) {
    return AI_ERROR.INVALID_REQUEST;
  }
  if (status >= 500) return AI_ERROR.UNAVAILABLE;

  return AI_ERROR.UNAVAILABLE;
}

/** Network-level failures: DNS, refused or reset connections, "fetch failed". */
export function looksLikeNetworkError(error) {
  const text =
    `${error?.name ?? ""} ${error?.code ?? ""} ${error?.message ?? ""} ${
      error?.cause?.code ?? ""
    }`.toLowerCase();

  return /fetch failed|econnrefused|econnreset|enotfound|etimedout|eai_again|socket|network|terminated|und_err/.test(
    text,
  );
}

/** Event sent to the browser when a stream fails (see api-client.js). */
export function toStreamErrorEvent(error) {
  return {
    type: "error",
    message: error.message,
    code: error.code,
    ...(error.retryAfterSeconds !== undefined
      ? { retryAfterSeconds: Math.ceil(error.retryAfterSeconds) }
      : {}),
  };
}