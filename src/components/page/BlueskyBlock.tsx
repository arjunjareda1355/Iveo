import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Heart,
  MessageSquare,
  Repeat2,
} from 'lucide-react';
import type { BlueskyConfig, PageBlock } from '../../data/types';
import type { VibeTokens } from '../../lib/vibes';
import {
  resolveButtonControlRadius,
  resolveCardBorderRadius,
} from '../../lib/preferences';
import { getBlockContrastPalette } from '../../lib/blockTheme';
import {
  formatBlueskyRelativeTime,
  sliceBlueskyTextByFacets,
} from '../../lib/blueskyFacets';
import { BlueskySocialIcon } from '../phone/SocialIcons';
import type {
  NormalizedBlueskyPost,
  NormalizedBlueskyProfile,
} from '../../../api/_lib/bluesky';

interface BlueskyBlockProps {
  block: PageBlock;
  tokens: VibeTokens;
  effectiveRadius: number;
  fontFamily: string;
  scale?: number;
  isPublicPage: boolean;
  onLinkClick?: (block: PageBlock) => void;
  surfaceStyle?: React.CSSProperties;
}

function formatCompactCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

class BlueskyErrorBoundary extends React.Component<
  {
    surfaceStyle?: React.CSSProperties;
    cardRadius: number;
    fontFamily: string;
    fg: string;
    muted: string;
    children: React.ReactNode;
  },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {}

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="w-full p-4 text-center text-[12px]"
          style={{
            ...this.props.surfaceStyle,
            borderRadius: `${this.props.cardRadius}px`,
            fontFamily: this.props.fontFamily,
            color: this.props.muted,
          }}
        >
          Could not display Bluesky block.
        </div>
      );
    }
    return this.props.children;
  }
}

const RichBlueskyText: React.FC<{
  text: string;
  facets: NormalizedBlueskyPost['facets'];
  accentColor: string;
}> = ({ text, facets, accentColor }) => {
  const segments = sliceBlueskyTextByFacets(text, facets);
  return (
    <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words text-left">
      {segments.map((seg, i) => {
        if (seg.kind === 'text') {
          return <React.Fragment key={i}>{seg.text}</React.Fragment>;
        }
        return (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            onClick={(e) => e.stopPropagation()}
            className="underline underline-offset-2 hover:opacity-80 font-medium"
            style={{ color: accentColor }}
          >
            {seg.text}
          </a>
        );
      })}
    </p>
  );
};

