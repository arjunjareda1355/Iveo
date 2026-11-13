import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
    gscSiteUrl?: string;
    bingConfigured: boolean;
    indexNowConfigured: boolean;
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
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const isDemoAdmin = searchParams.get('demo') === '1';
  const isAuthorized = isDemoAdmin || (session.isLoaded && isOwnerEmail(session.primaryEmail));
  const adminEmail = isDemoAdmin ? 'help@iveo.site' : session.primaryEmail || '';

  const [report, setReport] = useState<SeoHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [inspectUsername, setInspectUsername] = useState('maya');
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [gscResult, setGscResult] = useState<any>(null);

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
    } catch {
      setError('Failed to fetch SEO report.');
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, adminEmail]);

  useEffect(() => {
    if (isAuthorized && adminEmail) {
      loadReport();
    } else if (session.isLoaded) {
      setLoading(false);
    }
  }, [isAuthorized, adminEmail, session.isLoaded, loadReport]);

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
        { headers: { 'x-user-email': adminEmail } }
      );
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data.validation) {
        setValidation(data.validation);
      } else {
        showToast('Validation failed');
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

  if (!session.isLoaded && !isDemoAdmin) {
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
      <header className="sticky top-0 z-30 h-16 border-b border-border bg-surface">
        <Container className="h-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Logo tone="light" size="md" />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-2 border border-border text-[12px] font-mono text-muted">
              SEO Health Console
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
            >
              <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
              <span>{isRegenerating ? 'Regenerating...' : 'Regenerate & Ping'}</span>
            </Button>
            <Button as={Link} to="/dashboard" variant="ghost" size="sm">
              <ArrowLeft size={14} />
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
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2"
                  >
                    <div className="relative flex-1 min-w-[200px]">
                      <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                      />
                      <input
                        type="text"
                        value={inspectUsername}
                        onChange={(e) => setInspectUsername(e.target.value)}
                        placeholder="Enter username (e.g. maya)"
                        aria-label="Username to validate"
                        className="w-full h-10 pl-9 pr-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                      />
                    </div>
                    <Button type="submit" variant="primary" size="md" disabled={validating}>
                      {validating ? 'Checking...' : 'Validate SEO'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={handleInspectGsc}
                      disabled={validating}
                    >
                      GSC Inspect
                    </Button>
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
                            {validation.canonical || `https://iveo.site/${validation.username}`}
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
                          <span className="text-muted">
                            {gscResult.configured
                              ? `${gscResult.verdict || gscResult.coverageState || 'Inspected'}${gscResult.lastCrawlTime ? ` · Last crawl: ${gscResult.lastCrawlTime}` : ''}`
                              : gscResult.message ||
                                'GSC Service Account not configured in server environment (local validation active).'}
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
                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-2 border border-border">
                      <span className="font-medium text-ink">Google Search Console Sitemap API</span>
                      <span
                        className={`text-[12px] font-mono shrink-0 ${
                          report.searchEngines.gscConfigured ? 'text-emerald-700' : 'text-muted'
                        }`}
                      >
                        {report.searchEngines.gscConfigured ? 'Connected' : 'Ready (Env Needed)'}
                      </span>
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

                    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-border">
                      <span className="font-medium text-ink">Robots &amp; XML Endpoints</span>
                      <div className="flex items-center gap-3 text-[12px] font-mono">
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
                              href={`/${encodeURIComponent(p.username)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                            >
                              /{p.username}
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
                            <button
                              type="button"
                              onClick={() => {
                                setInspectUsername(p.username);
                                handleValidateProfile(undefined, p.username);
                              }}
                              className="text-[12px] font-medium text-ink underline underline-offset-2 hover:opacity-75 cursor-pointer"
                            >
                              Check
                            </button>
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
