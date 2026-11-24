import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { apiRequest } from "@/lib/api-client";

/**
 * Loads one full interview.
 * Backend contract (unchanged): GET /api/interviews/:id
 *
 * The page gives this component a `key` of the interview id, so the state
 * starts fresh whenever another interview is opened.
 */
export function useInterviewDetail(id) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);

  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [interview, setInterview] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const token = await getTokenRef.current();
        const response = await apiRequest(`/api/interviews/${encodeURIComponent(id)}`, {
          token,
          signal: controller.signal,
        });

        if (!response?.data?.id) {
          throw new Error("The server sent an unexpected response.");
        }

        setInterview(response.data);
        setError(null);
        setStatus("ready");
      } catch (caught) {
        if (caught?.name === "AbortError") return;

        setError(caught);
        setStatus("error");
      }
    }

    load();

    return () => controller.abort();
  }, [id, reloadKey]);

  function reload() {
    setStatus("loading");
    setError(null);
    setReloadKey((key) => key + 1);
  }

  // Used when the improvement plan was not ready the first time.
  async function refresh() {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const token = await getTokenRef.current();
      const response = await apiRequest(`/api/interviews/${encodeURIComponent(id)}`, {
        token,
      });

      if (response?.data?.id === id) {
        setInterview(response.data);
      }
    } catch (caught) {
      setRefreshError(caught);
    } finally {
      setIsRefreshing(false);
    }
  }

  return { status, error, interview, reload, isRefreshing, refreshError, refresh };
}