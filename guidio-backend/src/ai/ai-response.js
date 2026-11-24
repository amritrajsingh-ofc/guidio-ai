import { AI_ERROR, AiError } from "./ai-errors.js";

/*
 * Helpers that make the answers and requests of different providers look the
 * same: message cleanup, JSON extraction and the JSON instruction used by
 * providers that cannot enforce a schema themselves.
 */

/**
 * Cleans a chat history: only "user" / "assistant" roles, no empty messages,
 * consecutive messages of the same role merged and the first message from the
 * user (Gemini and some local models reject anything else).
 */
export function normalizeMessages(messages) {
  const cleaned = [];

  for (const message of Array.isArray(messages) ? messages : []) {
    const role = message?.role === "assistant" ? "assistant" : "user";
    const content = String(message?.content ?? "").trim();

    if (!content) continue;

    const previous = cleaned.at(-1);

    if (previous && previous.role === role) {
      previous.content += `\n\n${content}`;
    } else {
      cleaned.push({ role, content });
    }
  }

  while (cleaned.length && cleaned[0].role !== "user") {
    cleaned.shift();
  }

  if (cleaned.length === 0) {
    throw new AiError(AI_ERROR.INVALID_REQUEST);
  }

  return cleaned;
}

/**
 * Extracts a JSON value from model text. Tolerates a Markdown code fence or a
 * short sentence around the JSON, which smaller models sometimes add.
 */
export function parseJsonText(text) {
  const source = String(text ?? "").trim();

  if (!source) {
    throw new AiError(AI_ERROR.INVALID_OUTPUT);
  }

  const candidates = [source];

  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());

  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start !== -1 && end > start)
    candidates.push(source.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next candidate
    }
  }

  throw new AiError(AI_ERROR.INVALID_OUTPUT);
}

/**
 * Text appended to the system prompt for providers without native schema
 * support. The word "JSON" is also required by Groq's JSON mode.
 */
export function buildJsonInstruction(jsonSchema) {
  return [
    "Respond with a single valid JSON object only.",
    "Do not use Markdown, code fences or any text outside the JSON.",
    "The JSON must follow this JSON Schema exactly:",
    JSON.stringify(jsonSchema),
  ].join("\n");
}

/** Combines the base system prompt with the JSON instruction, if any. */
export function withJsonInstruction(system, jsonSchema) {
  if (!jsonSchema) return system || "";

  return [system, buildJsonInstruction(jsonSchema)]
    .filter(Boolean)
    .join("\n\n");
}

/** Some reasoning models wrap their thoughts in <think> tags. */
export function stripReasoning(text) {
  return String(text ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}