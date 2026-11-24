/**
 * Onboarding data, validation and the mapping to the existing profile API.
 *
 * The backend (PUT /api/profile) accepts exactly these fields:
 *   education, college, degree, graduationYear, experienceLevel,
 *   targetRole, skills[], interests[]
 *
 * The onboarding form collects a few extra answers. Until Phase Two adds
 * real fields for them, they are stored like this (no fake persistence):
 *   fullName   -> saved to the Clerk account (first name + last name)
 *   branch     -> saved inside `degree` as "Degree | Branch"
 *   languages  -> saved inside `skills` (split back out when loading)
 *   field      -> not saved. It only chooses which suggestions are shown
 *                 (see field-data.js) and is guessed again when loading.
 */

import { inferFieldId } from "@/features/onboarding/field-data";

/* =========================================================
   LIMITS (mirror guidio-backend/src/middleware/validate-profile.js)
   ========================================================= */

export const LIMITS = {
  fullName: 80,
  college: 150,
  degree: 120,
  targetRole: 120,
  skill: 60,
  maxSkills: 50,
  interest: 80,
  maxInterests: 30,
  minGraduationYear: 2000,
  maxGraduationYear: 2100,
};

const DEGREE_SEPARATOR = " | ";

/* =========================================================
   OPTIONS
   ========================================================= */

export const EDUCATION_OPTIONS = [
  { value: "High School", label: "High School" },
  { value: "Diploma", label: "Diploma" },
  { value: "Undergraduate", label: "Undergraduate" },
  { value: "Postgraduate", label: "Postgraduate" },
  { value: "Other", label: "Other" },
];

export const EXPERIENCE_OPTIONS = [
  { value: "Beginner", label: "Beginner", description: "Just starting out" },
  { value: "Student", label: "Student", description: "Learning and building" },
  { value: "Fresher", label: "Fresher", description: "Ready for a first job" },
  {
    value: "Intermediate",
    label: "Intermediate",
    description: "Internships or projects",
  },
  { value: "Experienced", label: "Experienced", description: "Working professional" },
];

export const PROGRAMMING_LANGUAGES = [
  "Python",
  "Java",
  "JavaScript",
  "TypeScript",
  "C",
  "C++",
  "C#",
  "Go",
  "Rust",
  "Kotlin",
  "Swift",
  "PHP",
  "Ruby",
  "SQL",
  "R",
  "Dart",
];

/* =========================================================
   STEPS
   ========================================================= */

export const STEPS = [
  {
    id: "basics",
    title: "About you",
    description: "Tell us who you are and where you study.",
  },
  {
    id: "academics",
    title: "Academics",
    description: "Your degree, graduation year and experience.",
  },
  {
    id: "skills",
    title: "Skills",
    description: "What you already know. This powers your skill-gap analysis.",
  },
  {
    id: "direction",
    title: "Career direction",
    description: "Where you want to go. This personalises your guidance.",
  },
];

/* =========================================================
   FORM <-> PROFILE MAPPING
   ========================================================= */

const LANGUAGE_LOOKUP = new Map(
  PROGRAMMING_LANGUAGES.map((language) => [language.toLowerCase(), language])
);

export function createEmptyForm(fullName = "") {
  return {
    fullName,
    field: "",
    education: "",
    college: "",
    degree: "",
    branch: "",
    graduationYear: "",
    experienceLevel: "",
    skills: [],
    languages: [],
    interests: [],
    targetRole: "",
  };
}

/** Removes duplicates, ignoring letter case. Keeps the first spelling. */
export function uniqueItems(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = item.trim().toLowerCase();

    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(item.trim());
  }

  return result;
}

export function joinDegree(degree, branch) {
  const cleanDegree = degree.replaceAll("|", "/").trim();
  const cleanBranch = branch.replaceAll("|", "/").trim();

  return cleanBranch ? `${cleanDegree}${DEGREE_SEPARATOR}${cleanBranch}` : cleanDegree;
}

export function splitDegree(value) {
  const text = typeof value === "string" ? value : "";
  const index = text.indexOf(DEGREE_SEPARATOR);

  if (index === -1) {
    return { degree: text.trim(), branch: "" };
  }

  return {
    degree: text.slice(0, index).trim(),
    branch: text.slice(index + DEGREE_SEPARATOR.length).trim(),
  };
}

export function mergeSkills(skills, languages) {
  return uniqueItems([...skills, ...languages]);
}

