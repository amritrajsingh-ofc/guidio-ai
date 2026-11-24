import { logger } from "../utils/logger.js";
import { AI_ERROR, AiError } from "./ai-errors.js";
import { createDefaultProviderManager } from "./ai-provider-manager.js";
import { normalizeMessages, parseJsonText } from "./ai-response.js";

/*
 * The only AI entry point the rest of the backend uses.
 * Services never import a provider or the Gemini SDK directly.
 *
 *   aiService.streamText({ feature, system, messages, onChunk, signal })
 *   aiService.generateJson({ feature, system, prompt, jsonSchema, schema, signal })
 *   aiService.generateText({ feature, system, prompt | messages, signal })
 */

const manager = createDefaultProviderManager();

function toMessages({ messages, prompt }) {
  return normalizeMessages(messages ?? [{ role: "user", content: prompt }]);
}

/** Parses the model text and validates it with Zod. Throws INVALID_OUTPUT on any problem. */
function createJsonParser(schema, feature) {
  return (text, provider) => {
    const json = parseJsonText(text);
    const result = schema.safeParse(json);

    if (!result.success) {
      // Only field paths and rule names are logged, never the model's text.
      logger.warn("ai_output_validation_failed", {
        feature,
        provider,
        issues: result.error.issues
          .slice(0, 8)
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.code}`),
      });

      throw new AiError(AI_ERROR.INVALID_OUTPUT, { provider });
    }

    return result.data;
  };
}

export const aiService = {
  /** Streams text. Resolves with the complete answer; onChunk gets each piece. */
  async streamText({
    feature = "chat",
    system,
    messages,
    onChunk,
    signal,
    temperature,
    maxOutputTokens,
  }) {
    return manager.stream({
      feature,
      system,
      messages: toMessages({ messages }),
      onChunk,
      signal,
      temperature,
      maxOutputTokens,
    });
  },

  /**
   * Returns data that already passed the Zod `schema`.
   * `jsonSchema` is the plain JSON Schema sent to the provider.
   */
  async generateJson({
    feature = "json",
    system,
    prompt,
    jsonSchema,
    schema,
    signal,
    temperature,
    maxOutputTokens,
  }) {
    const result = await manager.generate({
      feature,
      system,
      messages: toMessages({ prompt }),
      jsonSchema,
      parse: createJsonParser(schema, feature),
      signal,
      temperature,
      maxOutputTokens,
    });

    return result.data;
  },

  /** Plain (non-streamed) text. */
  async generateText({
    feature = "text",
    system,
    prompt,
    messages,
    signal,
    temperature,
    maxOutputTokens,
  }) {
    const result = await manager.generate({
      feature,
      system,
      messages: toMessages({ messages, prompt }),
      signal,
      temperature,
      maxOutputTokens,
    });

    return result.text;
  },

  /** Provider health for the health endpoint / diagnostics. No secrets. */
  getStatus() {
    return manager.getStatus();
  },
};