import { GoogleGenAI } from "@google/genai";

import {
  AI_ERROR,
  AiError,
  codeFromHttpStatus,
  looksLikeNetworkError,
} from "../ai-errors.js";

/*
 * Google Gemini adapter (official @google/genai SDK).
 * Supports native JSON-schema output (responseJsonSchema) and streaming.
 */

const SAFETY_FINISH_REASONS = new Set([
  "SAFETY",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "RECITATION",
  "IMAGE_SAFETY",
]);

/** Gemini reports the wait time inside the error text, e.g. "retryDelay":"33s". */
function parseRetryDelay(message) {
  const match = /retryDelay"?\s*[:=]\s*"?(\d+(?:\.\d+)?)s/i.exec(message);

  return match ? Number(match[1]) : undefined;
}

function mapError(error) {
  if (error instanceof AiError || error?.name === "AbortError") return error;

  const status = Number.isInteger(error?.status) ? error.status : undefined;
  const message = String(error?.message ?? "");
  const lower = message.toLowerCase();
  const cause = error instanceof Error ? error : undefined;

  // Gemini answers an invalid key with HTTP 400, not 401.
  if (
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid")
  ) {
    return new AiError(AI_ERROR.AUTH, {
      provider: "gemini",
      providerStatus: status,
      cause,
    });
  }

  if (status === 429 || lower.includes("resource_exhausted")) {
    return new AiError(AI_ERROR.RATE_LIMITED, {
      provider: "gemini",
      providerStatus: status ?? 429,
      retryAfterSeconds: parseRetryDelay(message),
      cause,
    });
  }

  if (status !== undefined) {
    return new AiError(codeFromHttpStatus(status), {
      provider: "gemini",
      providerStatus: status,
      retryAfterSeconds: parseRetryDelay(message),
      cause,
    });
  }

  return new AiError(AI_ERROR.UNAVAILABLE, {
    provider: "gemini",
    cause: looksLikeNetworkError(error) ? error : cause,
  });
}

function checkSafety(response, hasText) {
  if (response?.promptFeedback?.blockReason) {
    throw new AiError(AI_ERROR.SAFETY, { provider: "gemini" });
  }

  const finishReason = response?.candidates?.[0]?.finishReason;

  if (!hasText && SAFETY_FINISH_REASONS.has(String(finishReason))) {
    throw new AiError(AI_ERROR.SAFETY, { provider: "gemini" });
  }

  return finishReason;
}

export function createGeminiProvider(config) {
  const client = config.enabled
    ? new GoogleGenAI({
        apiKey: config.apiKey,
        ...(config.baseUrl ? { httpOptions: { baseUrl: config.baseUrl } } : {}),
      })
    : null;

  function buildParams({
    system,
    messages,
    jsonSchema,
    temperature,
    maxOutputTokens,
    signal,
  }) {
    return {
      model: config.model,
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      config: {
        ...(system ? { systemInstruction: system } : {}),
        ...(temperature !== undefined ? { temperature } : {}),
        ...(maxOutputTokens ? { maxOutputTokens } : {}),
        ...(jsonSchema
          ? {
              responseMimeType: "application/json",
              responseJsonSchema: jsonSchema,
            }
          : {}),
        abortSignal: signal,
      },
    };
  }

  return {
    name: "gemini",
    model: config.model,
    timeoutMs: config.timeoutMs,

    isConfigured() {
      return Boolean(client);
    },

    async generate(request) {
      try {
        const response = await client.models.generateContent(
          buildParams(request),
        );
        const text = response.text?.trim() ?? "";
        const finishReason = checkSafety(response, Boolean(text));

        if (!text)
          throw new AiError(AI_ERROR.INVALID_OUTPUT, { provider: "gemini" });

        return { text, finishReason };
      } catch (error) {
        throw mapError(error);
      }
    },

    async *stream(request) {
      try {
        const stream = await client.models.generateContentStream(
          buildParams(request),
        );
        let emitted = false;

        for await (const chunk of stream) {
          const text = chunk.text ?? "";

          checkSafety(chunk, emitted || Boolean(text));

          if (text) {
            emitted = true;
            yield text;
          }
        }
      } catch (error) {
        throw mapError(error);
      }
    },
  };
}