import {
  LIMITS,
  joinDegree,
  mergeSkills,
  normalizeName,
  uniqueItems,
} from "@/features/onboarding/onboarding-data";

/**
 * Helpers for the Profile page.
 *
 * The form shape is the same one onboarding uses (see
 * features/onboarding/onboarding-data.js), so a profile saved in either
 * place loads correctly in the other.
 *
 * Mapping to the existing API (PUT /api/profile, unchanged):
 *   fullName  -> Clerk account (not part of the profile API)
 *   branch    -> saved inside `degree` as "Degree | Branch"
 *   languages -> saved inside `skills`
 */

/* =========================================================
   COMPLETION (same 8-field rule as guidio-backend dashboard-service.js)
   ========================================================= */

const COMPLETION_FIELDS = [
  { id: "education", label: "Education level", isDone: (form) => Boolean(form.education) },
  { id: "college", label: "College, university or institute", isDone: (form) => Boolean(form.college.trim()) },
  { id: "degree", label: "Degree", isDone: (form) => Boolean(form.degree.trim()) },
  { id: "graduationYear", label: "Graduation year", isDone: (form) => Boolean(form.graduationYear) },
  { id: "experienceLevel", label: "Experience level", isDone: (form) => Boolean(form.experienceLevel) },
  { id: "targetRole", label: "Target role", isDone: (form) => Boolean(form.targetRole.trim()) },
  {
    id: "skills",
    label: "Skills",
    isDone: (form) => mergeSkills(form.skills, form.languages).length > 0,
  },
  { id: "interests", label: "Interests", isDone: (form) => form.interests.length > 0 },
];

export function getProfileCompletion(form) {
  const items = COMPLETION_FIELDS.map((field) => ({
    id: field.id,
    label: field.label,
    done: field.isDone(form),
  }));

  const done = items.filter((item) => item.done).length;

  return {
    items,
    done,
    total: items.length,
    percent: Math.round((done / items.length) * 100),
  };
}

/* =========================================================
   NORMALISING AND COMPARING
   ========================================================= */

/** Trims text and removes duplicate chips. Used before saving and comparing. */
export function normalizeForm(form) {
  return {
    ...form,
    fullName: normalizeName(form.fullName),
    college: form.college.trim(),
    degree: form.degree.trim(),
    branch: form.branch.trim(),
    graduationYear: form.graduationYear.trim(),
    targetRole: form.targetRole.trim(),
    skills: uniqueItems(form.skills),
    languages: uniqueItems(form.languages),
    interests: uniqueItems(form.interests),
  };
}

/**
 * The field of study only changes which suggestions are shown and is never
 * saved, so changing it must not count as an unsaved change.
 */
function comparableForm(form) {
  return JSON.stringify({ ...normalizeForm(form), field: "" });
}

export function isFormDirty(form, savedForm) {
  return comparableForm(form) !== comparableForm(savedForm);
}

/* =========================================================
   VALIDATION (mirrors guidio-backend/src/middleware/validate-profile.js)
   Nothing is required, because a profile can be filled in step by
   step. Anything that is filled in must be valid.
   ========================================================= */

export function validateProfileForm(form) {
  const errors = {};
  const data = normalizeForm(form);

  if (data.fullName) {
    if (data.fullName.length < 2) {
      errors.fullName = "Enter your full name.";
    } else if (data.fullName.length > LIMITS.fullName) {
      errors.fullName = `Your name must be ${LIMITS.fullName} characters or fewer.`;
    }
  }

  if (data.college.length > LIMITS.college) {
    errors.college = `Must be ${LIMITS.college} characters or fewer.`;
  }

  if (!data.degree && data.branch) {
    errors.degree = "Enter your degree before adding a branch.";
  } else if (joinDegree(data.degree, data.branch).length > LIMITS.degree) {
    errors.degree = `Degree and branch together must be ${LIMITS.degree} characters or fewer.`;
  }

  if (data.graduationYear) {
    if (!/^\d{4}$/.test(data.graduationYear)) {
      errors.graduationYear = "Enter a 4-digit year, for example 2027.";
    } else if (
      Number(data.graduationYear) < LIMITS.minGraduationYear ||
      Number(data.graduationYear) > LIMITS.maxGraduationYear
    ) {
      errors.graduationYear = `Enter a year between ${LIMITS.minGraduationYear} and ${LIMITS.maxGraduationYear}.`;
    }
  }

  if (data.targetRole.length > LIMITS.targetRole) {
    errors.targetRole = `Must be ${LIMITS.targetRole} characters or fewer.`;
  }

  if (mergeSkills(data.skills, data.languages).length > LIMITS.maxSkills) {
    errors.skills = `You can add up to ${LIMITS.maxSkills} skills in total.`;
  }

  if (data.interests.length > LIMITS.maxInterests) {
    errors.interests = `You can add up to ${LIMITS.maxInterests} interests.`;
  }

  return errors;
}

/* =========================================================
   API BODY
   ========================================================= */

/**
 * The complete body for PUT /api/profile. Empty answers are sent as null,
 * which the existing endpoint already accepts (the previous profile page
 * did the same).
 */
export function buildProfilePayload(form) {
  const data = normalizeForm(form);

  return {
    education: data.education || null,
    college: data.college || null,
    degree: joinDegree(data.degree, data.branch) || null,
    graduationYear: data.graduationYear ? Number(data.graduationYear) : null,
    experienceLevel: data.experienceLevel || null,
    targetRole: data.targetRole || null,
    skills: mergeSkills(data.skills, data.languages),
    interests: data.interests,
  };
}