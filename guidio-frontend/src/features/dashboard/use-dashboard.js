import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { apiRequest } from "@/lib/api-client";

/**
 * Loads GET /api/dashboard once per mount (and again on reload()).
 * The request is cancelled if the page is left before it finishes.
 */
export function useDashboard() {
  const { getToken } = useAuth();

  // Clerk may give a new getToken function on re-renders. Keeping it in a
  // ref stops that from triggering extra requests.
  const getTokenRef = useRef(getToken);

  const [state, setState] = useState({
    status: "loading",
    data: null,
    error: null,
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const token = await getTokenRef.current();
        const response = await apiRequest("/api/dashboard", {
          token,
          signal: controller.signal,
        });

        setState({
          status: "ready",
          data: response?.data ?? null,
          error: null,
        });
      } catch (error) {
        if (error?.name === "AbortError") return;

        setState((previous) => ({
          status: "error",
          data: previous.data,
          error,
        }));
      }
    }

    load();

    return () => controller.abort();
  }, [reloadKey]);

  const reload = useCallback(() => {
    setState((previous) => ({ ...previous, status: "loading", error: null }));
    setReloadKey((key) => key + 1);
  }, []);

  return { ...state, reload };
}