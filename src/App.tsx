import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Landing } from './pages/Landing';
import {
  RequireOnboarded,
  RequireNotOnboarded,
} from './auth/guards';
import { AccountDeletionProvider } from './components/account/AccountDeletionProvider';
import { getSubdomainFromHostname } from './lib/site';

// Lazy-load every route except the landing page
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const Legal = lazy(() => import('./pages/Legal'));
const PublicProfilePlaceholder = lazy(
  () => import('./pages/PublicProfilePlaceholder')
);
const SSOCallbackPage = lazy(() => import('./pages/SSOCallbackPage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const SeoAdminPage = lazy(() => import('./pages/SeoAdminPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

// 2px ink progress line fallback during route lazy loading
function LoadingBar() {
  return (
    <div
      className="fixed top-0 left-0 right-0 h-[2px] bg-ink z-[100] animate-pulse"
      aria-hidden="true"
    />
  );
}

export default function App() {
  const currentSubdomain = typeof window !== 'undefined'
    ? getSubdomainFromHostname(window.location.hostname)
    : null;

  // Hostname-based multi-tenant routing for subdomains (e.g. arjun.iveo.site)
  if (currentSubdomain) {
    return (
      <AccountDeletionProvider>
        <ScrollToTop />
        <Suspense fallback={<LoadingBar />}>
          <Routes>
            <Route path="/" element={<PublicProfilePlaceholder usernameOverride={currentSubdomain} />} />
            <Route path="/:username" element={<PublicProfilePlaceholder usernameOverride={currentSubdomain} />} />
            <Route path="*" element={<PublicProfilePlaceholder usernameOverride={currentSubdomain} />} />
          </Routes>
        </Suspense>
      </AccountDeletionProvider>
    );
  }

  return (
    <AccountDeletionProvider>
      <ScrollToTop />
      <Suspense fallback={<LoadingBar />}>
        <Routes>
          {/* 1. Public Landing */}
          <Route path="/" element={<Landing />} />

          {/* 2. SSO Callback Routes for Google, GitHub, Discord */}
          <Route path="/sso-callback" element={<SSOCallbackPage />} />
          <Route path="/login/sso-callback" element={<SSOCallbackPage />} />
          <Route path="/signup/sso-callback" element={<SSOCallbackPage />} />

          {/* 3. Guests Only Auth Routes */}
          <Route path="/login/*" element={<LoginPage />} />
          <Route path="/signup/*" element={<SignupPage />} />

          {/* 4. Onboarding (Signed in, not completed) */}
          <Route
            path="/onboarding"
            element={
              <RequireNotOnboarded>
                <OnboardingPage />
              </RequireNotOnboarded>
            }
          />

          {/* 4. Dashboard (Signed in + onboarding completed) */}
          <Route
            path="/dashboard"
            element={
              <RequireOnboarded>
                <DashboardPage />
              </RequireOnboarded>
            }
          />
          <Route
            path="/dashboard/appearance"
            element={
              <RequireOnboarded>
                <DashboardPage />
              </RequireOnboarded>
            }
          />
          <Route
            path="/dashboard/contacts"
            element={
              <RequireOnboarded>
                <DashboardPage />
              </RequireOnboarded>
            }
          />
          <Route
            path="/dashboard/analytics"
            element={
              <RequireOnboarded>
                <DashboardPage />
              </RequireOnboarded>
            }
          />
          <Route
            path="/dashboard/settings"
            element={
              <RequireOnboarded>
                <DashboardPage />
              </RequireOnboarded>
            }
          />

          {/* 5. Account (Signed in) */}
          <Route path="/account/*" element={<AccountPage />} />

          {/* 6. Public Creator Directory & Legal Pages */}
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/privacy" element={<Legal />} />
          <Route path="/terms" element={<Legal />} />

          {/* 7. Protected SEO Admin Console */}
          <Route path="/admin/seo" element={<SeoAdminPage />} />

          {/* 8. Public Profile Placeholder (after all static routes) */}
          <Route path="/:username" element={<PublicProfilePlaceholder />} />

          {/* 9. Fallback 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AccountDeletionProvider>
  );
}
