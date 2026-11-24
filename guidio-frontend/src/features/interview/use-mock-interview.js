import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { apiRequest } from "@/lib/api-client";
import { getFriendlyAiError } from "@/lib/ai";
import { useCooldown } from "@/hooks/use-cooldown";
import {
  ANSWER_MIN_LENGTH,
  INITIAL_SETUP,
  ROLE_MIN_LENGTH,
  asArray,
  getCurrentQuestion,
  toHistoryItem,
} from "./interview-utils";

const PROFILE_ENDPOINT = "/api/profile";
const INTERVIEWS_ENDPOINT = "/api/interviews";

function interviewUrl(id) {
  return `${INTERVIEWS_ENDPOINT}/${encodeURIComponent(id)}`;
}

function answerUrl(sessionId, questionId) {
  return `${interviewUrl(sessionId)}/questions/${encodeURIComponent(questionId)}/answer`;
}

function mergeHistoryItem(items, session) {
  return items.map((item) =>
    item.id === session.id ? { ...item, ...toHistoryItem(session) } : item
  );
}

/**
 * State and API calls for the Mock Interview page.
 *
 * Backend contract (unchanged):
 *   GET  /api/profile
 *   GET  /api/interviews                        history (summaries)
 *   GET  /api/interviews/:id                    one full interview
 *   POST /api/interviews                        body { interviewType, targetRole, difficulty }
 *        -> { session, firstQuestion }
 *   POST /api/interviews/:id/questions/:questionId/answer   body { answerText }
 *        -> { answer, isCompleted, session, nextQuestion }
 *
 * What the user typed (the setup form and the answer) lives here, so a failed
 * request, including a 429 rate limit, never clears it.
 */
