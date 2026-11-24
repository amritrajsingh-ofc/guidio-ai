
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import ProtectedRoute from "@/components/protected-route";
import { RouteMeta } from "@/components/route-meta";
import { PageSkeleton } from "@/components/common/skeletons";

// Every page is loaded only when it is opened.
const AppLayout = lazy(() => import("@/layouts/app-layout"));
const HomePage = lazy(() => import("@/pages/home-page"));
const SignInPage = lazy(() => import("@/pages/auth/sign-in-page"));
const SignUpPage = lazy(() => import("@/pages/auth/sign-up-page"));
const PrivacyPolicyPage = lazy(() => import("@/pages/legal/privacy-policy-page"));
const TermsPage = lazy(() => import("@/pages/legal/terms-page"));
const NotFoundPage = lazy(() => import("@/pages/not-found-page"));
const OnboardingPage = lazy(() => import("@/pages/onboarding-page"));
const DashboardPage = lazy(() => import("@/pages/dashboard/dashboard-page"));
const ProfilePage = lazy(() => import("@/pages/profile-page"));
const SettingsPage = lazy(() => import("@/pages/settings-page"));
const CareerGuidancePage = lazy(() => import("@/pages/career-guidance-page"));
const SkillGapPage = lazy(() => import("@/pages/skill-gap-page"));
const MockInterviewPage = lazy(() => import("@/pages/mock-interview-page"));

// The assistant brings the markdown and code-highlighting libraries.
const AssistantPage = lazy(() => import("@/pages/assistant-page"));

const InterviewHistoryPage = lazy(
  () => import("@/pages/interview-history-page")
);

function ScreenFallback() {
  return <div className="min-h-screen bg-background" />;
}

/** Wraps a lazy page so it shows a skeleton inside the app layout. */
function inLayout(page) {
  return <Suspense fallback={<PageSkeleton />}>{page}</Suspense>;
}

/** Wraps a lazy page that fills the whole screen (no app layout). */
function fullScreen(page) {
  return <Suspense fallback={<ScreenFallback />}>{page}</Suspense>;
}

function App() {
  return (
    <>
      <RouteMeta />

      <Routes>
        <Route path="/" element={fullScreen(<HomePage />)} />

        <Route path="/sign-in/*" element={fullScreen(<SignInPage />)} />
        <Route path="/sign-up/*" element={fullScreen(<SignUpPage />)} />

        <Route path="/privacy" element={fullScreen(<PrivacyPolicyPage />)} />
        <Route path="/terms" element={fullScreen(<TermsPage />)} />

        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              {fullScreen(<OnboardingPage />)}
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              {fullScreen(<AppLayout />)}
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={inLayout(<DashboardPage />)} />

          <Route path="/profile" element={inLayout(<ProfilePage />)} />

          <Route path="/settings" element={inLayout(<SettingsPage />)} />

          <Route path="/assistant" element={inLayout(<AssistantPage />)} />

          <Route
            path="/career-guidance"
            element={inLayout(<CareerGuidancePage />)}
          />

          <Route path="/skill-gap" element={inLayout(<SkillGapPage />)} />

          <Route
            path="/mock-interview"
            element={inLayout(<MockInterviewPage />)}
          />

          {/* The optional :id shows one interview. Without it, the full list. */}
          <Route
            path="/interview-history/:id?"
            element={inLayout(<InterviewHistoryPage />)}
          />
        </Route>

        {/* Display a proper 404 page for unknown routes. */}
        <Route path="*" element={fullScreen(<NotFoundPage />)} />
      </Routes>
    </>
  );
}

export default App;
