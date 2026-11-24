/**
 * Helpers for sending a student back to the page they originally wanted
 * after signing in. Only same-site paths are accepted, so a crafted
 * ?redirect_url=https://evil.example can never send anyone off-site.
 */

export const DEFAULT_AFTER_AUTH = "/dashboard";

export function getSafeRedirect(value) {
  if (typeof value !== "string") {
    return null;
  }

  // Must be a path on this site: "/something", never "//host" or "/\host".
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return null;
  }

  // Never loop back into the auth pages.
  if (/^\/(sign-in|sign-up)(\/|\?|#|$)/.test(value)) {
    return null;
  }

  return value;
}

export function withRedirect(path, redirect) {
  const safe = getSafeRedirect(redirect);

  return safe ? `${path}?redirect_url=${encodeURIComponent(safe)}` : path;
}