export function useMockInterview() {
  const { getToken } = useAuth();
  const cooldown = useCooldown();

  const getTokenRef = useRef(getToken);
  const startingRef = useRef(false);
  const submittingRef = useRef(false);
  const openRequestRef = useRef(0);

  const [status, setStatus] = useState("loading");
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [profileRole, setProfileRole] = useState("");
  const [interviews, setInterviews] = useState([]);
  const [setup, setSetup] = useState(INITIAL_SETUP);

  const [activeInterview, setActiveInterview] = useState(null);
  const [viewedQuestionId, setViewedQuestionId] = useState(null);
  const [answerText, setAnswerText] = useState("");

  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [isOpening, setIsOpening] = useState(false);
  const [openError, setOpenError] = useState(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      try {
        const token = await getTokenRef.current();

        const [profileResponse, interviewsResponse] = await Promise.all([
          apiRequest(PROFILE_ENDPOINT, { token, signal }),
          apiRequest(INTERVIEWS_ENDPOINT, { token, signal }),
        ]);

        const savedRole = profileResponse?.data?.targetRole?.trim() ?? "";

        setProfileRole(savedRole);
        setInterviews(asArray(interviewsResponse?.data));

        // Start with the saved role, unless the user already typed one.
        if (savedRole) {
          setSetup((current) =>
            current.targetRole ? current : { ...current, targetRole: savedRole }
          );
        }

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

  function updateSetup(field, value) {
    setSetup((current) => ({ ...current, [field]: value }));
  }

  /* ---------------------------------------------------------------------- */
  /* Start                                                                   */
  /* ---------------------------------------------------------------------- */

  async function refreshHistory() {
    try {
      const token = await getTokenRef.current();
      const response = await apiRequest(INTERVIEWS_ENDPOINT, { token });

      setInterviews(asArray(response?.data));
    } catch {
      // The list is only a convenience. Keep what is already on screen.
    }
  }

  async function startInterview() {
    const role = setup.targetRole.trim();

    if (
      startingRef.current ||
      submittingRef.current ||
      cooldown.isCoolingDown ||
      role.length < ROLE_MIN_LENGTH
    ) {
      return;
    }

    startingRef.current = true;
    setIsStarting(true);
    setStartError(null);

    try {
      const token = await getTokenRef.current();

      const response = await apiRequest(INTERVIEWS_ENDPOINT, {
        method: "POST",
        token,
        body: {
          interviewType: setup.interviewType,
          targetRole: role,
          difficulty: setup.difficulty,
        },
      });

      const { session, firstQuestion } = response?.data ?? {};

      if (!session?.id || !firstQuestion?.id) {
        throw new Error("The server sent an unexpected response.");
      }

      setActiveInterview({ ...session, questions: [firstQuestion] });
      setViewedQuestionId(null);
      setAnswerText("");
      setSubmitError(null);
      setInterviews((current) => [
        toHistoryItem(session),
        ...current.filter((item) => item.id !== session.id),
      ]);
    } catch (error) {
      // The setup form keeps everything the user chose.
      setStartError(error);

      const friendly = getFriendlyAiError(error);

      if (friendly.kind === "rate_limited") {
        cooldown.start(friendly.retryAfterSeconds);
      }

      // The server creates the interview before the AI writes the first
      // question, so a failed start can still leave one in the history.
      await refreshHistory();
    } finally {
      startingRef.current = false;
      setIsStarting(false);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Open, refresh and leave                                                 */
  /* ---------------------------------------------------------------------- */

  async function openInterview(id) {
    if (startingRef.current || submittingRef.current) return;

    const requestId = ++openRequestRef.current;

    setIsOpening(true);
    setOpenError(null);

    try {
      const token = await getTokenRef.current();
      const response = await apiRequest(interviewUrl(id), { token });

      if (requestId !== openRequestRef.current) return;

      const interview = response?.data;

      if (!interview?.id) {
        throw new Error("The server sent an unexpected response.");
      }

      setActiveInterview(interview);
      setViewedQuestionId(null);
      setAnswerText("");
      setSubmitError(null);
    } catch (error) {
      if (requestId !== openRequestRef.current) return;

      setOpenError(error);
    } finally {
      if (requestId === openRequestRef.current) {
        setIsOpening(false);
      }
    }
  }

  async function refreshInterview() {
    const id = activeInterview?.id;

    if (!id || isRefreshing) return;

    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const token = await getTokenRef.current();
      const response = await apiRequest(interviewUrl(id), { token });
      const fresh = response?.data;

      if (fresh?.id === id) {
        setActiveInterview(fresh);
        setInterviews((current) => mergeHistoryItem(current, fresh));
      }
    } catch (error) {
      setRefreshError(error);
    } finally {
      setIsRefreshing(false);
    }
  }

  function leaveInterview() {
    if (submittingRef.current) return;

    // Ignore any interview that is still being opened.
    openRequestRef.current += 1;

    setIsOpening(false);
    setActiveInterview(null);
    setViewedQuestionId(null);
    setAnswerText("");
    setSubmitError(null);
    setStartError(null);
    setOpenError(null);
    setRefreshError(null);
  }

  // null shows the open question. A question id shows that answered question.
  function selectQuestion(questionId) {
    setViewedQuestionId(questionId);
  }

  /* ---------------------------------------------------------------------- */
  /* Submit an answer                                                        */
  /* ---------------------------------------------------------------------- */

  async function submitAnswer() {
    const interview = activeInterview;
    const question = getCurrentQuestion(interview);
    const text = answerText.trim();

    if (
      !interview ||
      !question ||
      submittingRef.current ||
      cooldown.isCoolingDown ||
      text.length < ANSWER_MIN_LENGTH
    ) {
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const token = await getTokenRef.current();

      const response = await apiRequest(answerUrl(interview.id, question.id), {
        method: "POST",
        token,
        body: { answerText: text },
      });

      const result = response?.data;

      if (!result?.answer || !result?.session) {
        throw new Error("The server sent an unexpected response.");
      }

      if (result.isCompleted) {
        setActiveInterview(result.session);
        setViewedQuestionId(null);
      } else {
        setActiveInterview((current) => {
          if (!current) return current;

          const questions = asArray(current.questions).map((item) =>
            item.id === question.id ? { ...item, answer: result.answer } : item
          );

          return {
            ...current,
            currentQuestion: result.session.currentQuestion,
            questions: result.nextQuestion
              ? [...questions, result.nextQuestion]
              : questions,
          };
        });

        // Show the feedback for the answer that was just scored.
        setViewedQuestionId(question.id);
      }

      setAnswerText("");
      setInterviews((current) => mergeHistoryItem(current, result.session));
    } catch (error) {
      // The answer stays in the box so the user can send it again.
      setSubmitError(error);

      const friendly = getFriendlyAiError(error);

      if (friendly.kind === "rate_limited") {
        cooldown.start(friendly.retryAfterSeconds);
      }

      // The server saves an answer before it prepares the next question, and
      // a slow request can time out here after the server already finished.
      // Check what was really saved so the screen never disagrees with it.
      try {
        const token = await getTokenRef.current();
        const response = await apiRequest(interviewUrl(interview.id), { token });
        const fresh = response?.data;

        const wasSaved =
          fresh?.id === interview.id &&
          asArray(fresh.questions).some(
            (item) => item.id === question.id && item.answer
          );

        if (wasSaved) {
          setActiveInterview(fresh);
          setInterviews((current) => mergeHistoryItem(current, fresh));
          setViewedQuestionId(question.id);
          setAnswerText("");
          setSubmitError(null);
        }
      } catch {
        // Keep the original error on screen.
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return {
    status,
    loadError,
    reload,

    profileRole,
    interviews,

    setup,
    updateSetup,
    canStart: setup.targetRole.trim().length >= ROLE_MIN_LENGTH,

    activeInterview,
    viewedQuestionId,
    selectQuestion,
    leaveInterview,

    answerText,
    setAnswerText,

    isStarting,
    startError,
    startInterview,

    isSubmitting,
    submitError,
    submitAnswer,

    isOpening,
    openError,
    openInterview,

    isRefreshing,
    refreshError,
    refreshInterview,

    cooldown,
    isBusy: isStarting || isSubmitting || isOpening,
  };
}