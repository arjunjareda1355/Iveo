import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, ExternalLink, Share2, Pencil, Check, X, Loader2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ProBadge } from '../plan/ProBadge';
import { useUpgradeDialog } from '../plan/UpgradeDialogProvider';
import { ShareDialog } from '../share/ShareDialog';
import { SubscriptionCard } from '../plan/SubscriptionCard';
import { ExportDataCard } from '../account/ExportDataCard';
import { DeleteAccountCard } from '../account/DeleteAccountCard';
import { useIvioSession } from '../../auth/useIvioSession';
import { useToast } from '../ui/Toast';
import { pageUrl } from '../../lib/site';
import {
  sanitizeUsername,
  validateUsernameSync,
  checkUsernameAvailability,
} from '../../lib/username';

export const SettingsTab: React.FC = () => {
  const session = useIvioSession();
  const { showToast } = useToast();
  const { openUpgrade } = useUpgradeDialog();
  const [isShareOpen, setIsShareOpen] = useState(false);

  const fullUrl = session.username ? pageUrl(session.username) : '';

  const handleCopyLink = async () => {
    if (!fullUrl) return;
    try {
      await navigator.clipboard.writeText(fullUrl);
      showToast('Link copied');
    } catch {}
  };

  const handleSignOut = async () => {
    await session.signOut();
  };

  const handleFooterMarkToggle = async () => {
    if (!session.isPro) {
      openUpgrade('hide_footer');
      return;
    }

    const nextVal = !(session.hideIveoFooter || session.hideIvioFooter);
    try {
      await session.updatePreferences({
        hideIveoFooter: nextVal,
        hideIvioFooter: nextVal,
      });
      showToast(nextVal ? 'Footer mark hidden.' : 'Footer mark shown.');
    } catch {
      openUpgrade('hide_footer');
    }
  };

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isSavingUsername, setIsSavingUsername] = useState(false);

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
      setUsernameError('Use 3 to 24 letters, numbers or underscores.');
      return;
    }

    if (clean === session.username) {
      setIsEditingUsername(false);
      return;
    }

    const syncValidation = validateUsernameSync(clean);
    if (syncValidation.status !== 'available') {
      setUsernameError(syncValidation.message);
      return;
    }

    setIsCheckingUsername(true);
    setUsernameError(null);

    try {
      const avail = await checkUsernameAvailability(clean);
      if (avail.status !== 'available') {
        setUsernameError(avail.message || "That name isn't available. Try another.");
        setIsCheckingUsername(false);
        return;
      }
    } catch {
      // Continue if network check fails
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
      {/* 1. Account Card */}
      <Card className="flex flex-col gap-4">
        <h3 className="text-[20px] font-semibold text-ink leading-tight">
          Account
        </h3>

        <div className="divide-y divide-border">
          {/* Email row */}
          <div className="h-14 flex items-center justify-between text-[14px]">
            <span className="text-muted">Email</span>
            <span className="text-[15px] font-medium text-ink">
              {session.primaryEmail || 'Not set'}
            </span>
          </div>

          {/* Username row */}
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
                <div className="flex items-center rounded-[8px] border border-border bg-surface px-2.5 h-10 focus-within:border-ink">
                  <span className="text-[14px] text-muted font-mono select-none">
                    iveo.site/
                  </span>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => {
                      setUsernameInput(sanitizeUsername(e.target.value));
                      if (usernameError) setUsernameError(null);
                    }}
                    placeholder="yourname"
                    className="flex-1 font-mono text-[14px] text-ink bg-transparent outline-none pl-0.5"
                    autoFocus
                  />
                  {isCheckingUsername && (
                    <Loader2 size={14} className="animate-spin text-muted" />
                  )}
                </div>

                {usernameError && (
                  <p className="text-[12px] text-red-600 font-medium">
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
            <div className="h-14 flex items-center justify-between text-[14px]">
              <span className="text-muted">Username</span>
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-mono font-medium text-ink">
                  @{session.username || 'not_set'}
                </span>
                <button
                  type="button"
                  onClick={handleStartEditUsername}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:text-ink-2 px-2 py-1 rounded-[6px] hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <Pencil size={12} />
                  <span>Change</span>
                </button>
              </div>
            </div>
          )}

          {/* Plan row */}
          <div className="py-3 flex flex-col justify-center gap-1">
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-muted">Plan</span>
              <div className="flex items-center gap-2">
                {session.isPro ? (
                  <div className="flex items-center gap-1.5">
                    <ProBadge />
                    <span className="text-[15px] font-medium text-ink">Pro</span>
                  </div>
                ) : (
                  <span className="text-[15px] font-medium text-ink">Free</span>
                )}
              </div>
            </div>

            {!session.isPro && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[13px] text-muted">
                  Standard features included.
                </span>
                <button
                  type="button"
                  onClick={() => openUpgrade()}
                  className="text-[13px] text-ink font-semibold underline underline-offset-2 hover:text-ink-2 cursor-pointer"
                >
                  Upgrade to Pro
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-2">
          <Button as={Link} to="/account" variant="secondary" size="md">
            Manage account
          </Button>
        </div>
      </Card>

      {/* 2. Subscription & Billing Card */}
      <SubscriptionCard />

      {/* 2. Your Page Card */}
      <Card className="flex flex-col gap-4">
        <h3 className="text-[20px] font-semibold text-ink leading-tight">
          Your page
        </h3>

        <div className="flex items-center gap-2 p-3 rounded-[10px] bg-surface-2 border border-border">
          <span className="font-mono text-[14px] text-ink select-all truncate flex-1">
            {fullUrl || 'https://iveo.site'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 mt-1">
          <Button
            variant="secondary"
            size="md"
            onClick={handleCopyLink}
            iconRight={<Copy size={14} />}
          >
            Copy link
          </Button>
          <Button
            variant="secondary"
            size="md"
            as="a"
            href={session.username ? `/${session.username}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            iconRight={<ExternalLink size={14} />}
          >
            View page
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setIsShareOpen(true)}
            iconRight={<Share2 size={14} />}
          >
            Share
          </Button>
        </div>

        {/* Remove the iveo mark switch */}
        <div className="pt-4 mt-2 border-t border-border flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-medium text-ink">
                Remove the iveo mark
              </span>
              <ProBadge />
            </div>
            <p className="text-[13px] text-muted max-w-[42ch]">
              Hide the 'Create your own page' link from your page. The report link always stays.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={
              session.isPro
                ? session.hideIveoFooter || session.hideIvioFooter
                : false
            }
            aria-disabled={!session.isPro}
            onClick={handleFooterMarkToggle}
            className={`w-11 h-6 rounded-full flex items-center p-0.5 transition-colors duration-120 shrink-0 focus-visible:outline-2 focus-visible:outline-ink ${
              session.isPro &&
              (session.hideIveoFooter || session.hideIvioFooter)
                ? 'bg-ink'
                : 'bg-border'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-120 ${
                session.isPro &&
                (session.hideIveoFooter || session.hideIvioFooter)
                  ? 'translate-x-5'
                  : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </Card>

      {/* 3. Your Data Card */}
      <ExportDataCard />

      {/* 4. Session Card */}
      <Card className="flex flex-col items-start gap-4">
        <div>
          <h3 className="text-[20px] font-semibold text-ink leading-tight">
            Session
          </h3>
          <p className="mt-1 text-[14px] text-muted">
            Signed in on this device.
          </p>
        </div>

        <Button variant="secondary" size="md" onClick={handleSignOut}>
          Sign out
        </Button>
      </Card>

      {/* 5. Delete Account Card */}
      {session.username && (
        <DeleteAccountCard username={session.username} />
      )}

      {/* Share Dialog */}
      {session.username && (
        <ShareDialog
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          username={session.username}
          displayName={session.displayName}
          isPublished={true}
        />
      )}
    </div>
  );
};
