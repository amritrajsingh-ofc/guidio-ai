import { useSearchParams } from "react-router";
import { getSafeRedirect } from "@/features/auth/auth-redirect";

/**
 * Returns the safe path to go to after authentication, or null when the
 * URL has no (valid) ?redirect_url= value.
 */
export function useAuthRedirect() {
  const [searchParams] = useSearchParams();

  return getSafeRedirect(searchParams.get("redirect_url"));
}