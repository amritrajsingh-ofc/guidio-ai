import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { apiRequest } from "@/lib/api-client";

/**
 * Loads GET /api/profile once per mount (and again on reload()) and
 * provides save(payload), which calls PUT /api/profile.
 *
 * `profile` is null for a student who has not saved anything yet.
 */
export function useProfile() {
  const { getToken } = useAuth();

  // Clerk may give a new getToken function on re-renders. Keeping it in a
  // ref stops that from triggering extra requests.
  const getTokenRef = useRef(getToken);

  const [state, setState] = useState({
    status: "loading", // loading | ready | error
    profile: null,
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
        const response = await apiRequest("/api/profile", {
          token,
          signal: controller.signal,
        });

        setState({
          status: "ready",
          profile: response?.data ?? null,
          error: null,
        });
      } catch (error) {
        if (error?.name === "AbortError") return;

        setState({ status: "error", profile: null, error });
      }
    }

    load();

    return () => controller.abort();
  }, [reloadKey]);

  const reload = useCallback(() => {
    setState({ status: "loading", profile: null, error: null });
    setReloadKey((key) => key + 1);
  }, []);

  const save = useCallback(async (payload) => {
    const token = await getTokenRef.current();
    const response = await apiRequest("/api/profile", {
      method: "PUT",
      token,
      body: payload,
    });

    return response?.data ?? null;
  }, []);

  return { ...state, reload, save };
}