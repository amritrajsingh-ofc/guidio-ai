import { useCallback, useEffect, useState } from "react";

/**
 * Counts down in seconds. Use it to pause a "Send" button after a
 * rate-limit response so the user does not repeat a request that will fail.
 *
 *   const cooldown = useCooldown();
 *   cooldown.start(60);          // call from an event handler or catch block
 *   cooldown.isCoolingDown;      // true until the countdown ends
 *   cooldown.remaining;          // seconds left
 */
export function useCooldown() {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (remaining <= 0) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setRemaining((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [remaining]);

  const start = useCallback((seconds) => {
    setRemaining(Math.max(0, Math.ceil(seconds)));
  }, []);

  const reset = useCallback(() => setRemaining(0), []);

  return {
    remaining,
    isCoolingDown: remaining > 0,
    start,
    reset,
  };
}