import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { apiRequest } from "@/lib/api-client";
import { getFriendlyAiError } from "@/lib/ai";
import { useCooldown } from "@/hooks/use-cooldown";
import { isProfileReady } from "./career-utils";

const PROFILE_ENDPOINT = "/api/profile";
const PLANS_ENDPOINT = "/api/career/plans";

function planUrl(id) {
  return `${PLANS_ENDPOINT}/${encodeURIComponent(id)}`;
}

function toSummary(plan) {
  return {
    id: plan.id,
    targetRole: plan.targetRole,
    primaryRole: plan.primaryRole,
    readinessScore: plan.readinessScore,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

/**
 * State and API calls for Career Guidance.
 *
 * Backend contract (unchanged):
 *   GET  /api/profile
 *   GET  /api/career/plans          list of saved plans (summaries)
 *   GET  /api/career/plans/:id      one full plan
 *   POST /api/career/plans          body {} - the server builds the plan from
 *        the saved profile
 */
export function useCareerGuidance() {
  const { getToken } = useAuth();
  const cooldown = useCooldown();

  const getTokenRef = useRef(getToken);

  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [profile, setProfile] = useState(null);
  const [plans, setPlans] = useState([]);
  const [activePlan, setActivePlan] = useState(null);

  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  const generatingRef = useRef(false);
  const planRequestRef = useRef(0);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      try {
        const token = await getTokenRef.current();

        const [profileResponse, plansResponse] = await Promise.all([
          apiRequest(PROFILE_ENDPOINT, { token, signal }),
          apiRequest(PLANS_ENDPOINT, { token, signal }),
        ]);

        const list = Array.isArray(plansResponse?.data)
          ? plansResponse.data
          : [];

        let latest = null;
        let latestError = "";

        // Show the newest saved plan straight away.
        if (list.length > 0) {
          try {
            const latestResponse = await apiRequest(planUrl(list[0].id), {
              token,
              signal,
            });
            latest = latestResponse?.data ?? null;
          } catch (error) {
            if (error?.name === "AbortError") return;
            latestError =
              error?.message || "Unable to load your latest career plan.";
          }
        }

        setProfile(profileResponse?.data ?? null);
        setPlans(list);
        setActivePlan(latest);
        setPlanError(latestError);
        setLoadError(null);
        setStatus("ready");
      } catch (error) {
        if (error?.name === "AbortError") return;

        setLoadError(error);
        setStatus("error");
      }
    }

    load();

    return () => controller.abort();
  }, [reloadKey]);

  function reload() {
    setStatus("loading");
    setLoadError(null);
    setReloadKey((key) => key + 1);
  }

  async function generatePlan() {
    if (generatingRef.current || cooldown.isCoolingDown) return;

    generatingRef.current = true;
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const token = await getTokenRef.current();
      const response = await apiRequest(PLANS_ENDPOINT, {
        method: "POST",
        token,
        body: {},
      });

      const plan = response?.data;

      if (!plan?.id) {
        throw new Error("The server sent an unexpected response.");
      }

      // Ignore any plan that was still loading from the history.
      planRequestRef.current += 1;

      setActivePlan(plan);
      setIsLoadingPlan(false);
      setPlanError("");
      setPlans((current) => [
        toSummary(plan),
        ...current.filter((item) => item.id !== plan.id),
      ]);
    } catch (error) {
      // The plan that is already on screen stays there.
      setGenerateError(error);

      const friendly = getFriendlyAiError(error);

      if (friendly.kind === "rate_limited") {
        cooldown.start(friendly.retryAfterSeconds);
      }
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  }

  async function selectPlan(id) {
    if (generatingRef.current || id === activePlan?.id) return;

    const requestId = ++planRequestRef.current;

    setIsLoadingPlan(true);
    setPlanError("");

    try {
      const token = await getTokenRef.current();
      const response = await apiRequest(planUrl(id), { token });

      if (requestId !== planRequestRef.current) return;

      setActivePlan(response?.data ?? null);
    } catch (error) {
      if (requestId !== planRequestRef.current) return;

      setPlanError(error?.message || "Unable to load this career plan.");
    } finally {
      if (requestId === planRequestRef.current) {
        setIsLoadingPlan(false);
      }
    }
  }

  return {
    status,
    loadError,
    reload,
    profile,
    canGenerate: isProfileReady(profile),
    plans,
    activePlan,
    isLoadingPlan,
    planError,
    isGenerating,
    generateError,
    cooldown,
    generatePlan,
    selectPlan,
  };
}