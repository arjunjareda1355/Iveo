import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import type {
  BlueskyBlockVariant,
  BlueskyConfig,
} from '../../data/types';
import {
  normalizeBlueskyActorInput,
  parseBlueskyPostInput,
  validateBlueskyActor,
} from '../../lib/blueskyFacets';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { BlueskySocialIcon } from '../phone/SocialIcons';
import type {
  NormalizedBlueskyPost,
  NormalizedBlueskyProfile,
} from '../../../api/_lib/bluesky';

interface BlueskyComposerProps {
  initialVariant?: BlueskyBlockVariant;
  initialValues?: BlueskyConfig | null;
  initialTitle?: string;
  initialUrl?: string | null;
  isEditing?: boolean;
  onSave: (payload: {
    title: string;
    url: string;
    bluesky: BlueskyConfig;
  }) => Promise<void>;
  onCancel: () => void;
}

type PreviewStatus = 'idle' | 'invalid' | 'loading' | 'found' | 'error';

export const BlueskyComposer: React.FC<BlueskyComposerProps> = ({
  initialVariant,
  initialValues,
  initialTitle,
  initialUrl,
  isEditing = false,
  onSave,
  onCancel,
}) => {
  const [variant, setVariant] = useState<BlueskyBlockVariant>(
    initialValues?.variant || initialVariant || 'profile'
  );
  const [actorInput, setActorInput] = useState<string>(
    initialValues?.handle ||
      (initialVariant !== 'post' && initialUrl ? initialUrl : '') ||
      ''
  );
  const [postInput, setPostInput] = useState<string>(
    initialValues?.postUri ||
      (initialVariant === 'post' && initialUrl ? initialUrl : '') ||
      ''
  );
  const [titleOverride, setTitleOverride] = useState<string>(initialTitle || '');

  // Options
  const [showBanner, setShowBanner] = useState<boolean>(
    initialValues?.options?.showBanner ?? true
  );
  const [showStats, setShowStats] = useState<boolean>(
    initialValues?.options?.showStats ?? true
  );
  const [showBio, setShowBio] = useState<boolean>(
    initialValues?.options?.showBio ?? true
  );
  const [compact, setCompact] = useState<boolean>(
    initialValues?.options?.compact ?? false
  );
  const [buttonLabel, setButtonLabel] = useState<string>(
    initialValues?.options?.buttonLabel || ''
  );
  const [limit, setLimit] = useState<number>(
    Math.max(1, Math.min(10, Number(initialValues?.options?.limit ?? 3)))
  );
  const [layout, setLayout] = useState<'list' | 'carousel'>(
    initialValues?.options?.layout || 'list'
  );
  const [showReplies, setShowReplies] = useState<boolean>(
    initialValues?.options?.showReplies ?? false
  );
  const [showReposts, setShowReposts] = useState<boolean>(
    initialValues?.options?.showReposts ?? false
  );
  const [mediaOnly, setMediaOnly] = useState<boolean>(
    initialValues?.options?.mediaOnly ?? false
  );
  const [showCounts, setShowCounts] = useState<boolean>(
    initialValues?.options?.showCounts ?? true
  );
  const [includeFollowerBadge, setIncludeFollowerBadge] = useState<boolean>(
    initialValues?.options?.includeFollowerBadge ?? false
  );

  // Optional bio verification (OFF by default)
  const [showVerifyBox, setShowVerifyBox] = useState<boolean>(
    Boolean(initialValues?.verified)
  );
  const [verificationCode] = useState<string>(
    () =>
      initialValues?.verificationCode ||
      `iveo-${Math.random().toString(36).slice(2, 7)}`
  );
  const [verified, setVerified] = useState<boolean>(
    Boolean(initialValues?.verified)
  );

  // Live API preview state
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [resolvedProfile, setResolvedProfile] =
    useState<NormalizedBlueskyProfile | null>(null);
  const [resolvedPost, setResolvedPost] =
    useState<NormalizedBlueskyPost | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 500ms debounced profile lookup for profile / posts / button variants
  useEffect(() => {
    if (variant === 'post') return;
    const raw = actorInput.trim();
    if (!raw) {
      setStatus('idle');
      setStatusMessage(null);
      setResolvedProfile(null);
      return;
    }

    const validation = validateBlueskyActor(raw);
    if (!validation.valid) {
      setStatus('invalid');
      setStatusMessage(
        'Enter a valid handle (like alice.bsky.social), profile URL, or did:plc: ID.'
      );
      setResolvedProfile(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setStatusMessage(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/bluesky/profile?actor=${encodeURIComponent(validation.normalized)}`
        );
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.ok && data?.ok && data.profile) {
          const p: NormalizedBlueskyProfile = data.profile;
          setResolvedProfile(p);
          setStatus('found');
          setStatusMessage('Profile found');
          if (
            verificationCode &&
            p.description &&
            p.description.includes(verificationCode)
          ) {
            setVerified(true);
          }
        } else if (res.status === 403) {
          setResolvedProfile(null);
          setStatus('error');
          setStatusMessage("This profile isn't public");
        } else if (res.status === 404 || res.status === 400) {
          setResolvedProfile(null);
          setStatus('error');
          setStatusMessage("We couldn't find that Bluesky account");
        } else {
          setResolvedProfile(null);
          setStatus('error');
          setStatusMessage(
            data?.message || 'Bluesky is slow right now, try again'
          );
        }
      } catch {
        if (!cancelled) {
          setResolvedProfile(null);
          setStatus('error');
          setStatusMessage('Bluesky is slow right now, try again');
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [variant, actorInput, verificationCode]);

  // 500ms debounced single post lookup for post variant
  useEffect(() => {
    if (variant !== 'post') return;
    const raw = postInput.trim();
    if (!raw) {
      setStatus('idle');
      setStatusMessage(null);
      setResolvedPost(null);
      return;
    }

    const parsed = parseBlueskyPostInput(raw);
    if (!parsed.valid) {
      setStatus('invalid');
      setStatusMessage(
        'Paste a valid https://bsky.app/profile/.../post/... URL or at:// URI.'
      );
      setResolvedPost(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setStatusMessage(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bluesky/post?uri=${encodeURIComponent(raw)}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.ok && data?.ok && data.post) {
          setResolvedPost(data.post);
          setStatus('found');
          setStatusMessage('Post found');
        } else if (res.status === 403) {
          setResolvedPost(null);
          setStatus('error');
          setStatusMessage("This profile isn't public");
        } else if (res.status === 404) {
          setResolvedPost(null);
          setStatus('error');
          setStatusMessage("We couldn't find that Bluesky post");
        } else {
          setResolvedPost(null);
          setStatus('error');
          setStatusMessage(
            data?.message || 'Bluesky is slow right now, try again'
          );
        }
      } catch {
        if (!cancelled) {
          setResolvedPost(null);
          setStatus('error');
          setStatusMessage('Bluesky is slow right now, try again');
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [variant, postInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError(null);

    if (variant === 'post') {
      const parsed = parseBlueskyPostInput(postInput.trim());
      if (!parsed.valid) {
        setSubmitError(
          'Enter a valid bsky.app post URL or at:// URI first.'
        );
        return;
      }

      const finalHandle =
        resolvedPost?.author.handle ||
        ('actor' in parsed ? parsed.actor : '') ||
        normalizeBlueskyActorInput(actorInput);
      const finalDid = resolvedPost?.author.did || initialValues?.did || null;
      const finalPostUri = resolvedPost?.uri || ('uri' in parsed ? parsed.uri : '');
      const finalWebUrl =
        resolvedPost?.webUrl ||
        (finalHandle
          ? `https://bsky.app/profile/${encodeURIComponent(finalHandle)}`
          : 'https://bsky.app');

      setIsSubmitting(true);
      try {
        await onSave({
          title:
            titleOverride.trim() ||
            (resolvedPost?.author.displayName
              ? `${resolvedPost.author.displayName} on Bluesky`
              : 'Bluesky Post'),
          url: finalWebUrl,
          bluesky: {
            type: 'bluesky_post',
            variant: 'post',
            handle: finalHandle || 'bsky.app',
            did: finalDid,
            postUri: finalPostUri || postInput.trim(),
            displayName: resolvedPost?.author.displayName || null,
            avatarUrl: resolvedPost?.author.avatar || null,
            options: {
              showCounts,
            },
          },
        });
      } catch {
        setSubmitError("Couldn't save Bluesky post. Try again.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const validation = validateBlueskyActor(actorInput);
    if (!validation.valid) {
      setSubmitError('Enter a valid Bluesky handle, profile link, or DID.');
      return;
    }

    const savedHandle =
      resolvedProfile?.handle ||
      (validation.kind === 'handle'
        ? validation.normalized
        : initialValues?.handle || validation.normalized);
    const savedDid =
      resolvedProfile?.did ||
      (validation.kind === 'did'
        ? validation.normalized
        : initialValues?.did || null);

    const typeMap: Record<BlueskyBlockVariant, BlueskyConfig['type']> = {
      profile: 'bluesky_profile',
      posts: 'bluesky_posts',
      post: 'bluesky_post',
      button: 'bluesky_button',
    };

    const defaultTitle =
      variant === 'button'
        ? buttonLabel.trim() || `@${savedHandle} on Bluesky`
        : resolvedProfile?.displayName || `@${savedHandle}`;

    setIsSubmitting(true);
    try {
      await onSave({
        title: titleOverride.trim() || defaultTitle,
        url: `https://bsky.app/profile/${encodeURIComponent(savedHandle)}`,
        bluesky: {
          type: typeMap[variant],
          variant,
          handle: savedHandle,
          did: savedDid,
          verified,
          verificationCode: showVerifyBox ? verificationCode : null,
          displayName: resolvedProfile?.displayName || initialValues?.displayName || null,
          avatarUrl: resolvedProfile?.avatar || initialValues?.avatarUrl || null,
          followersCount:
            resolvedProfile?.followersCount ?? initialValues?.followersCount ?? null,
          options: {
            limit,
            layout,
            showReplies,
            showReposts,
            showCounts,
            mediaOnly,
            compact,
            showBanner,
            showStats,
            showBio,
            buttonLabel: buttonLabel.trim() || null,
            includeFollowerBadge,
          },
        },
      });
    } catch {
      setSubmitError("Couldn't save Bluesky block. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5 border-ink/25 shadow-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-divider">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-[10px] bg-sky-50 text-[#0085FF] flex items-center justify-center shrink-0">
              <BlueskySocialIcon size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[16px] font-semibold text-ink truncate">
                {isEditing ? 'Edit Bluesky block' : 'Add Bluesky'}
              </h3>
              <p className="text-[12px] text-muted truncate">
                Public profile data only — no Bluesky password required.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Block Variant Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {(
            [
              { id: 'profile', label: 'Profile card' },
              { id: 'posts', label: 'Latest posts' },
              { id: 'post', label: 'Single post' },
              { id: 'button', label: 'Link button' },
            ] as const
          ).map((item) => {
            const active = variant === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setVariant(item.id);
                  setSubmitError(null);
                }}
                className={`min-h-[38px] px-2.5 py-1.5 rounded-[10px] text-[12.5px] font-medium border transition-colors cursor-pointer ${
                  active
                    ? 'bg-ink text-surface border-ink'
                    : 'bg-surface border-border text-muted hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Input Field */}
        {variant === 'post' ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bsky-post-input" className="text-[13px] font-medium text-ink">
              Bluesky post link or at:// URI
            </label>
            <input
              id="bsky-post-input"
              type="text"
              value={postInput}
              onChange={(e) => setPostInput(e.target.value)}
              placeholder="https://bsky.app/profile/alice.bsky.social/post/3k..."
              className="w-full h-11 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bsky-actor-input" className="text-[13px] font-medium text-ink">
              Bluesky handle or profile link
            </label>
            <input
              id="bsky-actor-input"
              type="text"
              value={actorInput}
              onChange={(e) => setActorInput(e.target.value)}
              placeholder="alice.bsky.social, @alice.com, or https://bsky.app/profile/..."
              className="w-full h-11 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        )}

        {/* Live Lookup Feedback */}
        {status === 'loading' && (
          <div className="p-3 rounded-[12px] border border-border bg-surface-2/60 flex items-center gap-3 animate-pulse">
            <div className="w-9 h-9 rounded-full bg-border shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-28 rounded bg-border" />
              <div className="h-2.5 w-40 rounded bg-border/70" />
            </div>
          </div>
        )}

        {status === 'found' && variant !== 'post' && resolvedProfile && (
          <div className="p-3 rounded-[12px] border border-emerald-200 bg-emerald-50/60 flex items-center gap-3">
            {resolvedProfile.avatar ? (
              <img
                src={resolvedProfile.avatar}
                alt={resolvedProfile.displayName}
                className="w-9 h-9 rounded-full object-cover shrink-0 border border-emerald-200"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#0085FF]/15 text-[#0085FF] flex items-center justify-center shrink-0">
                <BlueskySocialIcon size={16} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-800">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>{statusMessage}</span>
              </div>
              <div className="text-[13px] font-medium text-ink truncate">
                {resolvedProfile.displayName} (@{resolvedProfile.handle})
              </div>
            </div>
          </div>
        )}

        {status === 'found' && variant === 'post' && resolvedPost && (
          <div className="p-3 rounded-[12px] border border-emerald-200 bg-emerald-50/60 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-emerald-800">
                {resolvedPost.author.displayName} (@{resolvedPost.author.handle})
              </div>
              <p className="text-[12px] text-ink/80 line-clamp-2 mt-0.5">
                {resolvedPost.text || 'Post ready to embed'}
              </p>
            </div>
          </div>
        )}

        {(status === 'invalid' || status === 'error') && statusMessage && (
          <div
            className="p-3 rounded-[12px] border border-amber-200 bg-amber-50/70 flex items-center gap-2 text-[12.5px] text-amber-900"
            role="status"
          >
            <AlertCircle size={15} className="shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Variant-Specific Options */}
        {variant === 'profile' && (
          <div className="flex flex-col gap-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-ink">
                  Button label
                </label>
                <input
                  type="text"
                  maxLength={32}
                  value={buttonLabel}
                  onChange={(e) => setButtonLabel(e.target.value)}
                  placeholder="Follow on Bluesky"
                  className="h-9 px-3 bg-surface border border-border rounded-[8px] text-[13px] text-ink"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-ink">
                  Layout
                </label>
                <div className="flex gap-1.5">
                  {[
                    { val: false, label: 'Full card' },
                    { val: true, label: 'Compact' },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setCompact(opt.val)}
                      className={`flex-1 h-9 rounded-[8px] text-[12.5px] font-medium border cursor-pointer ${
                        compact === opt.val
                          ? 'bg-ink text-surface border-ink'
                          : 'bg-surface border-border text-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-[13px] text-ink">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBanner}
                  onChange={(e) => setShowBanner(e.target.checked)}
                />
                <span>Show banner</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showStats}
                  onChange={(e) => setShowStats(e.target.checked)}
                />
                <span>Show stats</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBio}
                  onChange={(e) => setShowBio(e.target.checked)}
                />
                <span>Show bio</span>
              </label>
            </div>
          </div>
        )}

        {variant === 'posts' && (
          <div className="flex flex-col gap-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-ink">
                  Posts to show ({limit})
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full accent-ink cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-ink">
                  Feed layout
                </label>
                <div className="flex gap-1.5">
                  {(['list', 'carousel'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setLayout(opt)}
                      className={`flex-1 h-9 rounded-[8px] text-[12.5px] font-medium border capitalize cursor-pointer ${
                        layout === opt
                          ? 'bg-ink text-surface border-ink'
                          : 'bg-surface border-border text-muted'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-ink">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showReplies}
                  onChange={(e) => setShowReplies(e.target.checked)}
                />
                <span>Include replies</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showReposts}
                  onChange={(e) => setShowReposts(e.target.checked)}
                />
                <span>Include reposts</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mediaOnly}
                  onChange={(e) => setMediaOnly(e.target.checked)}
                />
                <span>Media only</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCounts}
                  onChange={(e) => setShowCounts(e.target.checked)}
                />
                <span>Show counts</span>
              </label>
            </div>
          </div>
        )}

        {variant === 'post' && (
          <label className="inline-flex items-center gap-2 text-[13px] text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={showCounts}
              onChange={(e) => setShowCounts(e.target.checked)}
            />
            <span>Show reply, repost, and like counts</span>
          </label>
        )}

        {variant === 'button' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-ink">
                Button text
              </label>
              <input
                type="text"
                maxLength={60}
                value={buttonLabel || titleOverride}
                onChange={(e) => {
                  setButtonLabel(e.target.value);
                  setTitleOverride(e.target.value);
                }}
                placeholder="Follow me on Bluesky"
                className="h-9 px-3 bg-surface border border-border rounded-[8px] text-[13px] text-ink"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-[13px] text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={includeFollowerBadge}
                onChange={(e) => setIncludeFollowerBadge(e.target.checked)}
              />
              <span>Show follower count badge</span>
            </label>
          </div>
        )}

        {/* Optional Ownership Bio-Verification (Off by default) */}
        {variant !== 'post' && (
          <div className="pt-1 border-t border-divider">
            <button
              type="button"
              onClick={() => setShowVerifyBox(!showVerifyBox)}
              className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink cursor-pointer"
            >
              <ShieldCheck size={14} />
              <span>
                {verified
                  ? 'Account ownership verified via bio'
                  : 'Optional: Verify account ownership via bio code'}
              </span>
            </button>
            {showVerifyBox && (
              <div className="mt-2 p-3 rounded-[10px] bg-surface-2 border border-border text-[12px] text-ink flex flex-col gap-1">
                <span>
                  Add <code className="font-mono font-semibold px-1 py-0.5 rounded bg-surface border border-border">{verificationCode}</code> to your Bluesky bio — it marks your block automatically on next refresh.
                </span>
              </div>
            )}
          </div>
        )}

        {submitError && (
          <p className="text-[13px] text-[color:var(--error,#B3261E)] font-medium" role="alert">
            {submitError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-divider">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={isSubmitting}
          >
            {isEditing ? 'Save changes' : 'Add to page'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
