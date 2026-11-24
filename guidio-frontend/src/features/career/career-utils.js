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

export function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

// Colour is used only to show difficulty. Everything else stays black and white.
export const DIFFICULTY_STYLES = {
  Beginner: "bg-success/10 text-success",
  Intermediate: "bg-warning/10 text-warning",
  Advanced: "bg-destructive/10 text-destructive",
};

/**
 * The same five checks the page used before. The server builds the plan from
 * the saved profile, so these are the exact inputs it will use.
 */
export function getProfileChecks(profile) {
  return [
    {
      key: "education",
      label: "Education and degree",
      done: Boolean(profile?.education && profile?.degree),
    },
    {
      key: "experience",
      label: "Experience level",
      done: Boolean(profile?.experienceLevel),
    },
    {
      key: "targetRole",
      label: "Target role",
      done: Boolean(profile?.targetRole),
    },
    {
      key: "skills",
      label: "Skills",
      done: asArray(profile?.skills).length > 0,
    },
    {
      key: "interests",
      label: "Career interests",
      done: asArray(profile?.interests).length > 0,
    },
  ];
}

export function isProfileReady(profile) {
  return getProfileChecks(profile).every((check) => check.done);
}