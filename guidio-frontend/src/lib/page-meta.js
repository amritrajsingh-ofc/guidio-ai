
import { SITE } from "@/lib/site-config";

export const ROBOTS_INDEX = "index, follow";
export const ROBOTS_NOINDEX_FOLLOW = "noindex, follow";
export const ROBOTS_NOINDEX = "noindex, nofollow";

const PRIVATE_DESCRIPTION =
  "Your private Guidio AI workspace for career preparation.";

function privatePage(path, title) {
  return {
    path,
    title: `${title} — ${SITE.name}`,
    description: PRIVATE_DESCRIPTION,
    robots: ROBOTS_NOINDEX,
  };
}

const pages = [
  {
    path: "/",
    title: "Guidio AI — Your Personal AI Career Companion",
    description:
      "Guidio AI is a free AI career companion for students: skill gap analysis, career guidance, mock interviews and an AI assistant.",
    robots: ROBOTS_INDEX,
  },
  {
    path: "/privacy",
    title: `Privacy Policy — ${SITE.name}`,
    description:
      "How Guidio AI collects, uses and protects student information, including how AI providers are used.",
    robots: ROBOTS_INDEX,
  },
  {
    path: "/terms",
    title: `Terms and Conditions — ${SITE.name}`,
    description:
      "The terms for using Guidio AI, including acceptable use and the limits of AI-generated career guidance.",
    robots: ROBOTS_INDEX,
  },
  {
    path: "/sign-in",
    title: `Sign in — ${SITE.name}`,
    description: "Sign in to your Guidio AI account.",
    robots: ROBOTS_NOINDEX_FOLLOW,
  },
  {
    path: "/sign-up",
    title: `Create your account — ${SITE.name}`,
    description: "Create a free Guidio AI account.",
    robots: ROBOTS_NOINDEX_FOLLOW,
  },
  privatePage("/onboarding", "Complete your profile"),
  privatePage("/dashboard", "Dashboard"),
  privatePage("/profile", "My profile"),
  privatePage("/settings", "Settings"),
  privatePage("/assistant", "AI assistant"),
  privatePage("/career-guidance", "Career guidance"),
  privatePage("/skill-gap", "Skill gap analysis"),
  privatePage("/mock-interview", "Mock interview"),
  privatePage("/interview-history", "Interview history"),
];

const notFoundPage = {
  path: null,
  title: `Page not found — ${SITE.name}`,
  description: "The page you are looking for does not exist.",
  robots: ROBOTS_NOINDEX,
};

/** Pages whose sub-paths (for example Clerk's /sign-in/factor-one) are valid. */
const SUBPATH_ROUTES = ["/sign-in", "/sign-up", "/interview-history"];

/** Finds the metadata for a URL path. Unknown paths are treated as not found. */
export function getPageMeta(pathname) {
  // "/privacy/" and "/privacy" are the same page.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  const match = pages.find(
    (page) =>
      path === page.path ||
      (SUBPATH_ROUTES.includes(page.path) && path.startsWith(`${page.path}/`))
  );

  return match ?? notFoundPage;
}
