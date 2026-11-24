import { SignIn } from "@clerk/react";
import { AuthLayout } from "@/features/auth/auth-layout";
import { DEFAULT_AFTER_AUTH, withRedirect } from "@/features/auth/auth-redirect";
import { ClerkFormShell } from "@/features/auth/clerk-form-shell";
import { useAuthRedirect } from "@/features/auth/use-auth-redirect";
import { useClerkAppearance } from "@/features/auth/use-clerk-appearance";

function SignInPage() {
  const redirect = useAuthRedirect();
  const appearance = useClerkAppearance();
  const destination = redirect ?? DEFAULT_AFTER_AUTH;

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to Guidio AI"
      description="Pick up where you left off with your skill reports, career plans and interview practice."
    >
      <ClerkFormShell redirectTo={destination}>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl={withRedirect("/sign-up", redirect)}
          fallbackRedirectUrl={destination}
          appearance={appearance}
        />
      </ClerkFormShell>
    </AuthLayout>
  );
}

export default SignInPage;