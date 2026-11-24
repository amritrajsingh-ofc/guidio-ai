/*
 * Health report logic. Everything it needs is passed in, so it can be tested
 * without a database, and it never exposes secrets, models, keys or error text.
 *
 * HTTP status rules:
 *   200  database is up                (AI problems are shown in the body only)
 *   503  database is down, or the server is shutting down
 *
 * AI trouble does NOT return 503: a rate-limited provider heals by itself, and
 * a restart by Render would not help.
 */

const DEFAULT_CACHE_MS = 10_000;

export function createHealthService({
  pingDatabase,
  getAiStatus,
  isShuttingDown,
  now = Date.now,
  cacheMs = DEFAULT_CACHE_MS,
}) {
  let cached = null; // { at, databaseUp }
  let pending = null; // one shared ping for simultaneous requests

  async function checkDatabase() {
    if (cached && now() - cached.at < cacheMs) {
      return cached.databaseUp;
    }

    if (!pending) {
      pending = Promise.resolve()
        .then(() => pingDatabase())
        .then(Boolean, () => false)
        .then((databaseUp) => {
          cached = { at: now(), databaseUp };
          return databaseUp;
        })
        .finally(() => {
          pending = null;
        });
    }

    return pending;
  }

  /** Provider names and availability only. No models, keys or error codes. */
  function summarizeAi() {
    let statuses;

    try {
      statuses = getAiStatus();
    } catch {
      return { status: "unknown", providers: [] };
    }

    const providers = statuses.map((item) => ({
      provider: item.provider,
      available: Boolean(item.available),
      ...(item.available ? {} : { retryInSeconds: item.pausedSeconds }),
    }));

    const availableCount = providers.filter((item) => item.available).length;

    let status = "degraded";
    if (providers.length === 0) status = "unconfigured";
    else if (availableCount === providers.length) status = "up";
    else if (availableCount === 0) status = "down";

    return { status, providers };
  }

  async function check() {
    const base = {
      service: "Guidio AI API",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date(now()).toISOString(),
    };

    if (isShuttingDown()) {
      return {
        httpStatus: 503,
        body: {
          success: false,
          message: "Guidio AI backend is shutting down",
          data: { status: "shutting_down", ...base },
        },
      };
    }

    const databaseUp = await checkDatabase();
    const ai = summarizeAi();

    return {
      httpStatus: databaseUp ? 200 : 503,
      body: {
        success: databaseUp,
        message: databaseUp
          ? "Guidio AI backend is running"
          : "Guidio AI backend is running but the database is unreachable",
        data: {
          status: databaseUp ? "healthy" : "degraded",
          database: databaseUp ? "up" : "down",
          ai,
          ...base,
        },
      },
    };
  }

  return { check };
}