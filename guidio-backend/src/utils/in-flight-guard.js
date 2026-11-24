import { AppError } from "./app-error.js";

/**
 * Stops the same expensive job from running twice at the same time
 * (for example a double click on "Generate").
 *
 * The second request is rejected with 409 BEFORE it calls the AI, so no
 * free-tier quota is wasted. The guard lives in this process, which is
 * correct for a single Render instance. The database unique indexes remain
 * the final protection if the app is ever scaled to several instances.
 */
export function createInFlightGuard(conflictMessage) {
  const active = new Set();

  return async function runExclusive(key, task) {
    if (active.has(key)) {
      throw new AppError(conflictMessage, 409, { code: "request_in_progress" });
    }

    active.add(key);

    try {
      return await task();
    } finally {
      active.delete(key);
    }
  };
}