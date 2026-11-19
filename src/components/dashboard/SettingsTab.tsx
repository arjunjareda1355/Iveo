import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Loader2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { VerifiedTick } from '../ui/VerifiedTick';
import { SubscriptionCard } from '../plan/SubscriptionCard';
import { IntegrationsCard } from './IntegrationsCard';
import { SearchSeoCard } from './SearchSeoCard';
import { ExportDataCard } from '../account/ExportDataCard';
import { DeleteAccountCard } from '../account/DeleteAccountCard';
import { useIvioSession } from '../../auth/useIvioSession';
import { useToast } from '../ui/Toast';
import {
  sanitizeUsername,
  validateUsernameSync,
  checkUsernameAvailability,
} from '../../lib/username';

const SUB_NAV_ITEMS = [
  { id: 'account', label: 'Account' },
  { id: 'plan', label: 'Plan & billing' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'seo', label: 'SEO & search' },
  { id: 'data', label: 'Data & privacy' },
  { id: 'danger', label: 'Danger zone', danger: true },
] as const;

export const SettingsTab: React.FC = () => {
  const session = useIvioSession();
  const { showToast } = useToast();

  const [activeNavId, setActiveNavId] = useState<string>('account');

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  // Scroll-spy for left desktop sub-navigation
  useEffect(() => {
    const sections = SUB_NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(
      Boolean
    ) as HTMLElement[];
    if (sections.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) {
          setActiveNavId(visible[0].target.id);
        }
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0.1 }
    );

    sections.forEach((sec) => observer.observe(sec));
    return () => observer.disconnect();
  }, []);

  // Scroll to hash target when navigating from avatar menu
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const id = window.location.hash.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveNavId(id);
    }
  }, []);

  const handleJumpTo = (id: string) => {
    setActiveNavId(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleStartEditUsername = () => {
    setUsernameInput(session.username || '');
    setUsernameError(null);
    setIsEditingUsername(true);
  };

  const handleCancelEditUsername = () => {
    setIsEditingUsername(false);
    setUsernameInput('');
    setUsernameError(null);
  };

  const handleSaveUsername = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = sanitizeUsername(usernameInput);
    if (!clean) {
      setUsernameError('Use 3 to 30 letters, numbers or hyphens.');
      return;
    }

    if (clean === session.username) {
      setIsEditingUsername(false);
      return;
    }

    const syncValidation = validateUsernameSync(clean, { email: session.primaryEmail });
    if (syncValidation.status !== 'available') {
      setUsernameError(syncValidation.message);
      return;
    }

    setIsCheckingUsername(true);
    setUsernameError(null);

    try {
      const avail = await checkUsernameAvailability(
        clean,
        session.userId || undefined,
        session.primaryEmail
      );
      if (avail.status !== 'available') {
        setUsernameError(avail.message || "That name isn't available. Try another.");
        setIsCheckingUsername(false);
        return;
      }
    } catch {
      setUsernameError('Could not verify username availability right now. Please try again.');
      setIsCheckingUsername(false);
      return;
    } finally {
      setIsCheckingUsername(false);
    }

    setIsSavingUsername(true);
    try {
      await session.updateUsername(clean);
      showToast('Address updated successfully');
      setIsEditingUsername(false);
    } catch (err: any) {
      const msg = err?.message || 'Could not update username. Please try another.';
      setUsernameError(msg);
    } finally {
      setIsSavingUsername(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[20px] sm:text-[22px] font-semibold text-ink leading-tight">
          Settings
        </h1>
        <p className="mt-1 text-[14px] text-muted">
          Manage your account, plan, integrations, search settings, and data.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] gap-8 items-start">
        {/* Desktop Sticky Left Sub-Navigation */}
        <aside className="hidden lg:flex flex-col gap-1 sticky top-28" aria-label="Settings sections">
          {SUB_NAV_ITEMS.map((item) => {
            const active = activeNavId === item.id;
            const isDanger = 'danger' in item && item.danger;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleJumpTo(item.id)}
                className={`min-h-[40px] px-3 rounded-[10px] text-left text-[13px] transition-colors cursor-pointer ${
                  active
                    ? isDanger
                      ? 'bg-red-50 text-[color:var(--error,#B3261E)] font-semibold'
                      : 'bg-surface border border-border text-ink font-semibold'
                    : isDanger
                      ? 'text-[color:var(--error,#B3261E)]/80 hover:text-[color:var(--error,#B3261E)] hover:bg-red-50/50'
                      : 'text-muted hover:text-ink hover:bg-surface-2/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </aside>

        {/* Right Grouped Settings Cards */}
        <div className="flex flex-col gap-7 min-w-0 max-w-[720px] w-full">
          {/* Account & Plan */}
          <section className="flex flex-col gap-4" aria-labelledby="settings-group-account">
            <h2
              id="settings-group-account"
              className="text-[13px] font-medium text-muted px-0.5"
            >
              Account &amp; billing
            </h2>

            {/* A1. Account Card */}
            <div id="account" className="scroll-mt-32">
              <Card className="flex flex-col gap-4">
                <h3 className="text-[16px] font-semibold text-ink leading-tight">
                  Account
                </h3>

                <div className="divide-y divide-divider">
                  {/* Email row */}
                  <div className="min-h-[52px] py-2 flex items-center justify-between gap-3 text-[14px]">
                    <span className="text-muted shrink-0">Email</span>
                    <span className="text-[14px] font-medium text-ink min-w-0 truncate text-right">
                      {session.primaryEmail || 'Not set'}
                    </span>
                  </div>

                  {/* Username row (Verified tick ONLY next to @username for Pro) */}
                  {isEditingUsername ? (
                    <div className="py-3.5 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[14px]">
                        <span className="text-muted">Username</span>
                        <button
                          type="button"
                          onClick={handleCancelEditUsername}
                          className="text-[13px] text-muted hover:text-ink cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>

                      <form onSubmit={handleSaveUsername} className="flex flex-col gap-2">
                        <div className="flex items-center rounded-[10px] border border-border bg-surface px-3 h-11 focus-within:border-ink">
                          <span className="text-[14px] text-muted font-mono select-none pr-0.5 font-medium">
                            iveo.site/@
                          </span>
                          <input
                            type="text"
                            value={usernameInput}
                            onChange={(e) => {
                              setUsernameInput(sanitizeUsername(e.target.value));
                              if (usernameError) setUsernameError(null);
                            }}
                            placeholder="yourname"
                            className="flex-1 font-mono text-[14px] text-ink bg-transparent outline-none pl-0.5 min-w-0"
                            autoFocus
                          />
                          {isCheckingUsername && (
                            <Loader2 size={14} className="animate-spin text-muted" />
                          )}
                        </div>

                        {usernameError && (
                          <p className="text-[12px] text-[color:var(--error,#B3261E)] font-medium">
                            {usernameError}
                          </p>
                        )}

                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={handleCancelEditUsername}
                            disabled={isSavingUsername}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={isSavingUsername || isCheckingUsername || !usernameInput.trim()}
                          >
                            {isSavingUsername ? 'Saving...' : 'Save address'}
                          </Button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="min-h-[52px] py-2 flex items-center justify-between gap-3 text-[14px]">
                      <span className="text-muted shrink-0">Username</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="inline-flex items-center gap-1.5 text-[14px] font-mono font-medium text-ink min-w-0">
                          <span className="truncate">@{session.username || 'not_set'}</span>
                          {session.isPro && session.username && <VerifiedTick size={14} />}
                        </span>
                        <button
                          type="button"
                          onClick={handleStartEditUsername}
                          aria-label="Edit username"
                          title="Edit username"
                          className="w-10 h-10 inline-flex items-center justify-center text-muted hover:text-ink rounded-[10px] hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
                        >
                          <Pencil size={15} strokeWidth={1.6} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Password & passkeys row */}
                  <div className="py-3 flex items-center justify-between gap-3 text-[14px]">
                    <div className="min-w-0">
                      <span className="text-ink font-medium block">Password &amp; passkeys</span>
                      <span className="text-[12px] text-muted block mt-0.5">
                        Sign in faster with fingerprint, face ID, or security key
                      </span>
                    </div>
                    <Button as={Link} to="/account#passkeys" variant="ghost" size="sm" className="shrink-0">
                      Manage
                    </Button>
                  </div>
                </div>

                <div className="pt-1">
                  <Button as={Link} to="/account" variant="secondary" size="md">
                    Account &amp; security
                  </Button>
                </div>
              </Card>
            </div>

            {/* A2. Plan & billing card */}
            <div id="plan" className="scroll-mt-32">
              <SubscriptionCard />
            </div>
          </section>

          {/* Growth & SEO */}
          <section className="flex flex-col gap-4" aria-labelledby="settings-group-growth">
            <h2
              id="settings-group-growth"
              className="text-[13px] font-medium text-muted px-0.5"
            >
              Integrations &amp; SEO
            </h2>

            <div id="integrations" className="scroll-mt-32">
              <IntegrationsCard />
            </div>

            <div id="seo" className="scroll-mt-32">
              <SearchSeoCard />
            </div>
          </section>

          {/* Data & Privacy */}
          <section className="flex flex-col gap-4" aria-labelledby="settings-group-data">
            <h2
              id="settings-group-data"
              className="text-[13px] font-medium text-muted px-0.5"
            >
              Data &amp; privacy
            </h2>

            <div id="data" className="scroll-mt-32">
              <ExportDataCard />
            </div>
          </section>

          {/* Danger Zone */}
          <section className="flex flex-col gap-4" aria-labelledby="settings-group-danger">
            <h2
              id="settings-group-danger"
              className="text-[13px] font-medium text-[color:var(--error,#B3261E)] px-0.5"
            >
              Danger zone
            </h2>

            <div id="danger" className="scroll-mt-32">
              <DeleteAccountCard
                username={session.username || session.primaryEmail?.split('@')[0] || 'account'}
                email={session.primaryEmail}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
