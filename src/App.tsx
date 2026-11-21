import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useLocation, useParams, Navigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import {
  RequireOnboarded,
  RequireNotOnboarded,
} from './auth/guards';
import { AccountDeletionProvider } from './components/account/AccountDeletionProvider';
import { getSubdomainFromHostname } from './lib/site';
import { useLoader } from './components/ui/LoaderProvider';

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
const EmbedProfilePage = lazy(() => import('./pages/EmbedProfilePage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

// Route transition loader wired to single root LoaderProvider (300ms delay avoids flash on fast chunks)
function RouteLoaderFallback() {
  const { showLoader } = useLoader();
  useEffect(() => {
    const release = showLoader({ size: 'md', blocking: false });
    return () => release();
  }, [showLoader]);
  return null;
}

// Handles canonical /@username routes strictly; bare /xyz paths fall through to NotFound
function ProfileRouteHandler() {
  const { username } = useParams<{ username: string }>();
  const raw = (username || '').trim();
  const lower = raw.toLowerCase();

  if (!raw || ['@vite', '@react-refresh', '@fs', '@id'].includes(lower)) {
    return <NotFound />;
  }

  if (raw.startsWith('@')) {
    const clean = raw.slice(1);
    if (!clean) return <NotFound />;
    return <PublicProfilePlaceholder usernameOverride={clean} />;
  }

  return <NotFound />;
}

// Redirects legacy vendor or nested /account/* paths to the canonical /account#<section>
function AccountSubRouteRedirect() {
  const { '*': sub = '' } = useParams();
  const location = useLocation();
  const seg = sub.split('/')[0]?.toLowerCase() || '';
  const map: Record<string, string> = {
    profile: '#profile',
    security: '#security',
    passkeys: '#security',
    password: '#security',
    sessions: '#security',
    devices: '#security',
    emails: '#security',
    connections: '#connections',
    platforms: '#connections',
    plan: '#plan',
    billing: '#plan',
    subscription: '#plan',
    data: '#data',
    privacy: '#data',
    danger: '#data',
  };
  const hash = map[seg] || '';
  return <Navigate to={`/account${location.search}${hash}`} replace />;
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
        <Suspense fallback={<RouteLoaderFallback />}>
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
      <Suspense fallback={<RouteLoaderFallback />}>
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
            path="/dashboard/profiles"
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
          <Route path="/account" element={<AccountPage />} />
          <Route path="/account/*" element={<AccountSubRouteRedirect />} />

          {/* 6. Public Creator Directory, Pricing & Legal Pages */}
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/pricing" element={<Landing />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/privacy" element={<Legal />} />
          <Route path="/terms" element={<Legal />} />

          {/* 7. Protected SEO Admin Console & Public Embed / Report Routes */}
          <Route path="/admin/seo" element={<SeoAdminPage />} />
          <Route path="/embed/:username" element={<EmbedProfilePage />} />
          <Route path="/embed" element={<EmbedProfilePage />} />
          <Route path="/report" element={<ReportPage />} />

          {/* 8. Canonical /@username Public Profiles & Legacy /username Redirect */}
          <Route path="/:username" element={<ProfileRouteHandler />} />

          {/* 9. Fallback 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AccountDeletionProvider>
  );
}
