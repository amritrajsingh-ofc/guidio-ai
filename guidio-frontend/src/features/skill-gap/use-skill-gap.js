import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { apiRequest } from "@/lib/api-client";
import { getFriendlyAiError } from "@/lib/ai";
import { useCooldown } from "@/hooks/use-cooldown";

const PROFILE_ENDPOINT = "/api/profile";
const REPORTS_ENDPOINT = "/api/skill-gap/reports";

function reportUrl(id) {
  return `${REPORTS_ENDPOINT}/${encodeURIComponent(id)}`;
}

function toSummary(report) {
  return {
    id: report.id,
    targetRole: report.targetRole,
    matchPercentage: report.matchPercentage,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

/**
 * State and API calls for Skill Gap Analysis.
 *
 * Backend contract (unchanged):
 *   GET  /api/profile
 *   GET  /api/skill-gap/reports            list of saved reports (summaries)
 *   GET  /api/skill-gap/reports/:id        one full report
 *   POST /api/skill-gap/reports            body {} - the server builds the
 *        analysis from the saved profile (target role and skills)
 */
export function useSkillGap() {
  const { getToken } = useAuth();
  const cooldown = useCooldown();

  const getTokenRef = useRef(getToken);

  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [profile, setProfile] = useState(null);
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);

  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportError, setReportError] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  const generatingRef = useRef(false);
  const reportRequestRef = useRef(0);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      try {
        const token = await getTokenRef.current();

        const [profileResponse, reportsResponse] = await Promise.all([
          apiRequest(PROFILE_ENDPOINT, { token, signal }),
          apiRequest(REPORTS_ENDPOINT, { token, signal }),
        ]);

        const list = Array.isArray(reportsResponse?.data)
          ? reportsResponse.data
          : [];

        let latest = null;
        let latestError = "";

        // Show the newest saved report straight away.
        if (list.length > 0) {
          try {
            const latestResponse = await apiRequest(reportUrl(list[0].id), {
              token,
              signal,
            });
            latest = latestResponse?.data ?? null;
          } catch (error) {
            if (error?.name === "AbortError") return;
            latestError =
              error?.message || "Unable to load your latest report.";
          }
        }

        setProfile(profileResponse?.data ?? null);
        setReports(list);
        setActiveReport(latest);
        setReportError(latestError);
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

  async function generateReport() {
    if (generatingRef.current || cooldown.isCoolingDown) return;

    generatingRef.current = true;
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const token = await getTokenRef.current();
      const response = await apiRequest(REPORTS_ENDPOINT, {
        method: "POST",
        token,
        body: {},
      });

      const report = response?.data;

      if (!report?.id) {
        throw new Error("The server sent an unexpected response.");
      }

      // Ignore any report that was still loading from the history.
      reportRequestRef.current += 1;

      setActiveReport(report);
      setIsLoadingReport(false);
      setReportError("");
      setReports((current) => [
        toSummary(report),
        ...current.filter((item) => item.id !== report.id),
      ]);
    } catch (error) {
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

  async function selectReport(id) {
    if (generatingRef.current || id === activeReport?.id) return;

    const requestId = ++reportRequestRef.current;

    setIsLoadingReport(true);
    setReportError("");

    try {
      const token = await getTokenRef.current();
      const response = await apiRequest(reportUrl(id), { token });

      if (requestId !== reportRequestRef.current) return;

      setActiveReport(response?.data ?? null);
    } catch (error) {
      if (requestId !== reportRequestRef.current) return;

      setReportError(error?.message || "Unable to load this report.");
    } finally {
      if (requestId === reportRequestRef.current) {
        setIsLoadingReport(false);
      }
    }
  }

  const canAnalyze = Boolean(profile?.targetRole && profile?.skills?.length);

  return {
    status,
    loadError,
    reload,
    profile,
    canAnalyze,
    reports,
    activeReport,
    isLoadingReport,
    reportError,
    dismissReportError: () => setReportError(""),
    isGenerating,
    generateError,
    cooldown,
    generateReport,
    selectReport,
  };
}