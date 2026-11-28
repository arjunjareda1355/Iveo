import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Globe,
  ExternalLink,
  ArrowLeft,
  ShieldCheck,
  FileCode2,
  Activity,
  CreditCard,
  ChevronDown,
  Upload,
  Trash2,
  Send,
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { useIvioSession } from '../auth/useIvioSession';
import { isOwnerEmail } from '../lib/plan';
import { usePageMeta } from '../hooks/usePageMeta';
import { useToast } from '../components/ui/Toast';
import { buildAuthHeaders } from '../lib/clerkTokenBridge';
import {
  validateGscPropertyUrlInput,
  validateGscServiceAccountJsonInput,
} from '../lib/gscClientValidation';

interface ValidationResult {
  username: string;
  displayName?: string;
  found: boolean;
  indexable: boolean;
  httpStatus: number;
  robotsDirective?: string;
  reason: string;
  canonical: string | null;
  title: string | null;
  description: string | null;
  ogImage?: string;
  issues: Array<{
    username: string;
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
  }>;
}

interface SeoHealthReport {
  generatedAt: string;
  canonicalDomain: string;
  metrics: {
    totalProfiles: number;
    indexableProfiles: number;
    nonIndexableProfiles: number;
    missingBioCount: number;
    missingAvatarCount: number;
  };
  sitemap: {
    url: string;
    totalUrls: number;
    pages: number;
    lastGeneratedAt: string | null;
    lastInvalidatedAt: string | null;
    lastInvalidationReason: string | null;
  };
  searchEngines: {
    gscConfigured: boolean;
    gscHasEnv?: boolean;
    gscHasSavedFile?: boolean;
    gscSource?: 'env' | 'stored' | 'none';
    gscError?: string | null;
    gscSiteUrl?: string;
    bingConfigured: boolean;
    indexNowConfigured: boolean;
    googleSearchConsole?: {
      configured: boolean;
      source?: 'env' | 'stored' | 'none';
      hasSavedFile?: boolean;
      hasEnv?: boolean;
      error?: string | null;
      serviceAccountEmail?: string | null;
      projectId?: string | null;
      privateKeyIdPreview?: string | null;
      propertyUrl?: string;
      updatedAt?: string | null;
      updatedBy?: string | null;
      lastTestAt?: string | null;
      lastTestStatus?: string | null;
      lastPermissionLevel?: string | null;
      lastError?: string | null;
      encryptionKeyStatus?: string;
    };
    indexNow?: {
      configured: boolean;
      keyFileUrl?: string | null;
      source?: string;
    };
    recentSubmissions?: Array<{
      engine: string;
      provider?: string;
      scope?: string;
      status: string;
      outcome?: string;
      httpStatus?: number | null;
      detail?: string;
      targetUrl?: string;
      timestamp: string;
    }>;
  };
  issues: Array<{
    username: string;
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
  }>;
  profiles: Array<{
    username: string;
    displayName: string;
    status: string;
    indexable: boolean;
    reason: string;
    hasBio: boolean;
    hasAvatar: boolean;
    customSeo: boolean;
    updatedAt: string;
  }>;
  profilesPagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    query: string;
  };
}

interface UserSeoOverview {
  username: string;
  isAdmin: boolean;
  canonicalDomain: string;
  validation: ValidationResult;
  sitemapIncluded: boolean;
  sitemapUrl: string;
  engines: {
    gscActive: boolean;
    bingActive: boolean;
    indexNowActive: boolean;
  };
  events: Array<{
    id: string;
    at: string;
    type: string;
    provider: string;
    targetUrl: string;
    httpStatus: number | null;
    outcome: string;
    detail?: string;
  }>;
}

const AccordionSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  statusText?: string;
  statusTone?: 'ok' | 'warn' | 'muted' | 'error';
  open: boolean;
  onToggle: () => void;
  id?: string;
  children: React.ReactNode;
}> = ({ title, icon, statusText, statusTone = 'muted', open, onToggle, id, children }) => {
  const toneClass =
    statusTone === 'ok'
      ? 'text-emerald-700'
      : statusTone === 'error'
        ? 'text-red-600'
        : statusTone === 'warn'
          ? 'text-amber-700'
          : 'text-muted';

  return (
    <Card id={id} className="p-0 overflow-hidden scroll-mt-20">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full px-4 py-3.5 sm:px-5 flex items-center justify-between gap-2 text-left hover:bg-surface-2/50 transition-colors cursor-pointer min-w-0"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-ink shrink-0">{icon}</span>
          <span className="text-[15px] font-semibold text-ink truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {statusText && (
            <span className={`text-[12px] font-mono ${toneClass} hidden xs:inline sm:inline`}>
              {statusText}
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {open && <div className="px-4 pb-4 pt-2 sm:px-5 sm:pb-5 border-t border-border">{children}</div>}
    </Card>
  );
};

