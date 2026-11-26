import React, { useState, useEffect, useCallback } from 'react';
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
  Upload,
  Trash2,
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Container } from '../components/ui/Container';
import { useIvioSession } from '../auth/useIvioSession';
import { isOwnerEmail } from '../lib/plan';
import { usePageMeta } from '../hooks/usePageMeta';
import { useToast } from '../components/ui/Toast';

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
    gscSource?: 'runtime_file' | 'env' | 'none';
    gscError?: string | null;
    gscSiteUrl?: string;
    bingConfigured: boolean;
    indexNowConfigured: boolean;
    googleSearchConsole?: {
      configured: boolean;
      source?: 'runtime_file' | 'env' | 'none';
      hasSavedFile?: boolean;
      hasEnv?: boolean;
      error?: string | null;
      serviceAccountEmail?: string | null;
      projectId?: string | null;
      privateKeyIdPreview?: string | null;
      propertyUrl?: string;
      updatedAt?: string | null;
    };
    recentSubmissions?: Array<{
      engine: string;
      status: string;
      detail?: string;
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
}

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

export const SeoAdminPage: React.FC = () => {
  usePageMeta({
    title: 'SEO Health & Search Console | Iveo',
    description: 'Internal SEO audit, sitemap diagnostics, and URL indexability inspector.',
    robots: 'noindex, nofollow',
  });

  const session = useIvioSession();
  const { showToast } = useToast();
  const isAuthorized = Boolean(
    session.isLoaded && session.isSignedIn && isOwnerEmail(session.primaryEmail)
  );
  const adminEmail = isAuthorized ? (session.primaryEmail || '') : '';

  const [report, setReport] = useState<SeoHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [inspectUsername, setInspectUsername] = useState('');
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [gscResult, setGscResult] = useState<any>(null);
  const [moderatingUsername, setModeratingUsername] = useState<string | null>(null);

  const [billingUsername, setBillingUsername] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingData, setBillingData] = useState<any>(null);

  const [gscConfigSummary, setGscConfigSummary] = useState<{
    configured: boolean;
    source: 'runtime_file' | 'env' | 'none';
    hasSavedFile: boolean;
    hasEnvVars: boolean;
    clientEmail: string | null;
    projectId: string | null;
    privateKeyIdPreview: string | null;
    propertyUrl: string;
    updatedAt: string | null;
    error: string | null;
  } | null>(null);
  const [gscJsonInput, setGscJsonInput] = useState('');
  const [gscPropertyInput, setGscPropertyInput] = useState('');
  const [gscSaving, setGscSaving] = useState(false);
  const [gscTesting, setGscTesting] = useState(false);
  const [gscFormError, setGscFormError] = useState<string | null>(null);
  const [gscConnectionTest, setGscConnectionTest] = useState<{
    ok: boolean;
    oauthOk?: boolean;
    matchedProperty?: string | null;
    verifiedSites?: string[];
    error?: string | null;
    actionableHint?: string | null;
  } | null>(null);

  const loadGscConfig = useCallback(async () => {
    if (!isAuthorized || !adminEmail) return;
    try {
      const res = await fetch(
        `/api/seo/admin/gsc-config?adminEmail=${encodeURIComponent(adminEmail)}`,
        {
          headers: { 'x-user-email': adminEmail },
          cache: 'no-store',
        }
      );
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data.gsc) {
        setGscConfigSummary(data.gsc);
        setGscPropertyInput((prev) => prev || data.gsc.propertyUrl || '');
      }
    } catch {}
  }, [isAuthorized, adminEmail]);

  const loadReport = useCallback(async () => {
    if (!isAuthorized || !adminEmail) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/seo/admin/overview?adminEmail=${encodeURIComponent(adminEmail)}`,
        {
          headers: { 'x-user-email': adminEmail },
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data.report) {
        setError(data?.message || 'Unable to load SEO overview.');
        return;
      }
      setReport(data.report);
      void loadGscConfig();
    } catch {
      setError('Failed to fetch SEO report.');
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, adminEmail, loadGscConfig]);

  useEffect(() => {
    if (isAuthorized && adminEmail) {
      loadReport();
    } else if (session.isLoaded) {
      setLoading(false);
    }
  }, [isAuthorized, adminEmail, session.isLoaded, loadReport]);

  const handleGscFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGscFormError(null);
    try {
      const text = await file.text();
      setGscJsonInput(text);
    } catch {
      setGscFormError('Could not read the selected JSON file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveGscConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail) return;
    setGscFormError(null);
    setGscSaving(true);
    try {
      const res = await fetch(
        `/api/seo/admin/gsc-config?adminEmail=${encodeURIComponent(adminEmail)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': adminEmail,
          },
          body: JSON.stringify({
            rawJson: gscJsonInput.trim() || undefined,
            propertyUrl: gscPropertyInput.trim() || undefined,
            test: true,
          }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setGscFormError(data?.error || data?.message || 'Could not save GSC credentials.');
        if (data?.gsc) setGscConfigSummary(data.gsc);
        return;
      }
      setGscJsonInput('');
      if (data.gsc) setGscConfigSummary(data.gsc);
      if (data.connection) setGscConnectionTest(data.connection);
      showToast(
        data.connection?.ok
          ? 'GSC credentials saved & connected'
          : 'GSC credentials saved (check permissions below)'
      );
      await loadReport();
    } catch {
      setGscFormError('Network error saving GSC configuration.');
    } finally {
      setGscSaving(false);
    }
  };

  const handleTestGscConnection = async () => {
    if (!adminEmail) return;
    setGscFormError(null);
    setGscTesting(true);
    try {
      const res = await fetch(
        `/api/seo/admin/gsc-test?adminEmail=${encodeURIComponent(adminEmail)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': adminEmail,
          },
        }
      );
      const data = await res.json().catch(() => null);
      if (data?.gsc) setGscConfigSummary(data.gsc);
      if (data?.connection) {
        setGscConnectionTest(data.connection);
        showToast(
          data.connection.ok
            ? 'Google Search Console connected'
            : data.connection.oauthOk
              ? 'OAuth OK, check Search Console property permission'
              : 'GSC connection check failed'
        );
      } else {
        setGscFormError(data?.error || 'Could not test GSC connection.');
      }
    } catch {
      setGscFormError('Network error testing GSC connection.');
    } finally {
      setGscTesting(false);
    }
  };

  const handleDeleteGscConfig = async () => {
    if (!adminEmail) return;
    setGscFormError(null);
    setGscSaving(true);
    try {
      const res = await fetch(
        `/api/seo/admin/gsc-config?adminEmail=${encodeURIComponent(adminEmail)}`,
        {
          method: 'DELETE',
          headers: { 'x-user-email': adminEmail },
        }
      );
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setGscConfigSummary(data.gsc || null);
        setGscConnectionTest(null);
        setGscJsonInput('');
        showToast('Saved GSC service account removed');
        await loadReport();
      } else {
        setGscFormError(data?.error || 'Could not remove saved GSC config.');
      }
    } catch {
      setGscFormError('Network error removing GSC config.');
    } finally {
      setGscSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!adminEmail) return;
    setIsRegenerating(true);
    try {
      const res = await fetch(
        `/api/seo/admin/regenerate-sitemap?adminEmail=${encodeURIComponent(adminEmail)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': adminEmail,
          },
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        showToast(data?.message || 'Sitemap regeneration failed');
        return;
      }
      showToast(
        `Sitemap regenerated (${data.sitemap?.totalUrls || 0} URLs across ${data.sitemap?.pages || 1} file)`
      );
      await loadReport();
    } catch {
      showToast('Failed to regenerate sitemap');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleValidateProfile = async (e?: React.FormEvent, targetOverride?: string) => {
    if (e) e.preventDefault();
    const target = (targetOverride ?? inspectUsername).trim().replace(/^@+/, '');
    if (!target || !adminEmail) return;

    setValidating(true);
    setGscResult(null);
    try {
      const res = await fetch(
        `/api/seo/admin/validate?u=${encodeURIComponent(target)}&adminEmail=${encodeURIComponent(adminEmail)}`,
        { headers: { 'x-user-email': adminEmail }, cache: 'no-store' }
      );
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
    const target = inspectUsername.trim().replace(/^@+/, '');
    if (!target || !adminEmail) return;
    setValidating(true);
    try {
      const res = await fetch(
        `/api/seo/admin/inspect?adminEmail=${encodeURIComponent(adminEmail)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': adminEmail,
          },
          body: JSON.stringify({ username: target }),
        }
      );
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

  const handleModerateBackground = async (targetUsername: string) => {
    if (!adminEmail) return;
    setModeratingUsername(targetUsername);
    try {
      const res = await fetch(
        `/api/seo/admin/moderate-background?adminEmail=${encodeURIComponent(adminEmail)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': adminEmail,
          },
          body: JSON.stringify({ username: targetUsername }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        showToast(data?.message || data?.error || 'Could not reset background');
        return;
      }
      showToast(`Reset @${targetUsername} background to Pure White`);
      await loadReport();
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
      const res = await fetch(
        `/api/admin/billing/inspect?username=${encodeURIComponent(target)}&adminEmail=${encodeURIComponent(adminEmail)}`,
        { headers: { 'x-user-email': adminEmail }, cache: 'no-store' }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const msg = data?.message || (data?.error === 'profile_not_found' ? `Profile @${target} not found.` : data?.error) || 'Could not inspect billing';
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
    const target = (billingData?.username || billingUsername).trim().replace(/^@+/, '').toLowerCase();
    if (!target || !adminEmail) return;
    setBillingError(null);
    setBillingLoading(true);
    try {
      const res = await fetch(
        `/api/admin/billing/reconcile?adminEmail=${encodeURIComponent(adminEmail)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': adminEmail,
          },
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
      await loadReport();
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

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-bg text-ink flex flex-col items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center flex flex-col items-center gap-4">
          <ShieldCheck size={28} className="text-muted" />
          <h1 className="text-[20px] font-semibold text-ink">SEO Admin Access Required</h1>
          <p className="text-[14px] text-muted">
            Sign in with an authorized Iveo administrator account to view sitemap health and search indexing diagnostics.
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Button as={Link} to="/dashboard" variant="secondary" size="md">
              Back to dashboard
            </Button>
            <Button as={Link} to="/" variant="ghost" size="md">
              Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <header className="sticky top-0 z-30 min-h-16 py-2 sm:py-0 border-b border-border bg-surface">
        <Container className="h-full flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            <Logo tone="light" size="md" />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-2 border border-border text-[11px] sm:text-[12px] font-mono text-muted truncate">
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
              <span className="hidden xs:inline sm:inline">
                {isRegenerating ? 'Regenerating...' : 'Regenerate & Ping'}
              </span>
              <span className="sm:hidden xs:hidden">Sync</span>
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

      <main className="flex-1 py-8 sm:py-10">
        <Container className="flex flex-col gap-6">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Card key={i} className="h-28 animate-pulse bg-surface">
                  <div className="h-full w-full" />
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card className="p-6 text-center text-[14px] text-error">{error}</Card>
          ) : report ? (
            <>
              {/* Metrics Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-5 flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-muted uppercase tracking-wider">
                    Indexable Profiles
                  </span>
                  <span className="text-[28px] font-semibold text-ink leading-tight">
                    {report.metrics.indexableProfiles}
                  </span>
                  <span className="text-[12px] text-muted">
                    of {report.metrics.totalProfiles} total creators
                  </span>
                </Card>

                <Card className="p-5 flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-muted uppercase tracking-wider">
                    Sitemap URLs
                  </span>
                  <span className="text-[28px] font-semibold text-ink leading-tight">
                    {report.sitemap.totalUrls}
                  </span>
                  <a
                    href="/sitemap.xml"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] text-ink underline underline-offset-2 inline-flex items-center gap-1"
                  >
                    <span>
                      {report.sitemap.pages} sitemap {report.sitemap.pages === 1 ? 'file' : 'pages'}
                    </span>
                    <ExternalLink size={11} />
                  </a>
                </Card>

                <Card className="p-5 flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-muted uppercase tracking-wider">
                    Excluded (Noindex)
                  </span>
                  <span className="text-[28px] font-semibold text-ink leading-tight">
                    {report.metrics.nonIndexableProfiles}
                  </span>
                  <span className="text-[12px] text-muted">
                    Private, hidden, or incomplete
                  </span>
                </Card>

                <Card className="p-5 flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-muted uppercase tracking-wider">
                    Missing Bio Metadata
                  </span>
                  <span className="text-[28px] font-semibold text-ink leading-tight">
                    {report.metrics.missingBioCount}
                  </span>
                  <span className="text-[12px] text-muted">
                    Using automated SEO fallback
                  </span>
                </Card>
              </div>

              {/* Search Engine Integrations + Live URL Validator */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Live URL Validator */}
                <Card className="lg:col-span-7 p-5 sm:p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-[18px] font-semibold text-ink leading-tight">
                        Live Profile SEO &amp; Snippet Validator
                      </h2>
                      <p className="text-[13px] text-muted mt-0.5">
                        Inspect canonical URL, HTTP status, JSON-LD eligibility, and Google SERP preview for any handle.
                      </p>
                    </div>
                  </div>

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
                    <div className="flex flex-col gap-3 pt-2 border-t border-border">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${
                            validation.indexable
                              ? 'bg-emerald-500/10 text-emerald-700'
                              : 'bg-amber-500/10 text-amber-700'
                          }`}
                        >
                          {validation.indexable ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <AlertTriangle size={13} />
                          )}
                          <span>
                            {validation.indexable ? 'Indexable' : `Not Indexable (${validation.reason})`}
                          </span>
                        </span>
                        <span className="px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[12px] font-mono text-ink">
                          HTTP {validation.httpStatus}
                        </span>
                        {validation.robotsDirective && (
                          <span className="px-2.5 py-1 rounded-full bg-surface-2 border border-border text-[12px] font-mono text-muted">
                            {validation.robotsDirective}
                          </span>
                        )}
                      </div>

                      {/* Google Search Result Snippet Preview */}
                      {validation.title && (
                        <div className="p-4 rounded-xl border border-border bg-white dark:bg-neutral-950">
                          <span className="text-[11px] font-mono text-muted block mb-1.5">
                            Google Search Snippet Preview
                          </span>
                          <div className="text-[12px] text-[#202124] dark:text-neutral-300 truncate">
                            {validation.canonical || `https://iveo.site/@${validation.username}`}
                          </div>
                          <div className="text-[18px] text-[#1a0dab] dark:text-blue-400 font-medium leading-snug mt-0.5">
                            {validation.title}
                          </div>
                          <p className="text-[13px] text-[#4d5156] dark:text-neutral-400 mt-1 leading-snug">
                            {validation.description}
                          </p>
                        </div>
                      )}

                      {validation.issues.length > 0 && (
                        <ul className="flex flex-col gap-1.5">
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
                          <span className={gscResult.configured && !gscResult.ok ? 'text-red-600' : 'text-muted'}>
                            {!gscResult.configured
                              ? gscResult.error ||
                                gscResult.message ||
                                'GSC Service Account not configured in server environment (local validation active).'
                              : gscResult.ok
                                ? `${gscResult.verdict || gscResult.coverageState || 'Inspected'}${gscResult.coverageState && gscResult.verdict ? ` (${gscResult.coverageState})` : ''}${gscResult.lastCrawlTime ? ` · Last crawl: ${gscResult.lastCrawlTime}` : ''}`
                                : gscResult.error || 'Google Search Console inspection failed'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                {/* Search Engine Sync Card */}
                <Card className="lg:col-span-5 p-5 sm:p-6 flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Globe size={18} className="text-ink" />
                    <h2 className="text-[18px] font-semibold text-ink leading-tight">
                      Crawler &amp; Search Console Integrations
                    </h2>
                  </div>

                  <div className="flex flex-col gap-2.5 text-[13px]">
                    <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-surface-2 border border-border">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-ink">Google Search Console Sitemap API</span>
                        <span
                          className={`text-[12px] font-mono shrink-0 ${
                            (gscConfigSummary?.configured ?? report.searchEngines.gscConfigured)
                              ? 'text-emerald-700'
                              : (gscConfigSummary?.error || report.searchEngines.gscError)
                                ? 'text-red-600'
                                : 'text-muted'
                          }`}
                        >
                          {(gscConfigSummary?.configured ?? report.searchEngines.gscConfigured)
                            ? 'Configured'
                            : (gscConfigSummary?.error || report.searchEngines.gscError)
                              ? 'Config Error'
                              : 'Setup Needed'}
                        </span>
                      </div>

                      {(gscConfigSummary?.clientEmail || report.searchEngines.googleSearchConsole?.serviceAccountEmail) && (
                        <div className="text-[11.5px] text-muted flex flex-col gap-0.5 break-all">
                          <span>
                            Service account:{' '}
                            <span className="font-mono text-ink">
                              {gscConfigSummary?.clientEmail ||
                                report.searchEngines.googleSearchConsole?.serviceAccountEmail}
                            </span>
                          </span>
                          {(gscConfigSummary?.projectId || gscConfigSummary?.privateKeyIdPreview) && (
                            <span>
                              Project:{' '}
                              <span className="font-mono text-ink">
                                {gscConfigSummary?.projectId || '—'}
                              </span>
                              {gscConfigSummary?.privateKeyIdPreview
                                ? ` · Key ${gscConfigSummary.privateKeyIdPreview}`
                                : ''}
                            </span>
                          )}
                        </div>
                      )}

                      {(gscConfigSummary?.error || report.searchEngines.gscError) && (
                        <span className="text-[11px] text-red-600 leading-snug">
                          {gscConfigSummary?.error || report.searchEngines.gscError}
                        </span>
                      )}

                      <form onSubmit={handleSaveGscConfig} className="flex flex-col gap-2 pt-1.5 border-t border-border/70">
                        <div className="flex items-center justify-between gap-2">
                          <label htmlFor="gsc-json-input" className="text-[11.5px] font-medium text-ink">
                            Service Account JSON Key
                          </label>
                          <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] border border-border bg-surface text-[11px] font-medium text-ink hover:bg-surface-2 cursor-pointer">
                            <Upload size={11} />
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
                          id="gsc-json-input"
                          value={gscJsonInput}
                          onChange={(e) => setGscJsonInput(e.target.value)}
                          rows={3}
                          placeholder={
                            gscConfigSummary?.configured
                              ? 'Paste new Google Cloud Service Account JSON to replace current key...'
                              : 'Paste Google Cloud Service Account JSON key here or upload .json above...'
                          }
                          className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11.5px] font-mono text-ink focus-visible:outline-2 focus-visible:outline-ink resize-y"
                        />
                        <div className="flex flex-col gap-1">
                          <label htmlFor="gsc-property-input" className="text-[11.5px] font-medium text-ink">
                            GSC Property URL
                          </label>
                          <input
                            id="gsc-property-input"
                            type="text"
                            value={gscPropertyInput}
                            onChange={(e) => setGscPropertyInput(e.target.value)}
                            placeholder="https://iveo.site/ or sc-domain:iveo.site"
                            className="w-full h-7 px-2.5 bg-surface border border-border rounded-lg text-[11.5px] font-mono text-ink focus-visible:outline-2 focus-visible:outline-ink"
                          />
                        </div>

                        {gscFormError && (
                          <span className="text-[11px] text-red-600 leading-snug" role="alert">
                            {gscFormError}
                          </span>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={gscSaving || (!gscJsonInput.trim() && !gscConfigSummary?.hasSavedFile)}
                            className="!h-7 !min-h-0 !px-2.5 !text-[11.5px] !rounded-[6px]"
                          >
                            {gscSaving ? 'Saving...' : 'Save & Test GSC'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={gscTesting || !(gscConfigSummary?.configured ?? report.searchEngines.gscConfigured)}
                            onClick={handleTestGscConnection}
                            className="!h-7 !min-h-0 !px-2.5 !text-[11.5px] !rounded-[6px]"
                          >
                            {gscTesting ? 'Testing...' : 'Test Connection'}
                          </Button>
                          {gscConfigSummary?.hasSavedFile && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={gscSaving}
                              onClick={handleDeleteGscConfig}
                              className="!h-7 !min-h-0 !px-2 !text-[11.5px] !rounded-[6px] text-red-600 hover:bg-red-50 gap-1"
                            >
                              <Trash2 size={11} />
                              <span>Remove</span>
                            </Button>
                          )}
                        </div>

                        {gscConnectionTest && (
                          <div
                            className={`p-2 rounded-lg border text-[11.5px] leading-snug ${
                              gscConnectionTest.ok
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800'
                                : 'bg-amber-500/10 border-amber-500/30 text-amber-900'
                            }`}
                          >
                            <div className="font-medium">
                              {gscConnectionTest.ok
                                ? `Connected to ${gscConnectionTest.matchedProperty}`
                                : gscConnectionTest.oauthOk
                                  ? 'OAuth succeeded — Search Console permission/property check needed'
                                  : 'Connection failed'}
                            </div>
                            {Array.isArray(gscConnectionTest.verifiedSites) &&
                              gscConnectionTest.verifiedSites.length > 0 && (
                                <div className="mt-0.5 font-mono text-[10.5px]">
                                  Properties: {gscConnectionTest.verifiedSites.join(', ')}
                                </div>
                              )}
                            {gscConnectionTest.error && !gscConnectionTest.ok && (
                              <div className="mt-0.5">{gscConnectionTest.error}</div>
                            )}
                          </div>
                        )}
                      </form>
                    </div>

                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-2 border border-border">
                      <span className="font-medium text-ink">Bing Webmaster API</span>
                      <span
                        className={`text-[12px] font-mono shrink-0 ${
                          report.searchEngines.bingConfigured ? 'text-emerald-700' : 'text-muted'
                        }`}
                      >
                        {report.searchEngines.bingConfigured ? 'Connected' : 'Ready (Env Needed)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-2 border border-border">
                      <span className="font-medium text-ink">IndexNow Instant Ping</span>
                      <span
                        className={`text-[12px] font-mono shrink-0 ${
                          report.searchEngines.indexNowConfigured ? 'text-emerald-700' : 'text-muted'
                        }`}
                      >
                        {report.searchEngines.indexNowConfigured ? 'Active' : 'Ready (Env Needed)'}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-surface-2 border border-border">
                      <span className="font-medium text-ink shrink-0">XML Sitemaps &amp; Crawlers</span>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-mono">
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
                    </div>
                  </div>

                  {report.searchEngines.recentSubmissions &&
                    report.searchEngines.recentSubmissions.length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <span className="text-[12px] font-medium text-muted flex items-center gap-1.5 mb-2">
                          <Activity size={13} />
                          Recent Submission Events
                        </span>
                        <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto text-[12px]">
                          {report.searchEngines.recentSubmissions.slice(0, 5).map((sub, i) => (
                            <div
                              key={`${sub.engine}-${i}`}
                              className="flex items-center justify-between text-muted"
                            >
                              <span className="font-mono text-ink">{sub.engine}</span>
                              <span className="truncate ml-2">{sub.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </Card>
              </div>

              {/* Billing & Subscription Inspector / Reconciliation */}
              <Card id="billing-inspector" className="p-5 sm:p-6 flex flex-col gap-3.5 scroll-mt-20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CreditCard size={18} className="text-ink" />
                    <h2 className="text-[18px] font-semibold text-ink">
                      Billing &amp; Subscription Inspector
                    </h2>
                  </div>
                  <span className="text-[12px] text-muted">
                    Privileged admin lookup &amp; lifecycle reconciliation
                  </span>
                </div>

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
                    className="flex-1 h-8 px-3 bg-surface border border-border rounded-lg text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
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
                      <span className="px-2 py-0.5 rounded-full bg-surface-2 border border-border font-mono text-[11.5px] text-ink">
                        @{billingData.username}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-surface-2 border border-border text-[11.5px] font-medium text-ink">
                        Plan: {billingData.plan} ({billingData.planSource})
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-surface-2 border border-border text-[11.5px] font-mono text-ink">
                        State: {billingData.lifecycleState}
                      </span>
                      {billingData.gracePeriod?.inGracePeriod && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11.5px]">
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
                          <div key={log.id} className="flex items-center justify-between gap-2 text-muted">
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
              </Card>

              {/* Profiles Indexability & Missing Metadata Table */}
              <Card className="p-5 sm:p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode2 size={18} className="text-ink" />
                    <h2 className="text-[18px] font-semibold text-ink">
                      Public Profile Indexability Audit
                    </h2>
                  </div>
                  <span className="text-[12px] text-muted">
                    Showing {report.profiles.length} profiles
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-muted font-medium">
                        <th className="py-2.5 pr-4">Handle</th>
                        <th className="py-2.5 pr-4">Display Name</th>
                        <th className="py-2.5 pr-4">Status</th>
                        <th className="py-2.5 pr-4">Indexability</th>
                        <th className="py-2.5 pr-4">Bio / Avatar</th>
                        <th className="py-2.5 text-right">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {report.profiles.map((p) => (
                        <tr key={p.username} className="hover:bg-surface-2/60">
                          <td className="py-2.5 pr-4 font-mono text-ink">
                            <a
                              href={`/@${encodeURIComponent(p.username)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              /@{p.username}
                            </a>
                          </td>
                          <td className="py-2.5 pr-4 text-ink">{p.displayName}</td>
                          <td className="py-2.5 pr-4 capitalize text-muted">{p.status}</td>
                          <td className="py-2.5 pr-4">
                            {p.indexable ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                <CheckCircle2 size={13} /> Indexable
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700">
                                <AlertTriangle size={13} /> {p.reason}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-muted">
                            {p.hasBio ? 'Bio OK' : 'Short/No bio'} ·{' '}
                            {p.hasAvatar ? 'Photo' : 'Monogram OG'}
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setInspectUsername(p.username);
                                  handleValidateProfile(undefined, p.username);
                                }}
                                className="px-2 py-0.5 text-[11px] font-medium text-ink rounded-[5px] border border-border bg-surface hover:bg-surface-2 cursor-pointer"
                              >
                                Check
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setBillingUsername(p.username);
                                  handleInspectBilling(undefined, p.username);
                                  document.getElementById('billing-inspector')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                                className="px-2 py-0.5 text-[11px] font-medium text-ink rounded-[5px] border border-border bg-surface hover:bg-surface-2 cursor-pointer"
                              >
                                Plan
                              </button>
                              <button
                                type="button"
                                disabled={moderatingUsername === p.username}
                                onClick={() => handleModerateBackground(p.username)}
                                className="px-2 py-0.5 text-[11px] font-medium text-red-600 rounded-[5px] border border-red-200 bg-surface hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                              >
                                {moderatingUsername === p.username ? 'Resetting...' : 'Reset BG'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          ) : null}
        </Container>
      </main>
    </div>
  );
};

export default SeoAdminPage;
