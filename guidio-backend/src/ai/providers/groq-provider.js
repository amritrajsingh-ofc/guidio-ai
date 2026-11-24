import { AI_ERROR, AiError } from "../ai-errors.js";
import { stripReasoning, withJsonInstruction } from "../ai-response.js";
import { buildHttpError, fetchProvider, readLines } from "./http-utils.js";

/*
 * Groq adapter (OpenAI-compatible chat completions API, via fetch).
 *
 * Structured output: not every Groq model supports strict json_schema, so
 * this adapter uses JSON mode ({ type: "json_object" }) and puts the schema in
 * the prompt. The reply is validated with Zod by the caller, and a bad reply
 * makes the manager try the next provider.
 */

export function createGroqProvider(config) {
  function buildBody(
    { system, messages, jsonSchema, temperature, maxOutputTokens },
    stream,
    defaultMaxOutputTokens,
  ) {
    const systemText = withJsonInstruction(system, jsonSchema);

    return {
      model: config.model,
      messages: [
        ...(systemText ? [{ role: "system", content: systemText }] : []),
        ...messages,
      ],
      stream,
      max_completion_tokens: maxOutputTokens ?? defaultMaxOutputTokens,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(jsonSchema ? { response_format: { type: "json_object" } } : {}),
    };
  }

  async function post(request, stream, defaultMaxOutputTokens) {
    const response = await fetchProvider(
      `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(
          buildBody(request, stream, defaultMaxOutputTokens),
        ),
        signal: request.signal,
      },
      "groq",
    );

    if (!response.ok) throw await buildHttpError(response, "groq");

    return response;
  }

  return {
    name: "groq",
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
          provider: "groq",
          cause: error,
        });
      }

      const choice = payload?.choices?.[0];
      const text = stripReasoning(String(choice?.message?.content ?? ""));

      if (!text)
        throw new AiError(AI_ERROR.INVALID_OUTPUT, { provider: "groq" });

      return { text, finishReason: choice?.finish_reason };
    },

    async *stream(request) {
      const response = await post(request, true, config.defaultMaxOutputTokens);

      for await (const line of readLines(response.body)) {
        if (!line.startsWith("data:")) continue;

        const data = line.slice(5).trim();

        if (!data) continue;
        if (data === "[DONE]") return;

        let payload;

        try {
          payload = JSON.parse(data);
        } catch {
          continue;
        }

        if (payload?.error) {
          throw new AiError(AI_ERROR.UNAVAILABLE, {
            provider: "groq",
            cause: new Error(
              String(payload.error?.message ?? "stream error").slice(0, 300),
            ),
          });
        }

        const text = payload?.choices?.[0]?.delta?.content;

        if (text) yield text;
      }
    },
  };
}