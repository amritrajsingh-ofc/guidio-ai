import {
  BarChart3,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarCheck2,
  Mic,
  UserRound,
} from "lucide-react";
import { getSafeRedirect } from "@/features/auth/auth-redirect";

/* ---------- small helpers ---------- */

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function countOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

export function clampPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(number)));
}

/** "Just now", "5m ago", "3h ago", "2d ago", or a date for older items. */
export function formatRelativeTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return formatDate(value);
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

/** Only same-site paths are used for links that come from the server. */
export function getSafeHref(href) {
  return getSafeRedirect(href) ?? "/dashboard";
}

/* ---------- labels and icons ---------- */

const ACTIVITY_ICONS = {
  profile: UserRound,
  assistant: BrainCircuit,
  career: BriefcaseBusiness,
  skillGap: BarChart3,
  interview: Mic,
};

export function getActivityIcon(type) {
  return Object.hasOwn(ACTIVITY_ICONS, type)
    ? ACTIVITY_ICONS[type]
    : CalendarCheck2;
}

const INTERVIEW_STATUS_LABELS = {
  COMPLETED: "Completed",
  IN_PROGRESS: "In progress",
};

export function getInterviewStatusLabel(status) {
  return Object.hasOwn(INTERVIEW_STATUS_LABELS, status)
    ? INTERVIEW_STATUS_LABELS[status]
    : "Unknown";
}

export function getReadinessLabel(score) {
  if (score < 40) return "Early stage";
  if (score < 70) return "Making progress";
  return "Strong progress";
}

export const QUICK_ACTIONS = [
  {
    title: "Ask AI Assistant",
    description: "Get help with your studies, concepts or career questions.",
    href: "/assistant",
    icon: BrainCircuit,
  },
  {
    title: "Skill Gap Analysis",
    description: "Compare your skills with a target role.",
    href: "/skill-gap",
    icon: BarChart3,
  },
  {
    title: "Career Guidance",
    description: "Explore roles and get a personalised roadmap.",
    href: "/career-guidance",
    icon: BriefcaseBusiness,
  },
  {
    title: "Mock Interview",
    description: "Practise answering role-based questions.",
    href: "/mock-interview",
    icon: Mic,
  },
];

/* ---------- data shaping ---------- */

/**
 * Makes the API response safe to render. Missing numbers become null
 * (shown as an em dash or an empty state), never an invented value.
 */
export function normalizeDashboard(raw) {
  const profile = raw?.profile ?? {};
  const metrics = raw?.metrics ?? {};
  const latest = raw?.latest ?? {};

  return {
    profile: {
      completion: clampPercent(profile.completion),
      targetRole: profile.targetRole || null,
      skillsCount: countOrZero(profile.skillsCount),
      interestsCount: countOrZero(profile.interestsCount),
      education: profile.education || null,
      degree: profile.degree || null,
      experienceLevel: profile.experienceLevel || null,
    },

    metrics: {
      readinessScore: numberOrNull(metrics.readinessScore),
      interviewsTaken: countOrZero(metrics.interviewsTaken),
      completedInterviews: countOrZero(metrics.completedInterviews),
      averageInterviewScore: numberOrNull(metrics.averageInterviewScore),
      doubtsAsked: countOrZero(metrics.doubtsAsked),
      skillMatch: numberOrNull(metrics.skillMatch),
    },

    latest: {
      skillGapReport: latest.skillGapReport ?? null,
      careerPlan: latest.careerPlan ?? null,
      interview: latest.interview ?? null,
    },

    activities: Array.isArray(raw?.activities) ? raw.activities : [],
  };
}

/**
 * The backend returns 0 when there is nothing to base a score on.
 * A student with no profile data, no skill report and no interviews
 * has no readiness score yet, so we return null for that case.
 */
export function getReadinessScore(dashboard) {
  const { profile, metrics } = dashboard;

  const hasData =
    profile.completion > 0 ||
    metrics.skillMatch !== null ||
    metrics.averageInterviewScore !== null;

  return hasData ? metrics.readinessScore : null;
}

/**
 * Rule-based checklist built only from the student's real data.
 * This is not AI output. Returns at most four steps.
 */
export function getNextSteps(dashboard) {
  const { profile, metrics, latest } = dashboard;
  const steps = [];

  if (profile.completion < 100) {
    steps.push({
      id: "profile",
      title: "Complete your profile",
      description: "Add the missing details so guidance fits your goals.",
      href: "/onboarding",
      icon: UserRound,
    });
  }

  if (!latest.skillGapReport) {
    steps.push({
      id: "skill-gap",
      title: "Run a skill gap analysis",
      description: "See which skills you still need for your target role.",
      href: "/skill-gap",
      icon: BarChart3,
    });
  }

  if (!latest.careerPlan) {
    steps.push({
      id: "career",
      title: "Generate a career roadmap",
      description: "Get recommended roles and a step-by-step plan.",
      href: "/career-guidance",
      icon: BriefcaseBusiness,
    });
  }

  if (!latest.interview) {
    steps.push({
      id: "interview",
      title: "Take a mock interview",
      description: "Practise with role-based questions and get feedback.",
      href: "/mock-interview",
      icon: Mic,
    });
  } else if (latest.interview.status !== "COMPLETED") {
    steps.push({
      id: "interview",
      title: "Finish your mock interview",
      description: "Your latest interview is not completed yet.",
      href: "/mock-interview",
      icon: Mic,
    });
  }

  if (metrics.doubtsAsked === 0) {
    steps.push({
      id: "assistant",
      title: "Ask the AI Assistant a question",
      description: "Try a question about a concept, your studies or your career.",
      href: "/assistant",
      icon: BrainCircuit,
    });
  }

  return steps.slice(0, 4);
}