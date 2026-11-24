import { AI_ERROR, AiError, codeFromHttpStatus } from "../ai-errors.js";

/*
 * Small HTTP helpers shared by the Groq and Ollama adapters
 * (they use Node's built-in fetch, so no extra dependency is needed).
 */

/** Reads a Retry-After header: either seconds or an HTTP date. Returns seconds or undefined. */
export function parseRetryAfter(headers) {
  const value = headers?.get?.("retry-after");

  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;

  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, (date - Date.now()) / 1000);

  return undefined;
}

/** Splits a streamed response body into lines. */
export async function* readLines(body) {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });

    let index;
    while ((index = buffer.indexOf("\n")) !== -1) {
      yield buffer.slice(0, index).replace(/\r$/, "");
      buffer = buffer.slice(index + 1);
    }
  }

  buffer += decoder.decode();

  if (buffer.trim()) yield buffer.replace(/\r$/, "");
}

/** Reads the provider's own error text (kept for logs only, never shown to users). */
async function readProviderError(response) {
  try {
    const raw = await response.text();

    try {
      const parsed = JSON.parse(raw);
      const error = parsed?.error ?? parsed;

      return {
        message: String(error?.message ?? error ?? "").slice(0, 300),
        code: String(error?.code ?? error?.type ?? ""),
      };
    } catch {
      return { message: raw.slice(0, 300), code: "" };
    }
  } catch {
    return { message: "", code: "" };
  }
}

/** Converts a non-2xx provider response into a standard AiError. */
export async function buildHttpError(response, provider) {
  const details = await readProviderError(response);
  const status = response.status;
  let code = codeFromHttpStatus(status);
  let retryAfterSeconds = parseRetryAfter(response.headers);

  // Groq: the model produced JSON that does not fit the request.
  if (
    status === 400 &&
    /json_validate_failed/i.test(`${details.code} ${details.message}`)
  ) {
    code = AI_ERROR.INVALID_OUTPUT;
  }

  // Groq answers 413 when one request is larger than the per-minute token
  // limit of the model. Another provider may still handle it, so pause briefly.
  if (status === 413) {
    code = AI_ERROR.RATE_LIMITED;
    retryAfterSeconds ??= 5;
  }

  return new AiError(code, {
    provider,
    providerStatus: status,
    retryAfterSeconds,
    cause: details.message ? new Error(details.message) : undefined,
  });
}

/** fetch() that turns network failures into AiError. Aborts pass through unchanged. */
export async function fetchProvider(url, init, provider) {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (error?.name === "AbortError") throw error;

    throw new AiError(AI_ERROR.UNAVAILABLE, {
      provider,
      cause: error,
    });
  }
}