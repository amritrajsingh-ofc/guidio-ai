import { AI_ERROR, AiError } from "../ai-errors.js";
import { stripReasoning, withJsonInstruction } from "../ai-response.js";
import { buildHttpError, fetchProvider, readLines } from "./http-utils.js";

/*
 * Ollama adapter (locally hosted open-source models, via fetch).
 *
 * Enabled only when OLLAMA_BASE_URL is set. Render's free tier cannot run
 * Ollama, so this is meant for local development or a machine you control.
 * Structured output uses Ollama's `format` field (a JSON schema).
 */

export function createLocalProvider(config) {
  function buildBody(
    { system, messages, jsonSchema, temperature, maxOutputTokens },
    stream,
    defaultMaxOutputTokens,
  ) {
    // Ollama's docs recommend also describing the schema in the prompt.
    const systemText = withJsonInstruction(system, jsonSchema);

    return {
      model: config.model,
      messages: [
        ...(systemText ? [{ role: "system", content: systemText }] : []),
        ...messages,
      ],
      stream,
      ...(jsonSchema ? { format: jsonSchema } : {}),
      options: {
        num_ctx: config.numCtx,
        num_predict: maxOutputTokens ?? defaultMaxOutputTokens,
        // Low temperature gives more reliable JSON from small local models.
        ...(temperature !== undefined
          ? { temperature }
          : jsonSchema
            ? { temperature: 0.2 }
            : {}),
      },
    };
  }

  async function post(request, stream, defaultMaxOutputTokens) {
    const response = await fetchProvider(
      `${config.baseUrl.replace(/\/+$/, "")}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildBody(request, stream, defaultMaxOutputTokens),
        ),
        signal: request.signal,
      },
      "ollama",
    );

    if (!response.ok) throw await buildHttpError(response, "ollama");

    return response;
  }

  return {
    name: "ollama",
    model: config.model,
    timeoutMs: config.timeoutMs,

    isConfigured() {
      return config.enabled;
    },

    async generate(request) {
      const response = await post(
        request,
        false,
        config.defaultMaxOutputTokens,
      );

      let payload;

      try {
        payload = await response.json();
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        throw new AiError(AI_ERROR.UNAVAILABLE, {
          provider: "ollama",
          cause: error,
        });
      }

      const text = stripReasoning(String(payload?.message?.content ?? ""));

      if (!text)
        throw new AiError(AI_ERROR.INVALID_OUTPUT, { provider: "ollama" });

      return { text, finishReason: payload?.done_reason };
    },

    async *stream(request) {
      const response = await post(request, true, config.defaultMaxOutputTokens);

      for await (const line of readLines(response.body)) {
        if (!line.trim()) continue;

        let payload;

        try {
          payload = JSON.parse(line);
        } catch {
          continue;
        }

        if (payload?.error) {
          throw new AiError(AI_ERROR.UNAVAILABLE, {
            provider: "ollama",
            cause: new Error(String(payload.error).slice(0, 300)),
          });
        }

        const text = payload?.message?.content;

        if (text) yield text;
        if (payload?.done) return;
      }
    },
  };
}