// The server decides how many questions an interview has. It is fixed at 5.
export const QUESTION_COUNT = 5;

// These limits match the server validation, so the form never sends a
// request that the server will reject.
export const ROLE_MIN_LENGTH = 2;
export const ROLE_MAX_LENGTH = 120;
export const ANSWER_MIN_LENGTH = 10;
export const ANSWER_MAX_LENGTH = 8000;

export const INITIAL_SETUP = {
  interviewType: "Technical",
  targetRole: "",
  difficulty: "Medium",
};

// Values must stay exactly as the server expects them.
export const INTERVIEW_TYPES = [
  {
    value: "Technical",
    label: "Technical",
    description: "Subject knowledge and scenarios for your role",
  },
  {
    value: "HR",
    label: "HR",
    description: "Background, motivation and teamwork",
  },
  {
    value: "Mixed",
    label: "Mixed",
    description: "Role knowledge and HR questions together",
  },
];

export const DIFFICULTIES = [
  {
    value: "Beginner",
    label: "Beginner",
    description: "Fundamentals and common questions",
  },
  {
    value: "Medium",
    label: "Medium",
    description: "A typical interview level",
  },
  {
    value: "Hard",
    label: "Hard",
    description: "Challenging, in-depth questions",
  },
];

export const SCORE_DIMENSIONS = [
  { key: "technicalScore", label: "Subject knowledge" },
  { key: "communicationScore", label: "Communication" },
  { key: "structureScore", label: "Structure" },
  { key: "confidenceScore", label: "Confidence" },
  { key: "relevanceScore", label: "Relevance" },
];

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

// Colour is used only to show how good a score is.
export function getScoreTone(score) {
  const value = clampScore(score);

  if (value >= 80) {
    return { text: "text-success", badge: "bg-success/10 text-success", bar: "bg-success" };
  }

  if (value >= 60) {
    return { text: "text-warning", badge: "bg-warning/10 text-warning", bar: "bg-warning" };
  }

  return {
    text: "text-destructive",
    badge: "bg-destructive/10 text-destructive",
    bar: "bg-destructive",
  };
}

/** The first question that has no answer yet, or null. */
export function getCurrentQuestion(interview) {
  return asArray(interview?.questions).find((question) => !question.answer) ?? null;
}

export function getAnsweredCount(interview) {
  return asArray(interview?.questions).filter((question) => question.answer).length;
}

/**
 * An interview that is still in progress but has no open question.
 * It happens when the AI could not prepare the next question (for example
 * when the free limit was reached) after an answer had already been saved.
 */
export function isStalled(interview) {
  return interview?.status === "IN_PROGRESS" && !getCurrentQuestion(interview);
}

/**
 * One entry for each question of the interview, in order.
 * status is "answered", "current" or "upcoming".
 */
export function getQuestionSteps(interview) {
  const questions = asArray(interview?.questions);
  const total = Math.max(Number(interview?.totalQuestions) || QUESTION_COUNT, questions.length);
  const current = getCurrentQuestion(interview);

  return Array.from({ length: total }, (_, index) => {
    const number = index + 1;
    const question =
      questions.find((item) => item.order === number) ?? questions[index] ?? null;

    let status = "upcoming";

    if (question?.answer) {
      status = "answered";
    } else if (question && current && question.id === current.id) {
      status = "current";
    }

    return { number, question, status };
  });
}

/**
 * Average of each score across the answered questions. It uses only the
 * scores the AI saved, nothing is estimated. Returns [] when there are none.
 */
export function getAverageScores(interview) {
  const answers = asArray(interview?.questions)
    .map((question) => question.answer)
    .filter(Boolean);

  if (answers.length === 0) return [];

  return SCORE_DIMENSIONS.map(({ key, label }) => {
    const values = answers.map((answer) => Number(answer[key])).filter(Number.isFinite);

    if (values.length === 0) return null;

    const total = values.reduce((sum, value) => sum + value, 0);

    return { key, label, value: Math.round(total / values.length) };
  }).filter(Boolean);
}

/** The fields the history list needs, taken from a full session. */
export function toHistoryItem(session) {
  return {
    id: session.id,
    interviewType: session.interviewType,
    targetRole: session.targetRole,
    difficulty: session.difficulty,
    status: session.status,
    totalQuestions: session.totalQuestions,
    currentQuestion: session.currentQuestion,
    overallScore: session.overallScore ?? null,
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    createdAt: session.createdAt,
  };
}