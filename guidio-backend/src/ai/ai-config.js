import { env } from "../config/env.js";

/*
 * AI configuration, built from the validated environment (config/env.js).
 * API keys live only inside this object and are never logged.
 */

export const PROVIDER_NAMES = ["gemini", "groq", "ollama"];

function parseProviderOrder(raw) {
  const names = String(raw)
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => PROVIDER_NAMES.includes(name));

  // Unknown names are ignored; any provider left out of the list is not used.
  return [...new Set(names)];
}

const providerOrder = parseProviderOrder(env.ai.providerOrder);

export const aiConfig = Object.freeze({
  providerOrder: providerOrder.length ? providerOrder : [...PROVIDER_NAMES],

  // Output limit for providers that need one. Keeps free-tier token-per-minute
  // usage predictable. Gemini uses its own default unless a limit is passed.
  defaultMaxOutputTokens: 4096,

  streamIdleTimeoutMs: env.ai.streamIdleTimeoutMs,
  maxRetries: env.ai.maxRetries,
  retryBaseDelayMs: 400,

  cooldown: Object.freeze({
    defaultRateLimitMs: 60_000, // used when the provider sends no Retry-After
    maxMs: 15 * 60_000, // never block a provider for longer than this
    transientThreshold: 3, // consecutive 5xx / timeouts before pausing
    transientMs: 30_000,
    configurationMs: 15 * 60_000, // bad key / unknown model
  }),

  providers: Object.freeze({
    gemini: Object.freeze({
      enabled: Boolean(env.ai.gemini.apiKey),
      apiKey: env.ai.gemini.apiKey,
      model: env.ai.gemini.model,
      baseUrl: env.ai.gemini.baseUrl,
      timeoutMs: env.ai.timeoutMs,
    }),
    groq: Object.freeze({
      enabled: Boolean(env.ai.groq.apiKey),
      apiKey: env.ai.groq.apiKey,
      model: env.ai.groq.model,
      baseUrl: env.ai.groq.baseUrl,
      timeoutMs: env.ai.timeoutMs,
    }),
    ollama: Object.freeze({
      enabled: Boolean(env.ai.ollama.baseUrl),
      model: env.ai.ollama.model,
      baseUrl: env.ai.ollama.baseUrl,
      numCtx: env.ai.ollama.numCtx,
      timeoutMs: env.ai.localTimeoutMs,
    }),
  }),
});