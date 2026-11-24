import { logger } from "../utils/logger.js";
import { aiConfig } from "./ai-config.js";
import { AI_ERROR, AiError, canFailOver, isAiError } from "./ai-errors.js";
import { createGeminiProvider } from "./providers/gemini-provider.js";
import { createGroqProvider } from "./providers/groq-provider.js";
import { createLocalProvider } from "./providers/local-provider.js";

/*
 * AI Provider Manager
 * -------------------
 * Picks the first healthy provider (Gemini -> Groq -> Ollama by default),
 * fails over when one has a temporary problem and remembers which providers
 * are paused (rate limit / outage) so they are not hammered again.
 *
 * Rules:
 *  - 429: the provider is paused for its Retry-After time (60 s if none was sent)
 *    and the next provider is used. The same provider is never retried.
 *  - 5xx / network: tried again once, ONLY if no other provider is left.
 *  - Bad key / unknown model: provider is paused for 15 minutes, next one is used.
 *  - Invalid request, safety refusal, cancellation: never retried, never failed over.
 *  - Streaming: failing over is only possible BEFORE the first chunk was sent.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createAbortError() {
  return Object.assign(new Error("Aborted"), { name: "AbortError" });
}

/** Rejects as soon as the signal aborts, even if the SDK ignores the signal. */
function raceAbort(promise, signal) {
  if (signal.aborted) {
    promise.catch(() => {});
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => reject(createAbortError());

    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/** One attempt: its own abort signal, linked to the caller's, plus a re-armable timer. */
function createAttemptScope(parentSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  let timer = null;

  const arm = (ms) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ms);
  };

  const onParentAbort = () => controller.abort();

  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener("abort", onParentAbort, { once: true });
  }

  arm(timeoutMs);

  return {
    signal: controller.signal,
    arm,
    get timedOut() {
      return timedOut;
    },
    dispose() {
      clearTimeout(timer);
      parentSignal?.removeEventListener("abort", onParentAbort);
    },
  };
}

function toAiError(error, provider, scope, parentSignal) {
  if (scope.timedOut) {
    return new AiError(AI_ERROR.TIMEOUT, {
      provider: provider.name,
      cause: error,
    });
  }

  if (parentSignal?.aborted) {
    return new AiError(AI_ERROR.CANCELLED, { provider: provider.name });
  }

  if (isAiError(error)) {
    error.provider ??= provider.name;
    return error;
  }

  return new AiError(AI_ERROR.UNAVAILABLE, {
    provider: provider.name,
    cause: error,
  });
}

