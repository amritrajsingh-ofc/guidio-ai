import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { apiRequest } from "@/lib/api-client";
import { asArray } from "./interview-utils";

/**
 * Loads the list of the student's interviews.
 * Backend contract (unchanged): GET /api/interviews
 */
export function useInterviewHistory() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);

  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const token = await getTokenRef.current();
        const response = await apiRequest("/api/interviews", {
          token,
          signal: controller.signal,
        });

        setInterviews(asArray(response?.data));
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
  }, [reloadKey]);

  function reload() {
    setStatus("loading");
    setError(null);
    setReloadKey((key) => key + 1);
  }

  return { status, error, interviews, reload };
}