export const SeoAdminPage: React.FC = () => {
  usePageMeta({
    title: 'SEO Health & Search Console | Iveo',
    description: 'SEO audit, sitemap status, and URL indexability inspector.',
    robots: 'noindex, nofollow',
  });

  const session = useIvioSession();
  const { showToast } = useToast();

  const isSignedIn = Boolean(session.isLoaded && session.isSignedIn);
  const isAdmin = Boolean(isSignedIn && isOwnerEmail(session.primaryEmail));
  const adminEmail = isAdmin ? (session.primaryEmail || '') : '';

  const buildRequestHeaders = useCallback(
    async (extra: Record<string, string> = {}) => {
      const base: Record<string, string> = { ...extra };
      if (session.userId) base['x-user-id'] = session.userId;
      if (session.primaryEmail) base['x-user-email'] = session.primaryEmail;
      return buildAuthHeaders(base);
    },
    [session.userId, session.primaryEmail]
  );

  // Admin state
  const [report, setReport] = useState<SeoHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // User-scoped state
  const [userOverview, setUserOverview] = useState<UserSeoOverview | null>(null);
  const [isUserPinging, setIsUserPinging] = useState(false);

  // Shared validator state
  const [inspectUsername, setInspectUsername] = useState('');
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [gscResult, setGscResult] = useState<any>(null);

  // Accordion open state (only Validator open by default per W4.4)
  const [openValidator, setOpenValidator] = useState(true);
  const [openIntegrations, setOpenIntegrations] = useState(false);
  const [openSitemaps, setOpenSitemaps] = useState(false);
  const [openAudit, setOpenAudit] = useState(false);
  const [openBilling, setOpenBilling] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);

  // GSC config form state (admin only)
  const [showGscForm, setShowGscForm] = useState(false);
  const [gscJsonInput, setGscJsonInput] = useState('');
  const [gscPropertyInput, setGscPropertyInput] = useState('');
  const [gscSaving, setGscSaving] = useState(false);
  const [gscTesting, setGscTesting] = useState(false);
  const [gscRemoving, setGscRemoving] = useState(false);
  const [gscFormError, setGscFormError] = useState<string | null>(null);
  const [gscTestFeedback, setGscTestFeedback] = useState<any>(null);

  // Audit search + pagination (admin)
  const [auditQuery, setAuditQuery] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [moderatingUsername, setModeratingUsername] = useState<string | null>(null);

  // Billing inspector state (admin)
  const [billingUsername, setBillingUsername] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingData, setBillingData] = useState<any>(null);

  const loadAdminReport = useCallback(
    async (opts?: { q?: string; page?: number }) => {
      if (!isAdmin || !adminEmail) return;
      setLoading(true);
      setError(null);
      try {
        const qVal = opts?.q !== undefined ? opts.q : auditQuery;
        const pVal = opts?.page !== undefined ? opts.page : auditPage;
        const params = new URLSearchParams({
          adminEmail,
          page: String(pVal),
          pageSize: '25',
        });
        if (qVal.trim()) params.set('q', qVal.trim());

        const headers = await buildRequestHeaders();
        const res = await fetch(`/api/seo/admin/overview?${params.toString()}`, {
          headers,
          cache: 'no-store',
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !data.report) {
          setError(data?.message || 'Unable to load SEO overview.');
          return;
        }
        setReport(data.report);
        if (data.report.searchEngines?.gscSiteUrl && !gscPropertyInput) {
          setGscPropertyInput(data.report.searchEngines.gscSiteUrl);
        }
      } catch {
        setError('Failed to fetch SEO report.');
      } finally {
        setLoading(false);
      }
    },
    [isAdmin, adminEmail, auditQuery, auditPage, buildRequestHeaders, gscPropertyInput]
  );

  const loadUserOverview = useCallback(async () => {
    if (!isSignedIn || isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await buildRequestHeaders();
      const targetParam = session.username
        ? `?u=${encodeURIComponent(session.username)}`
        : '';
      const res = await fetch(`/api/seo/me/overview${targetParam}`, {
        headers,
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data.overview) {
        setError(data?.message || 'Unable to load SEO status for your profile.');
        return;
      }
      setUserOverview(data.overview);
      setValidation(data.overview.validation);
    } catch {
      setError('Failed to load your SEO status.');
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, isAdmin, session.username, buildRequestHeaders]);

  useEffect(() => {
    if (!session.isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    if (isAdmin) {
      loadAdminReport();
    } else {
      loadUserOverview();
    }
  }, [session.isLoaded, isSignedIn, isAdmin, loadAdminReport, loadUserOverview]);

  const gscValidation = useMemo(() => {
    const propCheck = validateGscPropertyUrlInput(gscPropertyInput);
    if (!propCheck.valid) return { valid: false, error: propCheck.error };
    if (!gscJsonInput.trim()) {
      return { valid: false, error: null };
    }
    const jsonCheck = validateGscServiceAccountJsonInput(gscJsonInput);
    return { valid: jsonCheck.valid, error: jsonCheck.error };
  }, [gscJsonInput, gscPropertyInput]);

  const handleRegenerate = async () => {
    if (!adminEmail) return;
    setIsRegenerating(true);
    try {
      const headers = await buildRequestHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch(
        `/api/seo/admin/regenerate-sitemap?adminEmail=${encodeURIComponent(adminEmail)}`,
        {
          method: 'POST',
          headers,
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        showToast(data?.message || 'Sitemap regeneration failed');
        return;
      }
      showToast(
        `Sitemap regenerated (${data.sitemap?.totalUrls || 0} URLs across ${data.sitemap?.pages || 1} files)`
      );
      await loadAdminReport();
    } catch {
      showToast('Failed to regenerate sitemap');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleValidateProfile = async (e?: React.FormEvent, targetOverride?: string) => {
    if (e) e.preventDefault();
    const target = isAdmin
      ? (targetOverride ?? inspectUsername).trim().replace(/^@+/, '')
      : userOverview?.username || session.username || '';
    if (!target) return;

    setValidating(true);
    setGscResult(null);
    try {
      const headers = await buildRequestHeaders();
      const url = isAdmin
        ? `/api/seo/admin/validate?u=${encodeURIComponent(target)}&adminEmail=${encodeURIComponent(adminEmail)}`
        : `/api/seo/me/validate?u=${encodeURIComponent(target)}`;
      const res = await fetch(url, { headers, cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data.validation) {
        setValidation(data.validation);
      } else {
        showToast(data?.message || data?.error || 'Validation failed');
      }
    } catch {
      showToast('Network error during SEO validation');
    } finally {
      setValidating(false);
    }
  };

  const handleInspectGsc = async () => {
    const target = isAdmin
      ? inspectUsername.trim().replace(/^@+/, '')
      : userOverview?.username || session.username || '';
    if (!target) return;
    setValidating(true);
    try {
      const headers = await buildRequestHeaders({ 'Content-Type': 'application/json' });
      const url = isAdmin
        ? `/api/seo/admin/inspect?adminEmail=${encodeURIComponent(adminEmail)}`
        : '/api/seo/me/inspect';
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ username: target }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        if (data.localValidation) setValidation(data.localValidation);
        setGscResult(data.gsc || null);
      } else {
        showToast(data?.message || 'Inspection request failed');
      }
    } catch {
      showToast('Inspection failed');
    } finally {
      setValidating(false);
    }
  };

  const handleCreatorSubmitPing = async () => {
    const target = userOverview?.username || session.username || '';
    if (!target) return;
    setIsUserPinging(true);
    try {
      const headers = await buildRequestHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/seo/me/submit', {
        method: 'POST',
        headers,
        body: JSON.stringify({ username: target }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        showToast(data?.message || 'Could not submit URL right now');
        return;
      }
      showToast(`Submitted @${target} to search engines`);
      await loadUserOverview();
    } catch {
      showToast('Network error submitting URL');
    } finally {
      setIsUserPinging(false);
    }
  };

  const handleGscFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024) {
      setGscFormError('Selected file exceeds 20 KB limit.');
      return;
    }
    try {
      const text = await file.text();
      setGscJsonInput(text);
      const check = validateGscServiceAccountJsonInput(text);
      setGscFormError(check.valid ? null : check.error);
    } catch {
      setGscFormError('Could not read uploaded JSON file.');
    }
  };

  const handleSaveAndTestGsc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !gscValidation.valid) return;
    setGscSaving(true);
    setGscFormError(null);
    setGscTestFeedback(null);
    try {
      const headers = await buildRequestHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch(
        `/api/seo/admin/gsc-config?adminEmail=${encodeURIComponent(adminEmail)}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            rawJson: gscJsonInput.trim(),
            propertyUrl: gscPropertyInput.trim() || undefined,
            test: true,
          }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setGscFormError(data?.error || data?.message || 'Failed to save GSC credentials.');
        return;
      }
      setGscJsonInput('');
      setShowGscForm(false);
      if (data.connection) {
        setGscTestFeedback(data.connection);
      }
      showToast(
        data.connection?.ok
          ? `GSC Connected (${data.connection.matchedProperty})`
          : 'GSC key saved & encrypted'
      );
      await loadAdminReport();
    } catch {
      setGscFormError('Network error saving GSC credentials.');
    } finally {
      setGscSaving(false);
    }
  };

  const handleTestGsc = async () => {
    if (!isAdmin) return;
    setGscTesting(true);
    setGscTestFeedback(null);
    try {
      const headers = await buildRequestHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch(
        `/api/seo/admin/gsc-test?adminEmail=${encodeURIComponent(adminEmail)}`,
        { method: 'POST', headers }
      );
      const data = await res.json().catch(() => null);
      if (data?.connection) {
        setGscTestFeedback(data.connection);
        showToast(
          data.connection.ok
            ? `GSC Connected (${data.connection.matchedProperty})`
            : data.connection.error || 'GSC connection check finished'
        );
      } else {
        showToast(data?.error || 'Could not run GSC connection test');
      }
      await loadAdminReport();
    } catch {
      showToast('Failed to test GSC connection');
    } finally {
      setGscTesting(false);
    }
  };

  const handleRemoveGscKey = async () => {
    if (!isAdmin) return;
    setGscRemoving(true);
    setGscTestFeedback(null);
    try {
      const headers = await buildRequestHeaders();
      const res = await fetch(
        `/api/seo/admin/gsc-config?adminEmail=${encodeURIComponent(adminEmail)}`,
        { method: 'DELETE', headers }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        showToast(data?.error || 'Could not remove GSC key');
        return;
      }
      setShowGscForm(false);
      setGscJsonInput('');
      showToast('Stored GSC key removed');
      await loadAdminReport();
    } catch {
      showToast('Failed to remove GSC key');
    } finally {
      setGscRemoving(false);
    }
  };

  const handleModerateBackground = async (targetUsername: string) => {
    if (!adminEmail) return;
    setModeratingUsername(targetUsername);
    try {
      const headers = await buildRequestHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch(
        `/api/seo/admin/moderate-background?adminEmail=${encodeURIComponent(adminEmail)}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ username: targetUsername }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        showToast(data?.message || data?.error || 'Could not reset background');
        return;
      }
      showToast(`Reset @${targetUsername} background to Pure White`);
      await loadAdminReport();
    } catch {
      showToast('Network error resetting background');
    } finally {
      setModeratingUsername(null);
    }
  };

  const handleInspectBilling = async (e?: React.FormEvent, targetOverride?: string) => {
    if (e) e.preventDefault();
    const target = (targetOverride ?? billingUsername).trim().replace(/^@+/, '').toLowerCase();
    if (!adminEmail) return;
    if (!target) {
      setBillingError('Enter a creator username to inspect billing.');
      return;
    }
    setBillingError(null);
    setBillingLoading(true);
    try {
      const headers = await buildRequestHeaders();
      const res = await fetch(
        `/api/admin/billing/inspect?username=${encodeURIComponent(target)}&adminEmail=${encodeURIComponent(adminEmail)}`,
        { headers, cache: 'no-store' }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const msg =
          data?.message ||
          (data?.error === 'profile_not_found'
            ? `Profile @${target} not found.`
            : data?.error) ||
          'Could not inspect billing';
        setBillingError(msg);
        showToast(msg);
        return;
      }
      setBillingData(data);
    } catch {
      setBillingError('Failed to inspect billing.');
      showToast('Failed to inspect billing');
    } finally {
      setBillingLoading(false);
    }
  };

  const handleReconcileBilling = async (
    action: 'activate_paid' | 'grant_grace_period' | 'expire_now' | 'cancel_immediate'
  ) => {
    const target = (billingData?.username || billingUsername)
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();
    if (!target || !adminEmail) return;
    setBillingError(null);
    setBillingLoading(true);
    try {
      const headers = await buildRequestHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch(
        `/api/admin/billing/reconcile?adminEmail=${encodeURIComponent(adminEmail)}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            username: target,
            action,
            period: action === 'activate_paid' ? billingCycle : undefined,
            note: `Admin action: ${action}`,
          }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const msg = data?.message || data?.error || 'Reconciliation failed';
        setBillingError(msg);
        showToast(msg);
        return;
      }
      setBillingData(data);
      showToast(`Billing updated (${action})`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('iveo_subscription_updated'));
      }
      if (session.username?.toLowerCase() === target) {
        await session.refreshSession?.().catch(() => {});
      }
      await loadAdminReport();
    } catch {
      setBillingError('Network error during billing reconciliation.');
      showToast('Network error during billing reconciliation');
    } finally {
      setBillingLoading(false);
    }
  };

  if (!session.isLoaded) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <RefreshCw className="animate-spin text-muted" size={20} />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-bg text-ink flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center flex flex-col items-center gap-4">
          <ShieldCheck size={28} className="text-muted" />
          <h1 className="text-[20px] font-semibold text-ink">Sign In Required</h1>
          <p className="text-[14px] text-muted">
            Sign in to view your Iveo Search Console status, live Google preview, and indexing diagnostics.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Button as={Link} to="/login" variant="primary" size="md">
              Sign in
            </Button>
            <Button as={Link} to="/" variant="ghost" size="md">
              Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Non-admin Creator View (strictly scoped to caller's own @username)
  if (!isAdmin) {
    const activeValidation = validation || userOverview?.validation || null;
    const creatorEvents = userOverview?.events || [];
    const shownEvents = showAllEvents ? creatorEvents : creatorEvents.slice(0, 5);

    return (
      <div className="min-h-screen bg-bg text-ink flex flex-col overflow-x-hidden">
        <header className="sticky top-0 z-30 min-h-14 py-2 border-b border-border bg-surface">
          <Container className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <Logo tone="light" size="md" compactMobile />
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-2 border border-border text-[11px] font-mono text-muted truncate">
                Search Console · @{userOverview?.username || session.username || 'profile'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCreatorSubmitPing}
                disabled={isUserPinging || loading || !userOverview?.username}
                className="gap-1.5 !h-7 !min-h-0 !px-2.5 !text-[12px] !rounded-[7px]"
              >
                <Send size={12} />
                <span>{isUserPinging ? 'Submitting...' : 'Ping Search'}</span>
              </Button>
              <Button
                as={Link}
                to="/dashboard/settings"
                variant="ghost"
                size="sm"
                className="gap-1 !h-7 !min-h-0 !px-2.5 !text-[12px] !rounded-[7px]"
              >
                <ArrowLeft size={12} />
                <span>Dashboard</span>
              </Button>
            </div>
          </Container>
        </header>

        <main className="flex-1 py-6 sm:py-8">
          <Container className="flex flex-col gap-4 max-w-[920px]">
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Card key={i} className="h-20 animate-pulse bg-surface">
                    <div className="h-full w-full" />
                  </Card>
                ))}
              </div>
            ) : error ? (
              <Card className="p-5 text-[14px] text-red-600">{error}</Card>
            ) : userOverview ? (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="p-3.5 flex flex-col gap-0.5 min-w-0">
                    <span className="text-[11px] font-medium text-muted uppercase tracking-wider truncate">
                      Indexability
                    </span>
                    <span className="text-[18px] font-semibold text-ink truncate">
                      {userOverview.validation.indexable ? 'Indexable' : 'Excluded'}
                    </span>
                    <span className="text-[11.5px] text-muted truncate">
                      {userOverview.validation.reason}
                    </span>
                  </Card>

                  <Card className="p-3.5 flex flex-col gap-0.5 min-w-0">
                    <span className="text-[11px] font-medium text-muted uppercase tracking-wider truncate">
                      HTTP / Robots
                    </span>
                    <span className="text-[18px] font-semibold text-ink truncate">
                      HTTP {userOverview.validation.httpStatus}
                    </span>
                    <span className="text-[11.5px] font-mono text-muted truncate">
                      {userOverview.validation.robotsDirective || 'index, follow'}
                    </span>
                  </Card>

                  <Card className="p-3.5 flex flex-col gap-0.5 min-w-0">
                    <span className="text-[11px] font-medium text-muted uppercase tracking-wider truncate">
                      Sitemap
                    </span>
                    <span className="text-[18px] font-semibold text-ink truncate">
                      {userOverview.sitemapIncluded ? 'Included' : 'Not listed'}
                    </span>
                    <a
                      href={userOverview.sitemapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11.5px] text-ink underline underline-offset-2 inline-flex items-center gap-1 truncate"
                    >
                      <span>Profiles XML</span>
                      <ExternalLink size={10} />
                    </a>
                  </Card>

                  <Card className="p-3.5 flex flex-col gap-0.5 min-w-0">
                    <span className="text-[11px] font-medium text-muted uppercase tracking-wider truncate">
                      Instant Indexing
                    </span>
                    <span className="text-[18px] font-semibold text-ink truncate">
                      {userOverview.engines.indexNowActive || userOverview.engines.bingActive
                        ? 'Active'
                        : 'Ready'}
                    </span>
                    <span className="text-[11.5px] text-muted truncate">
                      {[
                        userOverview.engines.gscActive ? 'GSC' : null,
                        userOverview.engines.bingActive ? 'Bing' : null,
                        userOverview.engines.indexNowActive ? 'IndexNow' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Local SEO'}
                    </span>
                  </Card>
                </div>

                <AccordionSection
                  title={`Profile SEO Preview (@${userOverview.username})`}
                  icon={<Search size={16} />}
                  statusText={
                    activeValidation?.indexable ? 'Indexable' : activeValidation?.reason || ''
                  }
                  statusTone={activeValidation?.indexable ? 'ok' : 'warn'}
                  open={openValidator}
                  onToggle={() => setOpenValidator((v) => !v)}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleValidateProfile()}
                        disabled={validating}
                        className="!h-8 !min-h-0 !px-3 !text-[12px] !rounded-[7px]"
                      >
                        {validating ? 'Checking...' : 'Validate My SEO'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleInspectGsc}
                        disabled={validating}
                        className="!h-8 !min-h-0 !px-3 !text-[12px] !rounded-[7px]"
                      >
                        GSC Inspect
                      </Button>
                    </div>

                    {activeValidation?.title && (
                      <div className="p-3.5 rounded-xl border border-border bg-white dark:bg-neutral-950 min-w-0">
                        <span className="text-[11px] font-mono text-muted block mb-1">
                          Google Search Snippet Preview
                        </span>
                        <div className="text-[12px] text-[#202124] dark:text-neutral-300 truncate">
                          {activeValidation.canonical}
                        </div>
                        <div className="text-[16px] text-[#1a0dab] dark:text-blue-400 font-medium leading-snug mt-0.5 break-words">
                          {activeValidation.title}
                        </div>
                        <p className="text-[12.5px] text-[#4d5156] dark:text-neutral-400 mt-1 leading-snug break-words">
                          {activeValidation.description}
                        </p>
                      </div>
                    )}

                    {activeValidation && activeValidation.issues.length > 0 && (
                      <ul className="flex flex-col gap-1.5">
                        {activeValidation.issues.map((issue, idx) => (
                          <li
                            key={`${issue.code}-${idx}`}
                            className="text-[12px] flex items-start gap-2 text-muted"
                          >
                            {issue.severity === 'error' ? (
                              <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                            )}
                            <span>{issue.message}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {gscResult && (
                      <div className="p-3 rounded-lg bg-surface-2 border border-border text-[12px]">
                        <span className="font-semibold text-ink block">
                          Google Search Console Status:
                        </span>
                        <span className={gscResult.configured && !gscResult.ok ? 'text-red-600' : 'text-muted'}>
                          {!gscResult.configured
                            ? gscResult.error || 'Local validation active (GSC inspection unavailable).'
                            : gscResult.ok
                              ? `${gscResult.verdict || gscResult.coverageState || 'Inspected'}${gscResult.lastCrawlTime ? ` · Last crawl: ${gscResult.lastCrawlTime}` : ''}`
                              : gscResult.error || 'Google Search Console inspection failed'}
                        </span>
                      </div>
                    )}
                  </div>
                </AccordionSection>

                <AccordionSection
                  title="Your Recent Submission Events"
                  icon={<Activity size={16} />}
                  statusText={`${creatorEvents.length} events`}
                  open={openSitemaps}
                  onToggle={() => setOpenSitemaps((v) => !v)}
                >
                  {creatorEvents.length === 0 ? (
                    <p className="text-[12.5px] text-muted">
                      No indexing events recorded yet for @{userOverview.username}. Click &ldquo;Ping Search&rdquo; after updating your profile or links.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {shownEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="flex items-center justify-between gap-2 text-[12px] py-1 border-b border-border/50 last:border-b-0 min-w-0"
                        >
                          <div className="min-w-0">
                            <span className="font-mono text-ink mr-2">
                              {ev.provider}:{ev.type}
                            </span>
                            {ev.detail && <span className="text-muted truncate">{ev.detail}</span>}
                          </div>
                          <span className="text-[11px] font-mono text-muted shrink-0">
                            {ev.outcome} · {ev.at.slice(0, 10)}
                          </span>
                        </div>
                      ))}
                      {creatorEvents.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllEvents((v) => !v)}
                          className="text-[12px] font-medium text-ink underline self-start cursor-pointer"
                        >
                          {showAllEvents ? 'Show less' : `Show more (${creatorEvents.length - 5})`}
                        </button>
                      )}
                    </div>
                  )}
                </AccordionSection>
              </>
            ) : null}
          </Container>
        </main>
      </div>
    );
  }

  // Admin SEO Health Console
  const gscMeta = report?.searchEngines?.googleSearchConsole;
  const gscSource = report?.searchEngines?.gscSource || gscMeta?.source || 'none';
  const gscConnected = Boolean(report?.searchEngines?.gscConfigured);
  const gscStatusLabel =
    gscSource === 'env' && gscConnected
      ? 'Configured via environment'
      : gscConnected && gscMeta?.lastTestStatus === 'connected'
        ? 'Connected'
        : gscConnected
          ? 'Configured'
          : report?.searchEngines?.gscError
            ? 'Config Error'
            : 'Setup Needed';

  const integrationsSummary = `GSC: ${
    gscConnected ? 'OK' : 'Setup'
  } · Bing: ${report?.searchEngines?.bingConfigured ? 'Connected' : 'Setup'} · IndexNow: ${
    report?.searchEngines?.indexNowConfigured ? 'Active' : 'Setup'
  }`;

  const recentEvents = report?.searchEngines?.recentSubmissions || [];
  const visibleEvents = showAllEvents ? recentEvents : recentEvents.slice(0, 5);
  const pagination = report?.profilesPagination;

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col overflow-x-hidden">
      <header className="sticky top-0 z-30 min-h-14 py-2 border-b border-border bg-surface">
        <Container className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo tone="light" size="md" compactMobile />
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-2 border border-border text-[11px] font-mono text-muted truncate">
              SEO Health Console
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="gap-1.5 whitespace-nowrap !h-7 !min-h-0 !px-2.5 !text-[12px] !rounded-[7px]"
            >
              <RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">
                {isRegenerating ? 'Syncing...' : 'Regenerate & Ping'}
              </span>
              <span className="sm:hidden">Sync</span>
            </Button>
            <Button
              as={Link}
              to="/dashboard"
              variant="ghost"
              size="sm"
              className="gap-1 whitespace-nowrap !h-7 !min-h-0 !px-2.5 !text-[12px] !rounded-[7px]"
            >
              <ArrowLeft size={12} />
              <span>Dashboard</span>
            </Button>
          </div>
        </Container>
      </header>

      <main className="flex-1 py-6 sm:py-8">
        <Container className="flex flex-col gap-4 max-w-[1040px]">
          {loading && !report ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Card key={i} className="h-20 animate-pulse bg-surface">
                  <div className="h-full w-full" />
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card className="p-6 text-center text-[14px] text-red-600">{error}</Card>
          ) : report ? (
            <>
              {/* Compact 4-tile summary row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="p-3.5 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[11px] font-medium text-muted uppercase tracking-wider truncate">
                    Indexable
                  </span>
                  <span className="text-[22px] font-semibold text-ink leading-tight">
                    {report.metrics.indexableProfiles}
                  </span>
                  <span className="text-[11.5px] text-muted truncate">
                    of {report.metrics.totalProfiles} creators
                  </span>
                </Card>

                <Card className="p-3.5 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[11px] font-medium text-muted uppercase tracking-wider truncate">
                    Sitemap URLs
                  </span>
                  <span className="text-[22px] font-semibold text-ink leading-tight">
                    {report.sitemap.totalUrls}
                  </span>
                  <a
                    href="/sitemap.xml"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11.5px] text-ink underline underline-offset-2 inline-flex items-center gap-1 truncate"
                  >
                    <span>
                      {report.sitemap.pages} {report.sitemap.pages === 1 ? 'file' : 'files'}
                    </span>
                    <ExternalLink size={10} />
                  </a>
                </Card>

                <Card className="p-3.5 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[11px] font-medium text-muted uppercase tracking-wider truncate">
                    Excluded
                  </span>
                  <span className="text-[22px] font-semibold text-ink leading-tight">
                    {report.metrics.nonIndexableProfiles}
                  </span>
                  <span className="text-[11.5px] text-muted truncate">
                    Private or hidden
                  </span>
                </Card>

                <Card className="p-3.5 flex flex-col gap-0.5 min-w-0">
                  <span className="text-[11px] font-medium text-muted uppercase tracking-wider truncate">
                    Missing Bio
                  </span>
                  <span className="text-[22px] font-semibold text-ink leading-tight">
                    {report.metrics.missingBioCount}
                  </span>
                  <span className="text-[11.5px] text-muted truncate">
                    Auto SEO fallback
                  </span>
                </Card>
              </div>

              {/* (a) Validator (open by default) */}
              <AccordionSection
                title="Live Profile SEO & Snippet Validator"
                icon={<Search size={16} />}
                statusText={
                  validation
                    ? validation.indexable
                      ? `@${validation.username} · Indexable`
                      : `@${validation.username} · ${validation.reason}`
                    : 'Ready'
                }
                statusTone={
                  validation ? (validation.indexable ? 'ok' : 'warn') : 'muted'
                }
                open={openValidator}
                onToggle={() => setOpenValidator((v) => !v)}
              >
                <div className="flex flex-col gap-3">
                  <form
                    onSubmit={(e) => handleValidateProfile(e)}
                    className="flex flex-col sm:flex-row sm:items-center gap-2"
                  >
                    <div className="relative flex-1 min-w-0">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                      />
                      <input
                        type="text"
                        value={inspectUsername}
                        onChange={(e) => setInspectUsername(e.target.value)}
                        placeholder="Enter handle (e.g. maya or @maya)"
                        aria-label="Username to validate"
                        className="w-full h-8 pl-8 pr-3 bg-surface border border-border rounded-lg text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={validating}
                        className="!h-8 !min-h-0 !px-2.5 !text-[12px] !rounded-[7px] whitespace-nowrap"
                      >
                        {validating ? 'Checking...' : 'Validate SEO'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleInspectGsc}
                        disabled={validating}
                        className="!h-8 !min-h-0 !px-2.5 !text-[12px] !rounded-[7px] whitespace-nowrap"
                      >
                        GSC Inspect
                      </Button>
                    </div>
                  </form>

                  {validation && (
                    <div className="flex flex-col gap-2.5 pt-2 border-t border-border">
                      <div className="flex flex-wrap items-center gap-2 text-[12px]">
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            validation.indexable ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {validation.indexable ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <AlertTriangle size={13} />
                          )}
                          <span>
                            {validation.indexable
                              ? 'Indexable'
                              : `Not Indexable (${validation.reason})`}
                          </span>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-surface-2 border border-border font-mono text-ink">
                          HTTP {validation.httpStatus}
                        </span>
                        {validation.robotsDirective && (
                          <span className="px-2 py-0.5 rounded bg-surface-2 border border-border font-mono text-muted">
                            {validation.robotsDirective}
                          </span>
                        )}
                      </div>

                      {validation.title && (
                        <div className="p-3.5 rounded-xl border border-border bg-white dark:bg-neutral-950 min-w-0">
                          <span className="text-[11px] font-mono text-muted block mb-1">
                            Google Search Snippet Preview
                          </span>
                          <div className="text-[12px] text-[#202124] dark:text-neutral-300 truncate">
                            {validation.canonical || `https://iveo.site/@${validation.username}`}
                          </div>
                          <div className="text-[16px] text-[#1a0dab] dark:text-blue-400 font-medium leading-snug mt-0.5 break-words">
                            {validation.title}
                          </div>
                          <p className="text-[12.5px] text-[#4d5156] dark:text-neutral-400 mt-1 leading-snug break-words">
                            {validation.description}
                          </p>
                        </div>
                      )}

                      {validation.issues.length > 0 && (
                        <ul className="flex flex-col gap-1">
                          {validation.issues.map((issue, idx) => (
                            <li
                              key={`${issue.code}-${idx}`}
                              className="text-[12px] flex items-start gap-2 text-muted"
                            >
                              {issue.severity === 'error' ? (
                                <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                              ) : (
                                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                              )}
                              <span>{issue.message}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {gscResult && (
                        <div className="p-3 rounded-lg bg-surface-2 border border-border text-[12px]">
                          <span className="font-semibold text-ink block">
                            Google Search Console Status:
                          </span>
                          <span
                            className={
                              gscResult.configured && !gscResult.ok
                                ? 'text-red-600'
                                : 'text-muted'
                            }
                          >
                            {!gscResult.configured
                              ? gscResult.error ||
                                'GSC Service Account not configured (local validation active).'
                              : gscResult.ok
                                ? `${gscResult.verdict || gscResult.coverageState || 'Inspected'}${
                                    gscResult.coverageState && gscResult.verdict
                                      ? ` (${gscResult.coverageState})`
                                      : ''
                                  }${gscResult.lastCrawlTime ? ` · Last crawl: ${gscResult.lastCrawlTime}` : ''}`
                                : gscResult.error || 'Google Search Console inspection failed'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </AccordionSection>

              {/* (b) Integrations */}
              <AccordionSection
                title="Crawler & Search Console Integrations"
                icon={<Globe size={16} />}
                statusText={integrationsSummary}
                statusTone={gscConnected ? 'ok' : report.searchEngines.gscError ? 'error' : 'muted'}
                open={openIntegrations}
                onToggle={() => setOpenIntegrations((v) => !v)}
              >
                <div className="flex flex-col gap-3 text-[13px]">
                  {/* 1. Google Search Console */}
                  <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-surface-2 border border-border">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-ink">
                        Google Search Console Sitemap API
                      </span>
                      <span
                        className={`text-[12px] font-mono ${
                          gscConnected
                            ? 'text-emerald-700'
                            : report.searchEngines.gscError
                              ? 'text-red-600'
                              : 'text-muted'
                        }`}
                      >
                        {gscStatusLabel}
                      </span>
                    </div>

                    {gscConnected && gscMeta && (
                      <div className="text-[12px] text-muted flex flex-col gap-1 break-all">
                        {gscMeta.serviceAccountEmail && (
                          <span>
                            Service account:{' '}
                            <span className="font-mono text-ink">
                              {gscMeta.serviceAccountEmail}
                            </span>
                          </span>
                        )}
                        <span>
                          Property:{' '}
                          <span className="font-mono text-ink">
                            {gscMeta.propertyUrl || report.searchEngines.gscSiteUrl}
                          </span>
                          {gscMeta.lastPermissionLevel ? ` · ${gscMeta.lastPermissionLevel}` : ''}
                        </span>
                        {gscMeta.lastTestAt && (
                          <span>
                            Last tested: <span className="font-mono">{gscMeta.lastTestAt}</span>
                            {gscMeta.lastTestStatus ? ` (${gscMeta.lastTestStatus})` : ''}
                          </span>
                        )}
                      </div>
                    )}

                    {report.searchEngines.gscError && (
                      <span className="text-[11.5px] text-red-600 leading-snug">
                        {report.searchEngines.gscError}
                      </span>
                    )}

                    {gscTestFeedback && (
                      <div
                        className={`p-2.5 rounded-lg border text-[12px] ${
                          gscTestFeedback.ok
                            ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-800'
                            : 'bg-amber-500/5 border-amber-500/30 text-amber-900'
                        }`}
                      >
                        {gscTestFeedback.ok
                          ? `Verified property ${gscTestFeedback.matchedProperty}${
                              gscTestFeedback.permissionLevel
                                ? ` (${gscTestFeedback.permissionLevel})`
                                : ''
                            }`
                          : gscTestFeedback.error || gscTestFeedback.actionableHint}
                      </div>
                    )}

                    {gscConnected && gscSource !== 'env' && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleTestGsc}
                          disabled={gscTesting || gscRemoving}
                          className="!h-7 !min-h-0 !px-2.5 !text-[12px] !rounded-[7px]"
                        >
                          {gscTesting ? 'Testing...' : 'Test Connection'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowGscForm((v) => !v)}
                          disabled={gscTesting || gscRemoving}
                          className="!h-7 !min-h-0 !px-2.5 !text-[12px] !rounded-[7px]"
                        >
                          {showGscForm ? 'Hide key editor' : 'Replace key'}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={handleRemoveGscKey}
                          disabled={gscRemoving || gscTesting}
                          className="gap-1 !h-7 !min-h-0 !px-2.5 !text-[12px] !rounded-[7px]"
                        >
                          <Trash2 size={12} />
                          <span>{gscRemoving ? 'Removing...' : 'Remove key'}</span>
                        </Button>
                      </div>
                    )}

                    {gscSource === 'env' && gscConnected && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleTestGsc}
                          disabled={gscTesting}
                          className="!h-7 !min-h-0 !px-2.5 !text-[12px] !rounded-[7px]"
                        >
                          {gscTesting ? 'Testing...' : 'Test Connection'}
                        </Button>
                      </div>
                    )}

                    {(!gscConnected || showGscForm) && gscSource !== 'env' && (
                      <form
                        onSubmit={handleSaveAndTestGsc}
                        className="flex flex-col gap-2.5 pt-2 border-t border-border"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label
                            htmlFor="gsc-json-textarea"
                            className="text-[12px] font-medium text-ink"
                          >
                            Service Account JSON (max 20 KB)
                          </label>
                          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] border border-border bg-surface text-[11.5px] font-medium text-ink hover:bg-surface-2 cursor-pointer">
                            <Upload size={12} />
                            <span>Upload .json</span>
                            <input
                              type="file"
                              accept=".json,application/json"
                              onChange={handleGscFileUpload}
                              className="sr-only"
                            />
                          </label>
                        </div>

                        <textarea
                          id="gsc-json-textarea"
                          rows={4}
                          value={gscJsonInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGscJsonInput(val);
                            if (val.trim()) {
                              const check = validateGscServiceAccountJsonInput(val);
                              setGscFormError(check.valid ? null : check.error);
                            } else {
                              setGscFormError(null);
                            }
                          }}
                          placeholder='{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----...","client_email":"...","token_uri":"https://oauth2.googleapis.com/token"}'
                          className="w-full p-2.5 rounded-lg bg-surface border border-border font-mono text-[11.5px] text-ink resize-y focus-visible:outline-2 focus-visible:outline-ink"
                        />

                        <div className="flex flex-col gap-1">
                          <label
                            htmlFor="gsc-property-url"
                            className="text-[12px] font-medium text-ink"
                          >
                            GSC Property URL
                          </label>
                          <input
                            id="gsc-property-url"
                            type="text"
                            value={gscPropertyInput}
                            onChange={(e) => setGscPropertyInput(e.target.value)}
                            placeholder="https://iveo.site/ or sc-domain:iveo.site"
                            className="h-8 px-2.5 rounded-lg bg-surface border border-border font-mono text-[12px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                          />
                        </div>

                        {(gscFormError || (!gscValidation.valid && gscValidation.error)) && (
                          <p className="text-[11.5px] text-red-600" role="alert">
                            {gscFormError || gscValidation.error}
                          </p>
                        )}

                        <div className="flex items-center gap-2">
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={gscSaving || !gscValidation.valid}
                            className="!h-8 !min-h-0 !px-3 !text-[12px] !rounded-[7px]"
                          >
                            {gscSaving ? 'Saving & Testing...' : 'Save & Test GSC'}
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* 2. Bing Webmaster API */}
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-2 border border-border">
                    <span className="font-medium text-ink">Bing Webmaster API</span>
                    <span
                      className={`text-[12px] font-mono shrink-0 ${
                        report.searchEngines.bingConfigured ? 'text-emerald-700' : 'text-muted'
                      }`}
                    >
                      {report.searchEngines.bingConfigured ? 'Connected' : 'Setup Needed'}
                    </span>
                  </div>

                  {/* 3. IndexNow Instant Ping */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-surface-2 border border-border">
                    <div className="min-w-0">
                      <span className="font-medium text-ink block">IndexNow Instant Ping</span>
                      {report.searchEngines.indexNow?.keyFileUrl && (
                        <a
                          href={new URL(report.searchEngines.indexNow.keyFileUrl).pathname}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11.5px] font-mono text-muted underline break-all"
                        >
                          {new URL(report.searchEngines.indexNow.keyFileUrl).pathname}
                        </a>
                      )}
                    </div>
                    <span
                      className={`text-[12px] font-mono shrink-0 ${
                        report.searchEngines.indexNowConfigured
                          ? 'text-emerald-700'
                          : 'text-muted'
                      }`}
                    >
                      {report.searchEngines.indexNowConfigured ? 'Active' : 'Setup Needed'}
                    </span>
                  </div>
                </div>
              </AccordionSection>

              {/* (c) Sitemaps & Events */}
              <AccordionSection
                title="Sitemaps & Submission Events"
                icon={<Activity size={16} />}
                statusText={`${report.sitemap.totalUrls} URLs · ${recentEvents.length} events`}
                open={openSitemaps}
                onToggle={() => setOpenSitemaps((v) => !v)}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 p-3 rounded-xl bg-surface-2 border border-border text-[12px] font-mono">
                    <a
                      href="/robots.txt"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-ink"
                    >
                      robots.txt
                    </a>
                    <a
                      href="/sitemap.xml"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-ink"
                    >
                      sitemap.xml
                    </a>
                    <a
                      href="/sitemap-pages.xml"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-ink"
                    >
                      sitemap-pages.xml
                    </a>
                    <a
                      href="/sitemap-profiles.xml"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-ink"
                    >
                      sitemap-profiles.xml
                    </a>
                    <a
                      href="/llms.txt"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-ink"
                    >
                      llms.txt
                    </a>
                  </div>

                  {recentEvents.length === 0 ? (
                    <p className="text-[12.5px] text-muted">No submission events logged yet.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5 text-[12px]">
                      {visibleEvents.map((sub, i) => (
                        <div
                          key={`${sub.engine}-${sub.timestamp}-${i}`}
                          className="flex items-center justify-between gap-2 py-1 border-b border-border/50 last:border-b-0 text-muted min-w-0"
                        >
                          <div className="min-w-0 truncate">
                            <span className="font-mono text-ink mr-2">{sub.engine}</span>
                            {sub.detail && <span className="text-muted">{sub.detail}</span>}
                          </div>
                          <span className="font-mono text-[11px] shrink-0">{sub.status}</span>
                        </div>
                      ))}
                      {recentEvents.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllEvents((v) => !v)}
                          className="text-[12px] font-medium text-ink underline self-start pt-1 cursor-pointer"
                        >
                          {showAllEvents
                            ? 'Show less'
                            : `Show more (${recentEvents.length - 5})`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </AccordionSection>

              {/* (d) Indexability Audit (searchable & paginated) */}
              <AccordionSection
                title="Public Profile Indexability Audit"
                icon={<FileCode2 size={16} />}
                statusText={`${pagination?.total ?? report.profiles.length} total`}
                open={openAudit}
                onToggle={() => setOpenAudit((v) => !v)}
              >
                <div className="flex flex-col gap-3">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setAuditPage(1);
                      loadAdminReport({ q: auditQuery, page: 1 });
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={auditQuery}
                      onChange={(e) => setAuditQuery(e.target.value)}
                      placeholder="Filter by handle, display name, or reason..."
                      aria-label="Filter profile audit"
                      className="flex-1 min-w-0 h-8 px-3 bg-surface border border-border rounded-lg text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      className="!h-8 !min-h-0 !px-3 !text-[12px] !rounded-[7px] shrink-0"
                    >
                      Search
                    </Button>
                  </form>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[12.5px]">
                      <thead>
                        <tr className="border-b border-border text-muted font-medium">
                          <th className="py-2 pr-3">Handle</th>
                          <th className="py-2 pr-3">Display Name</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2 pr-3">Indexability</th>
                          <th className="py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/70">
                        {report.profiles.map((p) => (
                          <tr key={p.username} className="hover:bg-surface-2/60">
                            <td className="py-2 pr-3 font-mono text-ink">
                              <a
                                href={`/@${encodeURIComponent(p.username)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                /@{p.username}
                              </a>
                            </td>
                            <td className="py-2 pr-3 text-ink max-w-[160px] truncate">
                              {p.displayName}
                            </td>
                            <td className="py-2 pr-3 capitalize text-muted">{p.status}</td>
                            <td className="py-2 pr-3">
                              {p.indexable ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <CheckCircle2 size={12} /> Indexable
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-700">
                                  <AlertTriangle size={12} /> {p.reason}
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInspectUsername(p.username);
                                    setOpenValidator(true);
                                    handleValidateProfile(undefined, p.username);
                                  }}
                                  className="px-2 py-0.5 text-[11px] font-medium text-ink rounded border border-border bg-surface hover:bg-surface-2 cursor-pointer"
                                >
                                  Check
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBillingUsername(p.username);
                                    setOpenBilling(true);
                                    handleInspectBilling(undefined, p.username);
                                  }}
                                  className="px-2 py-0.5 text-[11px] font-medium text-ink rounded border border-border bg-surface hover:bg-surface-2 cursor-pointer"
                                >
                                  Billing
                                </button>
                                <button
                                  type="button"
                                  disabled={moderatingUsername === p.username}
                                  onClick={() => handleModerateBackground(p.username)}
                                  className="px-2 py-0.5 text-[11px] font-medium text-muted hover:text-ink rounded border border-border bg-surface hover:bg-surface-2 cursor-pointer"
                                >
                                  {moderatingUsername === p.username ? '...' : 'Reset BG'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border text-[12px] text-muted">
                      <span>
                        Page {pagination.page} of {pagination.totalPages} ({pagination.total} profiles)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={pagination.page <= 1}
                          onClick={() => {
                            const nextP = Math.max(1, pagination.page - 1);
                            setAuditPage(nextP);
                            loadAdminReport({ page: nextP });
                          }}
                          className="!h-7 !min-h-0 !px-2.5 !text-[11.5px] !rounded-[6px]"
                        >
                          Prev
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={pagination.page >= pagination.totalPages}
                          onClick={() => {
                            const nextP = Math.min(pagination.totalPages, pagination.page + 1);
                            setAuditPage(nextP);
                            loadAdminReport({ page: nextP });
                          }}
                          className="!h-7 !min-h-0 !px-2.5 !text-[11.5px] !rounded-[6px]"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </AccordionSection>

              {/* (e) Billing & Subscription Inspector (collapsed by default) */}
              <AccordionSection
                id="billing-inspector"
                title="Billing & Subscription Inspector"
                icon={<CreditCard size={16} />}
                statusText={billingData ? `@${billingData.username}` : 'Admin Lookup'}
                open={openBilling}
                onToggle={() => setOpenBilling((v) => !v)}
              >
                <div className="flex flex-col gap-3.5">
                  <form
                    onSubmit={(e) => handleInspectBilling(e)}
                    className="flex flex-col sm:flex-row sm:items-center gap-2"
                  >
                    <input
                      type="text"
                      value={billingUsername}
                      onChange={(e) => setBillingUsername(e.target.value)}
                      placeholder="Enter creator handle to inspect billing (e.g. maya)"
                      aria-label="Username for billing inspection"
                      className="flex-1 min-w-0 h-8 px-3 bg-surface border border-border rounded-lg text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={billingLoading}
                      className="!h-8 !min-h-0 !px-3 !text-[12px] !rounded-[7px] whitespace-nowrap"
                    >
                      {billingLoading ? 'Loading...' : 'Inspect Billing'}
                    </Button>
                  </form>

                  {billingError && (
                    <p className="text-[12px] text-[#B3261E] font-medium" role="alert">
                      {billingError}
                    </p>
                  )}

                  {billingData && (
                    <div className="flex flex-col gap-3 pt-2 border-t border-border text-[13px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-surface-2 border border-border font-mono text-[11.5px] text-ink">
                          @{billingData.username}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-[11.5px] font-medium text-ink">
                          Plan: {billingData.plan} ({billingData.planSource})
                        </span>
                        <span className="px-2 py-0.5 rounded bg-surface-2 border border-border text-[11.5px] font-mono text-ink">
                          State: {billingData.lifecycleState}
                        </span>
                        {billingData.gracePeriod?.inGracePeriod && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11.5px]">
                            Grace Period: {billingData.gracePeriod.daysRemaining}d left
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          value={billingCycle}
                          onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'yearly')}
                          aria-label="Billing cycle for activation"
                          className="h-7 px-2 bg-surface border border-border rounded-[6px] text-[11.5px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                        >
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={billingLoading}
                          onClick={() => handleReconcileBilling('activate_paid')}
                          className="!h-7 !min-h-0 !px-2.5 !text-[11.5px] !rounded-[6px]"
                        >
                          Activate Paid Pro
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={billingLoading}
                          onClick={() => handleReconcileBilling('grant_grace_period')}
                          className="!h-7 !min-h-0 !px-2.5 !text-[11.5px] !rounded-[6px]"
                        >
                          Grant 3-Day Grace
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={billingLoading}
                          onClick={() => handleReconcileBilling('expire_now')}
                          className="!h-7 !min-h-0 !px-2.5 !text-[11.5px] !rounded-[6px]"
                        >
                          Mark Expired
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={billingLoading}
                          onClick={() => handleReconcileBilling('cancel_immediate')}
                          className="!h-7 !min-h-0 !px-2.5 !text-[11.5px] !rounded-[6px]"
                        >
                          Cancel Immediate
                        </Button>
                      </div>

                      {Array.isArray(billingData.auditLogs) && billingData.auditLogs.length > 0 && (
                        <div className="rounded-xl border border-border bg-surface-2/40 p-3 flex flex-col gap-1.5 max-h-40 overflow-y-auto text-[12px]">
                          <span className="font-semibold text-ink">
                            Audit Log ({billingData.auditLogs.length})
                          </span>
                          {billingData.auditLogs.slice(0, 8).map((log: any) => (
                            <div
                              key={log.id}
                              className="flex items-center justify-between gap-2 text-muted"
                            >
                              <span className="truncate">
                                [{log.actor}] {log.action}: {log.fromState} -&gt; {log.toState}
                              </span>
                              <span className="font-mono text-[11px] shrink-0">
                                {String(log.createdAt || '').slice(0, 10)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </AccordionSection>
            </>
          ) : null}
        </Container>
      </main>
    </div>
  );
};

export default SeoAdminPage;
