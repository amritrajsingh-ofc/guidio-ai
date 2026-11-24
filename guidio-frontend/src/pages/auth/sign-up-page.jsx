import { SignUp } from "@clerk/react";
import { AuthLayout } from "@/features/auth/auth-layout";
import { withRedirect } from "@/features/auth/auth-redirect";
import { ClerkFormShell } from "@/features/auth/clerk-form-shell";
import { useAuthRedirect } from "@/features/auth/use-auth-redirect";
import { useClerkAppearance } from "@/features/auth/use-clerk-appearance";

const AFTER_SIGN_UP = "/onboarding";

function SignUpPage() {
  const redirect = useAuthRedirect();
  const appearance = useClerkAppearance();
  // New students finish their profile first. A saved ?redirect_url= still wins.
  const destination = redirect ?? AFTER_SIGN_UP;

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your Guidio AI account"
      description="Build your profile and start getting personalised career guidance. It is free for students."
    >
      <ClerkFormShell redirectTo={destination}>
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl={withRedirect("/sign-in", redirect)}
          fallbackRedirectUrl={destination}
          appearance={appearance}
        />
      </ClerkFormShell>
    </AuthLayout>
  );
}

export default SignUpPage;