export function createProviderManager({
  providers,
  config = aiConfig,
  log = logger,
  now = Date.now,
  wait = sleep,
} = {}) {
  const ordered = config.providerOrder
    .map((name) => providers.find((provider) => provider.name === name))
    .filter((provider) => provider && provider.isConfigured());

  const health = new Map(
    ordered.map((provider) => [
      provider.name,
      {
        cooldownUntil: 0,
        consecutiveFailures: 0,
        lastErrorCode: null,
        lastErrorAt: null,
        lastSuccessAt: null,
        successes: 0,
        failures: 0,
      },
    ]),
  );

  /* -------------------------------------------------------
     Health tracking
     ------------------------------------------------------- */

  function secondsUntilAvailable(provider) {
    return Math.max(
      0,
      Math.ceil((health.get(provider.name).cooldownUntil - now()) / 1000),
    );
  }

  function recordSuccess(provider) {
    const state = health.get(provider.name);

    state.consecutiveFailures = 0;
    state.cooldownUntil = 0;
    state.lastSuccessAt = new Date(now()).toISOString();
    state.successes += 1;
  }

  function recordFailure(provider, error) {
    const state = health.get(provider.name);
    const { cooldown } = config;

    state.lastErrorCode = error.code;
    state.lastErrorAt = new Date(now()).toISOString();
    state.failures += 1;

    switch (error.code) {
      case AI_ERROR.RATE_LIMITED: {
        const waitMs = Math.min(
          Math.max(
            (error.retryAfterSeconds ?? cooldown.defaultRateLimitMs / 1000) *
              1000,
            1000,
          ),
          cooldown.maxMs,
        );

        state.cooldownUntil = now() + waitMs;
        break;
      }

      case AI_ERROR.AUTH:
      case AI_ERROR.MODEL_NOT_FOUND:
      case AI_ERROR.NOT_CONFIGURED:
        state.cooldownUntil = now() + cooldown.configurationMs;
        log.error("ai_provider_misconfigured", {
          provider: provider.name,
          model: provider.model,
          code: error.code,
          status: error.providerStatus,
        });
        break;

      case AI_ERROR.UNAVAILABLE:
      case AI_ERROR.TIMEOUT:
        state.consecutiveFailures += 1;

        if (state.consecutiveFailures >= cooldown.transientThreshold) {
          state.cooldownUntil = now() + cooldown.transientMs;
        }
        break;

      default:
        // Invalid output, invalid request, safety, cancelled: not a provider health problem.
        break;
    }
  }

  /* -------------------------------------------------------
     Final error when nothing worked
     ------------------------------------------------------- */

  function buildFinalError(failures, skipped) {
    const attempts = failures.map((error) => ({
      provider: error.provider,
      code: error.code,
      status: error.providerStatus,
    }));

    const waits = [];
    let allRateLimited = failures.length + skipped.length > 0;

    for (const error of failures) {
      if (error.code === AI_ERROR.RATE_LIMITED) {
        waits.push(
          error.retryAfterSeconds ?? config.cooldown.defaultRateLimitMs / 1000,
        );
      } else {
        allRateLimited = false;
      }
    }

    for (const provider of skipped) {
      if (health.get(provider.name).lastErrorCode === AI_ERROR.RATE_LIMITED) {
        waits.push(secondsUntilAvailable(provider));
      } else {
        allRateLimited = false;
      }
    }

    if (allRateLimited && waits.length) {
      return new AiError(AI_ERROR.RATE_LIMITED, {
        retryAfterSeconds: Math.min(...waits),
        attempts,
      });
    }

    if (
      failures.length &&
      failures.every((e) => e.code === AI_ERROR.INVALID_OUTPUT)
    ) {
      return new AiError(AI_ERROR.INVALID_OUTPUT, { attempts });
    }

    if (failures.length && failures.every((e) => e.code === AI_ERROR.TIMEOUT)) {
      return new AiError(AI_ERROR.TIMEOUT, { attempts });
    }

    const pauseSeconds = skipped
      .map(secondsUntilAvailable)
      .filter((s) => s > 0);

    return new AiError(AI_ERROR.UNAVAILABLE, {
      attempts,
      retryAfterSeconds: pauseSeconds.length
        ? Math.min(...pauseSeconds)
        : undefined,
    });
  }

  /* -------------------------------------------------------
     Failover loop (shared by generate and stream)
     ------------------------------------------------------- */

  async function run(request, attempt) {
    if (ordered.length === 0) {
      throw new AiError(AI_ERROR.NOT_CONFIGURED);
    }

    const usable = [];
    const skipped = [];

    for (const provider of ordered) {
      (secondsUntilAvailable(provider) > 0 ? skipped : usable).push(provider);
    }

    const failures = [];

    for (let index = 0; index < usable.length; index += 1) {
      const provider = usable[index];
      const isLast = index === usable.length - 1;
      const startedAt = now();

      try {
        const result = await attemptWithRetries(
          provider,
          request,
          attempt,
          isLast,
        );

        recordSuccess(provider);

        log.info("ai_request_completed", {
          feature: request.feature,
          provider: provider.name,
          model: provider.model,
          ms: now() - startedAt,
          failedProviders: failures.length,
        });

        return { ...result, fallbackUsed: failures.length > 0 };
      } catch (error) {
        recordFailure(provider, error);
        failures.push(error);

        // The user closed the page: nothing to log, nothing to try.
        if (error.code === AI_ERROR.CANCELLED) throw error;

        const willFailOver = canFailOver(error) && !error.midStream && !isLast;

        log.warn("ai_provider_failed", {
          feature: request.feature,
          provider: provider.name,
          model: provider.model,
          code: error.code,
          status: error.providerStatus,
          retryAfterSeconds: error.retryAfterSeconds,
          midStream: Boolean(error.midStream),
          willFailOver,
        });

        if (error.cause?.message) {
          log.debug("ai_provider_failure_detail", {
            provider: provider.name,
            detail: String(error.cause.message).slice(0, 200),
          });
        }

        if (error.midStream || !canFailOver(error)) {
          throw error;
        }
      }
    }

    throw buildFinalError(failures, skipped);
  }

  async function attemptWithRetries(provider, request, attempt, isLast) {
    let retriesLeft = config.maxRetries;
    let invalidOutputRetried = false;
    let retryNumber = 0;

    for (;;) {
      try {
        return await attempt(provider, request);
      } catch (error) {
        if (error.midStream || request.signal?.aborted) throw error;

        // Temporary server problems: retry only when there is no other provider left.
        if (error.code === AI_ERROR.UNAVAILABLE && isLast && retriesLeft > 0) {
          retriesLeft -= 1;
          retryNumber += 1;
          await wait(
            config.retryBaseDelayMs * 2 ** (retryNumber - 1) +
              Math.random() * 200,
          );
          continue;
        }

        // A malformed answer: ask the same provider once more only if it is the last option.
        if (
          error.code === AI_ERROR.INVALID_OUTPUT &&
          isLast &&
          !invalidOutputRetried
        ) {
          invalidOutputRetried = true;
          continue;
        }

        throw error;
      }
    }
  }

  /* -------------------------------------------------------
     Single attempts
     ------------------------------------------------------- */

  async function attemptGenerate(provider, request) {
    const scope = createAttemptScope(request.signal, provider.timeoutMs);
    const startedAt = now();

    try {
      const result = await raceAbort(
        provider.generate({ ...request, signal: scope.signal }),
        scope.signal,
      );

      // Validation lives inside the attempt, so a bad answer can fail over.
      let data;

      if (request.parse) {
        try {
          data = request.parse(result.text, provider.name);
        } catch (error) {
          throw isAiError(error)
            ? error
            : new AiError(AI_ERROR.INVALID_OUTPUT, {
                provider: provider.name,
                cause: error,
              });
        }
      }

      return {
        text: result.text,
        data,
        provider: provider.name,
        model: provider.model,
        finishReason: result.finishReason,
        latencyMs: now() - startedAt,
      };
    } catch (error) {
      throw toAiError(error, provider, scope, request.signal);
    } finally {
      scope.dispose();
    }
  }

  async function attemptStream(provider, request) {
    const scope = createAttemptScope(request.signal, provider.timeoutMs);
    const startedAt = now();
    let text = "";
    let iterator = null;

    try {
      const source = provider.stream({ ...request, signal: scope.signal });

      iterator = source[Symbol.asyncIterator]();

      for (;;) {
        const { value, done } = await raceAbort(iterator.next(), scope.signal);

        if (done) break;
        if (!value) continue;

        text += value;

        // After the first chunk, only a long silence counts as a timeout.
        scope.arm(config.streamIdleTimeoutMs);

        try {
          request.onChunk?.(value);
        } catch {
          // A broken callback must never break generation.
        }
      }

      if (!text.trim()) {
        throw new AiError(AI_ERROR.INVALID_OUTPUT, { provider: provider.name });
      }

      return {
        text: text.trim(),
        provider: provider.name,
        model: provider.model,
        latencyMs: now() - startedAt,
      };
    } catch (error) {
      const aiError = toAiError(error, provider, scope, request.signal);

      if (text) {
        aiError.partialText = text;
        aiError.midStream = true;
      }

      throw aiError;
    } finally {
      scope.dispose();
      // Do not await: a stuck generator must not block the response.
      Promise.resolve(iterator?.return?.()).catch(() => {});
    }
  }

  return {
    generate: (request) => run(request, attemptGenerate),
    stream: (request) => run(request, attemptStream),

    /** Safe to expose: no keys, prompts or user data. */
    getStatus() {
      return ordered.map((provider) => {
        const state = health.get(provider.name);
        const pausedSeconds = secondsUntilAvailable(provider);

        return {
          provider: provider.name,
          model: provider.model,
          available: pausedSeconds === 0,
          pausedSeconds,
          lastErrorCode: state.lastErrorCode,
          lastErrorAt: state.lastErrorAt,
          lastSuccessAt: state.lastSuccessAt,
          successes: state.successes,
          failures: state.failures,
        };
      });
    },
  };
}

export function createDefaultProviderManager() {
  const shared = { defaultMaxOutputTokens: aiConfig.defaultMaxOutputTokens };

  const manager = createProviderManager({
    providers: [
      createGeminiProvider(aiConfig.providers.gemini),
      createGroqProvider({ ...aiConfig.providers.groq, ...shared }),
      createLocalProvider({ ...aiConfig.providers.ollama, ...shared }),
    ],
  });

  logger.info("ai_providers_ready", {
    order: manager.getStatus().map((item) => `${item.provider}:${item.model}`),
  });

  return manager;
}