const PostCard: React.FC<{
  post: NormalizedBlueskyPost;
  showCounts: boolean;
  isPublicPage: boolean;
  block: PageBlock;
  onLinkClick?: (block: PageBlock) => void;
  palette: ReturnType<typeof getBlockContrastPalette>;
  innerRadius: number;
  controlRadius: number;
  singleMode?: boolean;
}> = ({
  post,
  showCounts,
  isPublicPage,
  block,
  onLinkClick,
  palette,
  innerRadius,
  controlRadius,
  singleMode = false,
}) => {
  const [revealed, setRevealed] = useState(false);
  const images = post.embed?.images || [];
  const visibleImages = singleMode ? images.slice(0, 4) : images.slice(0, 1);
  const ext = post.embed?.external || null;
  const quote = post.embed?.quote || null;
  const accentColor = palette.isDarkSurface ? '#60A5FA' : '#0066CC';

  const handleTrack = () => {
    if (isPublicPage) onLinkClick?.(block);
  };

  return (
    <article
      className="w-full flex flex-col gap-2.5 p-3 border text-left min-w-0"
      style={{
        borderRadius: `${innerRadius}px`,
        borderColor: palette.subtleBorder,
        backgroundColor: palette.isDarkSurface
          ? 'rgba(255,255,255,0.04)'
          : 'rgba(10,10,10,0.025)',
      }}
    >
      {post.isRepost && post.repostedBy && (
        <div
          className="inline-flex items-center gap-1 text-[11px] font-medium"
          style={{ color: palette.muted }}
        >
          <Repeat2 size={12} />
          <span className="truncate">Reposted by {post.repostedBy}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {post.author.avatar ? (
            <img
              src={post.author.avatar}
              alt={post.author.displayName || post.author.handle}
              width={28}
              height={28}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full object-cover shrink-0 border border-current/10"
            />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: '#0085FF1F',
                color: '#0085FF',
              }}
            >
              <BlueskySocialIcon size={14} />
            </div>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[12.5px] font-semibold truncate" style={{ color: palette.fg }}>
              {post.author.displayName || post.author.handle}
            </div>
            <div className="text-[11px] truncate" style={{ color: palette.muted }}>
              @{post.author.handle}
              {post.createdAt ? ` · ${formatBlueskyRelativeTime(post.createdAt)}` : ''}
            </div>
          </div>
        </div>

        <a
          href={post.webUrl}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          onClick={handleTrack}
          aria-label="View post on Bluesky"
          title="View on Bluesky"
          className="p-1.5 rounded-full hover:opacity-80 shrink-0 transition-opacity"
          style={{ color: palette.muted }}
        >
          <ExternalLink size={13} />
        </a>
      </div>

      {post.text && (
        <RichBlueskyText text={post.text} facets={post.facets} accentColor={accentColor} />
      )}

      {/* Images (lazy-loaded with explicit aspect ratio to prevent CLS) */}
      {visibleImages.length > 0 && (
        <div
          className={`relative overflow-hidden grid gap-1.5 ${
            visibleImages.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
          style={{ borderRadius: `${Math.max(6, innerRadius - 2)}px` }}
        >
          {visibleImages.map((img, idx) => {
            const ar =
              img.aspectRatio && img.aspectRatio.width > 0 && img.aspectRatio.height > 0
                ? `${img.aspectRatio.width} / ${img.aspectRatio.height}`
                : '16 / 9';
            return (
              <a
                key={`${img.thumb}-${idx}`}
                href={post.webUrl}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                onClick={handleTrack}
                className="block relative overflow-hidden bg-black/5"
                style={{
                  aspectRatio: visibleImages.length === 1 ? ar : '4 / 3',
                  borderRadius: `${Math.max(6, innerRadius - 2)}px`,
                }}
              >
                <img
                  src={img.thumb}
                  alt={img.alt || 'Bluesky post attachment'}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className={`w-full h-full object-cover block transition-all duration-200 ${
                    post.hasMediaWarning && !revealed ? 'blur-xl scale-105' : ''
                  }`}
                />
              </a>
            );
          })}

          {post.hasMediaWarning && !revealed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 p-3 text-center gap-2">
              <span className="text-[11px] font-semibold text-white">
                Sensitive content warning
              </span>
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white text-black cursor-pointer"
                style={{ borderRadius: `${controlRadius}px` }}
              >
                <Eye size={12} />
                <span>Show image</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* External link card embed */}
      {ext && (
        <a
          href={ext.uri}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          onClick={handleTrack}
          className="flex flex-col overflow-hidden border hover:opacity-90 transition-opacity"
          style={{
            borderColor: palette.subtleBorder,
            borderRadius: `${Math.max(6, innerRadius - 2)}px`,
          }}
        >
          {ext.thumb && (
            <div className="w-full aspect-video overflow-hidden bg-black/5">
              <img
                src={ext.thumb}
                alt={ext.title || ''}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover block"
              />
            </div>
          )}
          <div className="p-2.5 flex flex-col gap-0.5 min-w-0">
            <div
              className="text-[12px] font-semibold line-clamp-1"
              style={{ color: palette.fg }}
            >
              {ext.title || ext.uri}
            </div>
            {ext.description && (
              <div
                className="text-[11px] line-clamp-2"
                style={{ color: palette.muted }}
              >
                {ext.description}
              </div>
            )}
          </div>
        </a>
      )}

      {/* Quote post embed */}
      {quote && (
        <a
          href={quote.webUrl}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          onClick={handleTrack}
          className="p-2.5 border flex flex-col gap-1 hover:opacity-90 transition-opacity"
          style={{
            borderColor: palette.subtleBorder,
            borderRadius: `${Math.max(6, innerRadius - 2)}px`,
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {quote.authorAvatar && (
              <img
                src={quote.authorAvatar}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-4 h-4 rounded-full object-cover shrink-0"
              />
            )}
            <span className="text-[11px] font-semibold truncate" style={{ color: palette.fg }}>
              {quote.authorDisplayName}
            </span>
            <span className="text-[10.5px] truncate" style={{ color: palette.muted }}>
              @{quote.authorHandle}
            </span>
          </div>
          {quote.text && (
            <p className="text-[11.5px] line-clamp-3 leading-snug" style={{ color: palette.muted }}>
              {quote.text}
            </p>
          )}
        </a>
      )}

      {/* Footer stats + View on Bluesky */}
      <div
        className="flex items-center justify-between gap-2 pt-1 border-t text-[11px]"
        style={{ borderColor: palette.subtleBorder, color: palette.muted }}
      >
        {showCounts ? (
          <div className="flex items-center gap-3 tabular-nums">
            <span className="inline-flex items-center gap-1">
              <MessageSquare size={12} />
              <span>{formatCompactCount(post.replyCount)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Repeat2 size={12} />
              <span>{formatCompactCount(post.repostCount)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart size={12} />
              <span>{formatCompactCount(post.likeCount)}</span>
            </span>
          </div>
        ) : (
          <span />
        )}

        <a
          href={post.webUrl}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          onClick={handleTrack}
          className="inline-flex items-center gap-1 font-medium hover:underline shrink-0"
          style={{ color: accentColor }}
        >
          <span>View on Bluesky</span>
        </a>
      </div>
    </article>
  );
};

export const BlueskyBlock: React.FC<BlueskyBlockProps> = ({
  block,
  tokens,
  effectiveRadius,
  fontFamily,
  scale = 1,
  isPublicPage,
  onLinkClick,
  surfaceStyle,
}) => {
  const cfg: BlueskyConfig = block.bluesky || {
    variant: 'profile',
    handle: 'bsky.app',
    options: {},
  };
  const variant = cfg.variant || 'profile';
  const opts = cfg.options || {};

  const cardRadius = resolveCardBorderRadius(effectiveRadius, scale, 'card');
  const barRadius = resolveCardBorderRadius(effectiveRadius, scale, 'bar');
  const innerRadius = resolveCardBorderRadius(effectiveRadius, scale, 'inner');
  const controlRadius = resolveButtonControlRadius(effectiveRadius, scale);

  const resolvedSurface: React.CSSProperties = surfaceStyle || {
    backgroundColor: tokens.buttonBg,
    color: tokens.buttonText,
    border: tokens.buttonBorder
      ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
      : '1px solid rgba(0,0,0,0.08)',
    boxShadow: tokens.buttonShadow || 'none',
  };

  const palette = getBlockContrastPalette(resolvedSurface, tokens);

  const [profile, setProfile] = useState<NormalizedBlueskyProfile | null>(null);
  const [posts, setPosts] = useState<NormalizedBlueskyPost[]>([]);
  const [singlePost, setSinglePost] = useState<NormalizedBlueskyPost | null>(null);
  const [loading, setLoading] = useState<boolean>(
    variant !== 'button' || Boolean(opts.includeFollowerBadge)
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const actorQuery = cfg.handle || cfg.did || '';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (variant === 'button' && !opts.includeFollowerBadge) {
        setLoading(false);
        return;
      }

      if (variant === 'post') {
        const uri = (cfg.postUri || block.url || '').trim();
        if (!uri) {
          setErrorMsg('No post link set.');
          setLoading(false);
          return;
        }
        setLoading(true);
        setErrorMsg(null);
        try {
          const res = await fetch(`/api/bluesky/post?uri=${encodeURIComponent(uri)}`);
          const data = await res.json().catch(() => null);
          if (!cancelled) {
            if (res.ok && data?.ok && data.post) {
              setSinglePost(data.post);
            } else {
              setErrorMsg(data?.message || "We couldn't load this Bluesky post.");
            }
          }
        } catch {
          if (!cancelled) setErrorMsg('Bluesky is slow right now, try again');
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      if (!actorQuery) {
        setErrorMsg('No Bluesky handle configured.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMsg(null);

      try {
        const tryActors =
          cfg.handle && cfg.did && cfg.handle !== cfg.did
            ? [cfg.handle, cfg.did]
            : [actorQuery];

        let activeActor = tryActors[0];
        let profileRes = await fetch(
          `/api/bluesky/profile?actor=${encodeURIComponent(activeActor)}`
        );
        if (profileRes.status === 404 && tryActors.length > 1) {
          activeActor = tryActors[1];
          profileRes = await fetch(
            `/api/bluesky/profile?actor=${encodeURIComponent(activeActor)}`
          );
        }

        const profileJson = await profileRes.json().catch(() => null);
        if (!cancelled) {
          if (profileRes.ok && profileJson?.ok && profileJson.profile) {
            setProfile(profileJson.profile);
          } else if (variant === 'profile') {
            setErrorMsg(profileJson?.message || "We couldn't find that Bluesky account");
            setLoading(false);
            return;
          }
        }

        if (variant === 'posts') {
          const limit = Math.max(1, Math.min(10, Number(opts.limit || 3)));
          const filter = opts.mediaOnly
            ? 'posts_with_media'
            : opts.showReplies
              ? 'posts_with_replies'
              : 'posts_no_replies';
          const fetchLimit = opts.showReposts ? limit : Math.min(10, Math.max(limit * 2, 6));

          const feedRes = await fetch(
            `/api/bluesky/feed?actor=${encodeURIComponent(activeActor)}&limit=${fetchLimit}&filter=${encodeURIComponent(filter)}`
          );
          const feedJson = await feedRes.json().catch(() => null);
          if (!cancelled) {
            if (feedRes.ok && feedJson?.ok && Array.isArray(feedJson.posts)) {
              let items: NormalizedBlueskyPost[] = feedJson.posts;
              if (!opts.showReposts) {
                items = items.filter((p) => !p.isRepost);
              }
              setPosts(items.slice(0, limit));
            } else {
              setErrorMsg(feedJson?.message || 'Bluesky is slow right now, try again');
            }
          }
        }
      } catch {
        if (!cancelled) setErrorMsg('Bluesky is slow right now, try again');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [
    variant,
    actorQuery,
    cfg.handle,
    cfg.did,
    cfg.postUri,
    block.url,
    opts.limit,
    opts.mediaOnly,
    opts.showReplies,
    opts.showReposts,
    opts.includeFollowerBadge,
  ]);

  const effectiveHandle = profile?.handle || cfg.handle || 'bsky.app';
  const profileWebUrl = `https://bsky.app/profile/${encodeURIComponent(effectiveHandle)}`;

  // 1. Compact Link Button Variant
  if (variant === 'button') {
    const followerBadge =
      opts.includeFollowerBadge && profile
        ? `${formatCompactCount(profile.followersCount)} followers`
        : cfg.followersCount && opts.includeFollowerBadge
          ? `${formatCompactCount(cfg.followersCount)} followers`
          : null;

    const btnInner = (
      <div
        className="w-full relative flex items-center justify-between gap-2.5 px-3.5 transition-all duration-150 select-none"
        style={{
          ...resolvedSurface,
          color: palette.fg,
          fontFamily,
          borderRadius: `${barRadius}px`,
          minHeight: `${Math.round(44 * scale)}px`,
          paddingTop: `${Math.round(8 * scale)}px`,
          paddingBottom: `${Math.round(8 * scale)}px`,
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#0085FF1F', color: '#0085FF' }}
          >
            <BlueskySocialIcon size={Math.round(14 * scale)} />
          </span>
          <span
            className="font-medium truncate"
            style={{ fontSize: `${Math.max(12, Math.round(14 * scale))}px` }}
          >
            {block.title || opts.buttonLabel || `@${effectiveHandle}`}
          </span>
        </div>

        {followerBadge && (
          <span
            className="px-2 py-0.5 text-[10.5px] font-semibold shrink-0 whitespace-nowrap"
            style={{
              backgroundColor: palette.btnBg,
              color: palette.btnText,
              borderRadius: `${controlRadius}px`,
            }}
          >
            {followerBadge}
          </span>
        )}
      </div>
    );

    return (
      <BlueskyErrorBoundary
        surfaceStyle={resolvedSurface}
        cardRadius={barRadius}
        fontFamily={fontFamily}
        fg={palette.fg}
        muted={palette.muted}
      >
        {isPublicPage ? (
          <a
            href={profileWebUrl}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            onClick={() => onLinkClick?.(block)}
            onAuxClick={() => onLinkClick?.(block)}
            className="w-full block transition-transform duration-150 hover:scale-[1.01] active:scale-[0.99]"
            style={{ borderRadius: `${barRadius}px` }}
          >
            {btnInner}
          </a>
        ) : (
          btnInner
        )}
      </BlueskyErrorBoundary>
    );
  }

  // Loading Skeleton (Zero CLS)
  if (loading) {
    return (
      <div
        className="w-full p-4 flex flex-col gap-3 animate-pulse"
        style={{
          ...resolvedSurface,
          borderRadius: `${cardRadius}px`,
          fontFamily,
          minHeight: variant === 'profile' && !opts.compact ? '176px' : '118px',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-current/15 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 rounded bg-current/15" />
            <div className="h-2.5 w-24 rounded bg-current/10" />
          </div>
        </div>
        <div className="h-3 w-full rounded bg-current/10" />
        <div className="h-8 w-full rounded bg-current/10" />
      </div>
    );
  }

  // Friendly Error Fallback Card
  if (errorMsg) {
    return (
      <div
        className="w-full p-4 flex items-center justify-between gap-3 text-left"
        style={{
          ...resolvedSurface,
          color: palette.fg,
          borderRadius: `${cardRadius}px`,
          fontFamily,
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#0085FF1F', color: '#0085FF' }}
          >
            <BlueskySocialIcon size={16} />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold truncate">
              {block.title || 'Bluesky'}
            </div>
            <div className="text-[11.5px] truncate" style={{ color: palette.muted }}>
              {errorMsg}
            </div>
          </div>
        </div>
        <a
          href={profileWebUrl}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className="px-2.5 py-1 text-[11px] font-semibold shrink-0 whitespace-nowrap"
          style={{
            backgroundColor: palette.btnBg,
            color: palette.btnText,
            borderRadius: `${controlRadius}px`,
          }}
        >
          Open Bluesky
        </a>
      </div>
    );
  }

  // 2. Profile Card Variant
  if (variant === 'profile') {
    const showBanner = opts.showBanner !== false;
    const showStats = opts.showStats !== false;
    const showBio = opts.showBio !== false;
    const isCompact = opts.compact === true;
    const followLabel = opts.buttonLabel?.trim() || 'Follow on Bluesky';
    const displayName = profile?.displayName || cfg.displayName || effectiveHandle;
    const avatarUrl = profile?.avatar || cfg.avatarUrl || null;

    return (
      <BlueskyErrorBoundary
        surfaceStyle={resolvedSurface}
        cardRadius={cardRadius}
        fontFamily={fontFamily}
        fg={palette.fg}
        muted={palette.muted}
      >
        <div
          className="w-full overflow-hidden flex flex-col text-left select-none"
          style={{
            ...resolvedSurface,
            color: palette.fg,
            fontFamily,
            borderRadius: `${cardRadius}px`,
          }}
        >
          {!isCompact && showBanner && (
            <div
              className="w-full h-20 relative overflow-hidden shrink-0"
              style={{
                background: profile?.banner
                  ? undefined
                  : 'linear-gradient(135deg, #0085FF 0%, #0A66C2 100%)',
              }}
            >
              {profile?.banner && (
                <img
                  src={profile.banner}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover block"
                />
              )}
              <div
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/45 text-white flex items-center justify-center"
                aria-hidden="true"
              >
                <BlueskySocialIcon size={14} />
              </div>
            </div>
          )}

          <div
            className="flex flex-col gap-2.5"
            style={{
              padding: `${Math.round(14 * scale)}px`,
            }}
          >
            <div
              className={`flex items-center justify-between gap-3 ${
                !isCompact && showBanner ? '-mt-9 relative z-10' : ''
              }`}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  width={isCompact ? 42 : 54}
                  height={isCompact ? 42 : 54}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="rounded-full object-cover shrink-0 bg-white"
                  style={{
                    width: `${Math.round((isCompact ? 42 : 54) * scale)}px`,
                    height: `${Math.round((isCompact ? 42 : 54) * scale)}px`,
                    border: !isCompact && showBanner ? `3px solid ${palette.btnText}` : `1px solid ${palette.subtleBorder}`,
                  }}
                />
              ) : (
                <div
                  className="rounded-full flex items-center justify-center shrink-0"
                  style={{
                    width: `${Math.round((isCompact ? 42 : 54) * scale)}px`,
                    height: `${Math.round((isCompact ? 42 : 54) * scale)}px`,
                    backgroundColor: '#0085FF22',
                    color: '#0085FF',
                  }}
                >
                  <BlueskySocialIcon size={Math.round(20 * scale)} />
                </div>
              )}

              {isCompact && (
                <a
                  href={profileWebUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow ugc"
                  onClick={() => isPublicPage && onLinkClick?.(block)}
                  className="px-3 py-1.5 text-[11.5px] font-semibold shrink-0 whitespace-nowrap transition-transform active:scale-95"
                  style={{
                    backgroundColor: palette.btnBg,
                    color: palette.btnText,
                    borderRadius: `${controlRadius}px`,
                  }}
                >
                  {followLabel}
                </a>
              )}
            </div>

            <div className="min-w-0">
              <div
                className="font-semibold truncate leading-tight"
                style={{ fontSize: `${Math.max(13, Math.round(15 * scale))}px`, color: palette.fg }}
              >
                {displayName}
              </div>
              <div className="text-[12px] truncate" style={{ color: palette.muted }}>
                @{effectiveHandle}
              </div>
            </div>

            {showBio && profile?.description && (
              <p
                className={`text-[12.5px] leading-relaxed whitespace-pre-line break-words ${
                  isCompact ? 'line-clamp-2' : 'line-clamp-4'
                }`}
                style={{ color: palette.fg }}
              >
                {profile.description}
              </p>
            )}

            {showStats && profile && (
              <div
                className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px] tabular-nums"
                style={{ color: palette.muted }}
              >
                <span>
                  <strong style={{ color: palette.fg }}>
                    {formatCompactCount(profile.followersCount)}
                  </strong>{' '}
                  followers
                </span>
                <span>
                  <strong style={{ color: palette.fg }}>
                    {formatCompactCount(profile.followsCount)}
                  </strong>{' '}
                  following
                </span>
                <span>
                  <strong style={{ color: palette.fg }}>
                    {formatCompactCount(profile.postsCount)}
                  </strong>{' '}
                  posts
                </span>
              </div>
            )}

            {!isCompact && (
              <a
                href={profileWebUrl}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                onClick={() => isPublicPage && onLinkClick?.(block)}
                className="w-full py-2 px-3 inline-flex items-center justify-center gap-1.5 text-[12.5px] font-semibold transition-transform active:scale-[0.98]"
                style={{
                  backgroundColor: palette.btnBg,
                  color: palette.btnText,
                  borderRadius: `${controlRadius}px`,
                }}
              >
                <BlueskySocialIcon size={14} />
                <span>{followLabel}</span>
              </a>
            )}
          </div>
        </div>
      </BlueskyErrorBoundary>
    );
  }

  // 3. Single Post Variant
  if (variant === 'post') {
    return (
      <BlueskyErrorBoundary
        surfaceStyle={resolvedSurface}
        cardRadius={cardRadius}
        fontFamily={fontFamily}
        fg={palette.fg}
        muted={palette.muted}
      >
        <div
          className="w-full overflow-hidden flex flex-col gap-2.5 text-left"
          style={{
            ...resolvedSurface,
            color: palette.fg,
            fontFamily,
            borderRadius: `${cardRadius}px`,
            padding: `${Math.round(12 * scale)}px`,
          }}
        >
          {singlePost ? (
            <PostCard
              post={singlePost}
              showCounts={opts.showCounts !== false}
              isPublicPage={isPublicPage}
              block={block}
              onLinkClick={onLinkClick}
              palette={palette}
              innerRadius={innerRadius}
              controlRadius={controlRadius}
              singleMode
            />
          ) : (
            <div className="text-[12px] text-center py-3" style={{ color: palette.muted }}>
              Post unavailable.
            </div>
          )}
        </div>
      </BlueskyErrorBoundary>
    );
  }

  // 4. Latest Posts Feed (list or horizontal swipe carousel)
  const isCarousel = opts.layout === 'carousel';
  const showCounts = opts.showCounts !== false;

  const scrollCarouselBy = (dir: -1 | 1) => {
    const el = carouselRef.current;
    if (!el) return;
    const nextIdx = Math.max(0, Math.min(posts.length - 1, carouselIndex + dir));
    setCarouselIndex(nextIdx);
    el.scrollTo({
      left: nextIdx * el.clientWidth,
      behavior: 'smooth',
    });
  };

  return (
    <BlueskyErrorBoundary
      surfaceStyle={resolvedSurface}
      cardRadius={cardRadius}
      fontFamily={fontFamily}
      fg={palette.fg}
      muted={palette.muted}
    >
      <div
        className="w-full overflow-hidden flex flex-col gap-2.5 text-left"
        style={{
          ...resolvedSurface,
          color: palette.fg,
          fontFamily,
          borderRadius: `${cardRadius}px`,
          padding: `${Math.round(13 * scale)}px`,
        }}
      >
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#0085FF1F', color: '#0085FF' }}
            >
              <BlueskySocialIcon size={13} />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold truncate">
                {block.title || profile?.displayName || `@${effectiveHandle}`}
              </div>
              <div className="text-[11px] truncate" style={{ color: palette.muted }}>
                Latest on @{effectiveHandle}
              </div>
            </div>
          </div>

          <a
            href={profileWebUrl}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            onClick={() => isPublicPage && onLinkClick?.(block)}
            className="px-2.5 py-1 text-[11px] font-semibold shrink-0 whitespace-nowrap"
            style={{
              backgroundColor: palette.btnBg,
              color: palette.btnText,
              borderRadius: `${controlRadius}px`,
            }}
          >
            Follow
          </a>
        </div>

        {posts.length === 0 ? (
          <div className="text-[12px] py-4 text-center" style={{ color: palette.muted }}>
            No matching public posts yet.
          </div>
        ) : isCarousel ? (
          <div className="flex flex-col gap-2">
            <div
              ref={carouselRef}
              onScroll={() => {
                const el = carouselRef.current;
                if (!el || el.clientWidth <= 0) return;
                setCarouselIndex(Math.round(el.scrollLeft / el.clientWidth));
              }}
              className="flex overflow-x-auto snap-x snap-mandatory gap-2 scrollbar-none"
            >
              {posts.map((p) => (
                <div key={p.uri} className="w-full shrink-0 snap-center">
                  <PostCard
                    post={p}
                    showCounts={showCounts}
                    isPublicPage={isPublicPage}
                    block={block}
                    onLinkClick={onLinkClick}
                    palette={palette}
                    innerRadius={innerRadius}
                    controlRadius={controlRadius}
                  />
                </div>
              ))}
            </div>

            {posts.length > 1 && (
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => scrollCarouselBy(-1)}
                  disabled={carouselIndex <= 0}
                  aria-label="Previous Bluesky post"
                  className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full inline-flex items-center justify-center border disabled:opacity-35 cursor-pointer"
                  style={{ borderColor: palette.subtleBorder }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[11px] tabular-nums" style={{ color: palette.muted }}>
                  {carouselIndex + 1} / {posts.length}
                </span>
                <button
                  type="button"
                  onClick={() => scrollCarouselBy(1)}
                  disabled={carouselIndex >= posts.length - 1}
                  aria-label="Next Bluesky post"
                  className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full inline-flex items-center justify-center border disabled:opacity-35 cursor-pointer"
                  style={{ borderColor: palette.subtleBorder }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {posts.map((p) => (
              <PostCard
                key={p.uri}
                post={p}
                showCounts={showCounts}
                isPublicPage={isPublicPage}
                block={block}
                onLinkClick={onLinkClick}
                palette={palette}
                innerRadius={innerRadius}
                controlRadius={controlRadius}
              />
            ))}
          </div>
        )}
      </div>
    </BlueskyErrorBoundary>
  );
};