/** Splits the saved `skills` list back into skills and programming languages. */
export function splitSkills(all) {
  const skills = [];
  const languages = [];

  for (const item of all) {
    const language = LANGUAGE_LOOKUP.get(item.trim().toLowerCase());

    if (language) {
      languages.push(language);
    } else {
      skills.push(item);
    }
  }

  return { skills: uniqueItems(skills), languages: uniqueItems(languages) };
}

/** Builds the form from the saved profile (or null for a brand new student). */
export function profileToForm(profile, fullName = "") {
  const form = createEmptyForm(fullName);

  if (!profile) return form;

  const { degree, branch } = splitDegree(profile.degree);
  const { skills, languages } = splitSkills(
    Array.isArray(profile.skills) ? profile.skills : []
  );

  return {
    ...form,
    field: inferFieldId({
      degree,
      branch,
      targetRole: profile.targetRole || "",
    }),
    education: profile.education || "",
    college: profile.college || "",
    degree,
    branch,
    graduationYear: profile.graduationYear ? String(profile.graduationYear) : "",
    experienceLevel: profile.experienceLevel || "",
    skills,
    languages,
    interests: Array.isArray(profile.interests) ? profile.interests : [],
    targetRole: profile.targetRole || "",
  };
}

/**
 * The body sent to PUT /api/profile for one step. Only that step's fields
 * are sent, so saving step 3 can never overwrite step 1.
 */
export function buildStepPayload(stepId, form) {
  switch (stepId) {
    case "basics":
      return {
        education: form.education,
        college: form.college.trim(),
      };

    case "academics":
      return {
        degree: joinDegree(form.degree, form.branch),
        graduationYear: Number(form.graduationYear),
        experienceLevel: form.experienceLevel,
      };

    case "skills":
      return {
        skills: mergeSkills(form.skills, form.languages),
      };

    case "direction":
      return {
        interests: uniqueItems(form.interests),
        targetRole: form.targetRole.trim(),
      };

    default:
      return {};
  }
}

/* =========================================================
   VALIDATION
   ========================================================= */

export function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ");
}

export function validateStep(stepId, form) {
  const errors = {};

  if (stepId === "basics") {
    const name = normalizeName(form.fullName);

    if (name.length < 2) {
      errors.fullName = "Enter your full name.";
    } else if (name.length > LIMITS.fullName) {
      errors.fullName = `Your name must be ${LIMITS.fullName} characters or fewer.`;
    }

    if (!form.education) {
      errors.education = "Select your education level.";
    }

    const college = form.college.trim();

    if (college.length < 2) {
      errors.college = "Enter your college, university or institute.";
    } else if (college.length > LIMITS.college) {
      errors.college = `Must be ${LIMITS.college} characters or fewer.`;
    }
  }

  if (stepId === "academics") {
    const degree = form.degree.trim();

    if (degree.length < 2) {
      errors.degree = "Enter your degree or course.";
    } else if (joinDegree(form.degree, form.branch).length > LIMITS.degree) {
      errors.degree = `Degree and branch together must be ${LIMITS.degree} characters or fewer.`;
    }

    const year = form.graduationYear.trim();

    if (!/^\d{4}$/.test(year)) {
      errors.graduationYear = "Enter a 4-digit year, for example 2027.";
    } else if (
      Number(year) < LIMITS.minGraduationYear ||
      Number(year) > LIMITS.maxGraduationYear
    ) {
      errors.graduationYear = `Enter a year between ${LIMITS.minGraduationYear} and ${LIMITS.maxGraduationYear}.`;
    }

    if (!form.experienceLevel) {
      errors.experienceLevel = "Select your experience level.";
    }
  }

  if (stepId === "skills") {
    const merged = mergeSkills(form.skills, form.languages);

    if (merged.length === 0) {
      errors.skills = "Add at least one skill or area of knowledge.";
    } else if (merged.length > LIMITS.maxSkills) {
      errors.skills = `You can add up to ${LIMITS.maxSkills} skills in total.`;
    }
  }

  if (stepId === "direction") {
    if (uniqueItems(form.interests).length === 0) {
      errors.interests = "Add at least one area of interest.";
    }

    const role = form.targetRole.trim();

    if (role.length < 2) {
      errors.targetRole = "Enter the role you want to prepare for.";
    } else if (role.length > LIMITS.targetRole) {
      errors.targetRole = `Must be ${LIMITS.targetRole} characters or fewer.`;
    }
  }

  return errors;
}

/** Index of the first step that still needs answers, or -1 when all are done. */
export function findFirstIncompleteStep(form) {
  return STEPS.findIndex(
    (step) => Object.keys(validateStep(step.id, form)).length > 0
  );
}