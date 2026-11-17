import React, { useEffect, useState } from 'react';
import {
  ShoppingBag,
  CalendarClock,
  Timer,
  Ticket,
  Copy,
  Check,
  MapPin,
  FileDown,
  Youtube,
  Play,
  ExternalLink,
} from 'lucide-react';
import { PageBlock } from '../../data/types';
import { VibeTokens } from '../../lib/vibes';
import { formatExternalUrl } from '../../lib/urls';
import {
  resolveCardBorderRadius,
  resolveButtonControlRadius,
} from '../../lib/preferences';

interface SharedBlockRenderProps {
  block: PageBlock;
  tokens: VibeTokens;
  effectiveRadius: number;
  fontFamily: string;
  scale: number;
  isPublicPage: boolean;
  onLinkClick?: (block: PageBlock) => void;
  surfaceStyle: React.CSSProperties;
}

function resolveCardPalette(surfaceStyle: React.CSSProperties, tokens: VibeTokens) {
  const fg = String(surfaceStyle.color || tokens.buttonText || tokens.text || '#0A0A0A');
  const upper = fg.toUpperCase();
  const isLightFg =
    upper === '#FFFFFF' ||
    upper === '#FAFAFA' ||
    upper === '#F8FAFC' ||
    upper === '#F5F5F5';
  const pillBg = fg;
  const pillText =
    typeof surfaceStyle.backgroundColor === 'string' &&
    surfaceStyle.backgroundColor.startsWith('#') &&
    surfaceStyle.backgroundColor !== 'transparent'
      ? surfaceStyle.backgroundColor
      : isLightFg
        ? '#0A0A0A'
        : '#FFFFFF';
  return { fg, pillBg, pillText };
}

export const YouTubeShowcaseCard: React.FC<SharedBlockRenderProps> = ({
  block,
  tokens,
  effectiveRadius,
  fontFamily,
  scale,
  isPublicPage,
  onLinkClick,
  surfaceStyle,
}) => {
  const ytUrl = block.url ? formatExternalUrl(block.url) : 'https://youtube.com';
  const [liveEnriched, setLiveEnriched] = useState<{
    avatarUrl?: string | null;
    channelTitle?: string | null;
    handle?: string | null;
    subscriberText?: string | null;
    latestVideos?: { id: string; title: string; thumbnailUrl?: string | null; url: string }[];
  } | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [failedThumbIds, setFailedThumbIds] = useState<Record<string, boolean>>({});

  const storedYt = block.youtube;
  const shouldEnrich =
    isPublicPage &&
    Boolean(block.url) &&
    (storedYt?.showLatestVideo ?? true) &&
    (!Array.isArray(storedYt?.latestVideos) || storedYt.latestVideos.length === 0 || !storedYt?.avatarUrl);

  useEffect(() => {
    setAvatarFailed(false);
    setFailedThumbIds({});
  }, [storedYt?.avatarUrl, block.url]);

  useEffect(() => {
    if (!shouldEnrich || !block.url) return;
    let cancelled = false;
    fetch(`/api/integrations/youtube?url=${encodeURIComponent(block.url)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok || !data?.channel) return;
        const ch = data.channel;
        const mappedVideos = Array.isArray(ch.latestVideos)
          ? ch.latestVideos.map((v: any) => ({
              id: String(v.videoId || v.id || ''),
              title: String(v.title || 'Watch on YouTube'),
              thumbnailUrl: v.thumbnailUrl || null,
              url: String(v.url || ''),
            }))
          : [];
        setLiveEnriched({
          avatarUrl: ch.avatarUrl || null,
          channelTitle: ch.channelTitle || null,
          handle: ch.handle || null,
          subscriberText: ch.subscriberCountText || null,
          latestVideos: mappedVideos,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [shouldEnrich, block.url]);

  const effectiveAvatarUrl = storedYt?.avatarUrl || liveEnriched?.avatarUrl || null;
  const effectiveChannelTitle = storedYt?.channelTitle || liveEnriched?.channelTitle || null;
  const effectiveHandle = storedYt?.handle || liveEnriched?.handle || null;
  const effectiveSubscriberText = storedYt?.subscriberText || liveEnriched?.subscriberText || null;
  const rawVideos =
    Array.isArray(storedYt?.latestVideos) && storedYt.latestVideos.length > 0
      ? storedYt.latestVideos
      : liveEnriched?.latestVideos || [];

  const ctaLabel = storedYt?.buttonLabel?.trim() || 'Subscribe';
  const videos =
    (storedYt?.showLatestVideo ?? true) && Array.isArray(rawVideos)
      ? rawVideos.slice(0, 3)
      : [];
  const { fg } = resolveCardPalette(surfaceStyle, tokens);
  const upperFg = fg.toUpperCase();
  const isLightFg =
    upperFg === '#FFFFFF' ||
    upperFg === '#FAFAFA' ||
    upperFg === '#F8FAFC' ||
    upperFg === '#F5F5F5';
  const cardRadius = resolveCardBorderRadius(effectiveRadius, scale, 'card');
  const innerRadius = resolveCardBorderRadius(effectiveRadius, scale, 'inner');
  const controlRadius = resolveButtonControlRadius(effectiveRadius, scale);

  const channelIdentity = (
    <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-1">
      {effectiveAvatarUrl && !avatarFailed ? (
        <img
          src={effectiveAvatarUrl}
          alt={block.title || 'YouTube'}
          referrerPolicy="no-referrer"
          onError={() => setAvatarFailed(true)}
          className="object-cover shrink-0 border border-current/20"
          style={{
            width: `${Math.round(36 * scale)}px`,
            height: `${Math.round(36 * scale)}px`,
            borderRadius: '9999px',
          }}
        />
      ) : (
        <div
          className="bg-red-600 flex items-center justify-center text-white shrink-0 shadow-xs"
          style={{
            width: `${Math.round(34 * scale)}px`,
            height: `${Math.round(34 * scale)}px`,
            borderRadius: `${innerRadius}px`,
          }}
        >
          <Youtube size={Math.round(16 * scale)} strokeWidth={2} />
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0 text-left">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="font-semibold truncate leading-tight"
            style={{
              fontSize: `${Math.max(12, Math.round(13.5 * scale))}px`,
              color: fg,
            }}
          >
            {block.title || effectiveChannelTitle || 'YouTube Channel'}
          </span>
          {effectiveSubscriberText && (
            <span
              className={`px-1.5 py-0.5 text-[9px] font-semibold shrink-0 whitespace-nowrap border ${
                isLightFg
                  ? 'bg-red-500/25 text-red-100 border-red-400/35'
                  : 'bg-red-600/12 text-red-700 border-red-600/20'
              }`}
              style={{ borderRadius: `${controlRadius}px` }}
            >
              {effectiveSubscriberText}
            </span>
          )}
        </div>
        <span className="text-[11px] opacity-75 truncate">
          {block.badge || effectiveHandle || 'Subscribe for new videos'}
        </span>
      </div>
    </div>
  );

  return (
    <div
      className="w-full overflow-hidden flex flex-col gap-2.5 transition-all duration-150 select-none"
      style={{
        ...surfaceStyle,
        color: fg,
        fontFamily,
        borderRadius: `${cardRadius}px`,
        padding: `${Math.round(13 * scale)}px ${Math.round(14 * scale)}px`,
      }}
    >
      <div className="w-full flex items-center justify-between gap-2.5">
        {isPublicPage ? (
          <a
            href={ytUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onLinkClick?.(block)}
            className="flex-1 min-w-0 flex items-center hover:opacity-85 transition-opacity"
          >
            {channelIdentity}
          </a>
        ) : (
          channelIdentity
        )}

        {isPublicPage ? (
          <a
            href={ytUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onLinkClick?.(block)}
            className="px-2.5 py-1 text-[11px] font-semibold shrink-0 whitespace-nowrap bg-red-600 text-white transition-transform active:scale-95"
            style={{ borderRadius: `${controlRadius}px` }}
          >
            {ctaLabel}
          </a>
        ) : (
          <span
            className="px-2.5 py-1 text-[11px] font-semibold shrink-0 whitespace-nowrap bg-red-600 text-white"
            style={{ borderRadius: `${controlRadius}px` }}
          >
            {ctaLabel}
          </span>
        )}
      </div>

      {videos.length > 0 && (
        <div
          className={`grid gap-1.5 pt-1.5 border-t border-current/10 ${
            videos.length === 1
              ? 'grid-cols-1'
              : videos.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-3'
          }`}
        >
          {videos.map((vid, idx) => {
            const vidUrl = formatExternalUrl(vid.url || ytUrl);
            const thumbKey = vid.id || String(idx);
            const thumbBroken = Boolean(failedThumbIds[thumbKey]);
            const cardInner = (
              <div
                className="overflow-hidden border border-current/15 bg-black/5 flex flex-col"
                style={{ borderRadius: `${innerRadius}px` }}
              >
                <div className="relative aspect-video bg-neutral-900">
                  {vid.thumbnailUrl && !thumbBroken && (
                    <img
                      src={vid.thumbnailUrl}
                      alt={vid.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedThumbIds((prev) => ({ ...prev, [thumbKey]: true }))
                      }
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs">
                      <Play size={10} className="ml-0.5 fill-white" />
                    </div>
                  </div>
                </div>
                <div
                  className="px-1.5 py-1 font-medium line-clamp-1 text-left"
                  style={{
                    fontSize: `${Math.max(10, Math.round(10.5 * scale))}px`,
                    color: fg,
                  }}
                >
                  {vid.title}
                </div>
              </div>
            );

            return isPublicPage ? (
              <a
                key={vid.id || idx}
                href={vidUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onLinkClick?.(block)}
                className="block transition-transform hover:scale-[1.02]"
              >
                {cardInner}
              </a>
            ) : (
              <div key={vid.id || idx}>{cardInner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ProductShowcaseCard: React.FC<SharedBlockRenderProps> = ({
  block,
  tokens,
  effectiveRadius,
  fontFamily,
  scale,
  isPublicPage,
  onLinkClick,
  surfaceStyle,
}) => {
  const cfg = block.product;
  if (!cfg) return null;
  const href = block.url ? formatExternalUrl(block.url) : '#';
  const cta = cfg.buttonLabel?.trim() || 'Buy Now';
  const { fg, pillBg, pillText } = resolveCardPalette(surfaceStyle, tokens);
  const cardRadius = resolveCardBorderRadius(effectiveRadius, scale, 'card');
  const innerRadius = resolveCardBorderRadius(effectiveRadius, scale, 'inner');
  const controlRadius = resolveButtonControlRadius(effectiveRadius, scale);

  const body = (
    <div
      className="w-full overflow-hidden flex items-center justify-between gap-2.5 transition-all duration-150 select-none text-left"
      style={{
        ...surfaceStyle,
        color: fg,
        fontFamily,
        borderRadius: `${cardRadius}px`,
        padding: `${Math.round(11 * scale)}px ${Math.round(14 * scale)}px`,
      }}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {cfg.imageUrl ? (
          <img
            src={cfg.imageUrl}
            alt={block.title}
            referrerPolicy="no-referrer"
            className="object-cover shrink-0 border border-current/15"
            style={{
              width: `${Math.round(42 * scale)}px`,
              height: `${Math.round(42 * scale)}px`,
              borderRadius: `${innerRadius}px`,
            }}
          />
        ) : (
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: `${Math.round(38 * scale)}px`,
              height: `${Math.round(38 * scale)}px`,
              borderRadius: `${innerRadius}px`,
              backgroundColor: `${fg}14`,
              color: fg,
            }}
          >
            <ShoppingBag size={Math.round(17 * scale)} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {cfg.tag && (
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-75 block leading-none mb-0.5 truncate">
              {cfg.tag}
            </span>
          )}
          <div
            className="font-semibold truncate leading-tight"
            style={{ fontSize: `${Math.max(12, Math.round(13.5 * scale))}px` }}
          >
            {block.title}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] mt-0.5 min-w-0">
            <span className="font-bold shrink-0">{cfg.price}</span>
            {cfg.compareAtPrice && (
              <span className="line-through opacity-60 shrink-0">
                {cfg.compareAtPrice}
              </span>
            )}
            {cfg.description && (
              <span className="opacity-75 truncate">· {cfg.description}</span>
            )}
          </div>
        </div>
      </div>

      <span
        className="px-2.5 py-1 text-[11px] font-semibold shrink-0 whitespace-nowrap inline-flex items-center gap-1"
        style={{
          backgroundColor: pillBg,
          color: pillText,
          borderRadius: `${controlRadius}px`,
        }}
      >
        <span>{cta}</span>
        <ExternalLink size={10} />
      </span>
    </div>
  );

  if (isPublicPage && block.url) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={() => onLinkClick?.(block)}
        className="w-full block transition-transform hover:scale-[1.01] active:scale-[0.99]"
        style={{ borderRadius: `${cardRadius}px` }}
      >
        {body}
      </a>
    );
  }
  return body;
};

export const BookingShowcaseCard: React.FC<SharedBlockRenderProps> = ({
  block,
  tokens,
  effectiveRadius,
  fontFamily,
  scale,
  isPublicPage,
  onLinkClick,
  surfaceStyle,
}) => {
  const cfg = block.booking;
  if (!cfg) return null;
  const href = block.url ? formatExternalUrl(block.url) : '#';
  const cta = cfg.buttonLabel?.trim() || 'Book Slot';
  const { fg, pillBg, pillText } = resolveCardPalette(surfaceStyle, tokens);
  const cardRadius = resolveCardBorderRadius(effectiveRadius, scale, 'card');
  const innerRadius = resolveCardBorderRadius(effectiveRadius, scale, 'inner');
  const controlRadius = resolveButtonControlRadius(effectiveRadius, scale);

  const body = (
    <div
      className="w-full overflow-hidden flex items-center justify-between gap-2.5 transition-all duration-150 select-none text-left"
      style={{
        ...surfaceStyle,
        color: fg,
        fontFamily,
        borderRadius: `${cardRadius}px`,
        padding: `${Math.round(11 * scale)}px ${Math.round(14 * scale)}px`,
      }}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: `${Math.round(36 * scale)}px`,
            height: `${Math.round(36 * scale)}px`,
            borderRadius: `${innerRadius}px`,
            backgroundColor: `${fg}14`,
          }}
        >
          <CalendarClock size={Math.round(17 * scale)} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="font-semibold truncate leading-tight"
            style={{ fontSize: `${Math.max(12, Math.round(13.5 * scale))}px` }}
          >
            {block.title}
          </div>
          <div className="text-[11px] opacity-80 truncate mt-0.5">
            {[cfg.duration, cfg.priceLabel, cfg.platform].filter(Boolean).join(' · ')}
          </div>
          {cfg.description && (
            <div className="text-[10px] opacity-65 truncate">{cfg.description}</div>
          )}
        </div>
      </div>

      <span
        className="px-2.5 py-1 text-[11px] font-semibold shrink-0 whitespace-nowrap"
        style={{
          backgroundColor: pillBg,
          color: pillText,
          borderRadius: `${controlRadius}px`,
        }}
      >
        {cta}
      </span>
    </div>
  );

  if (isPublicPage && block.url) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={() => onLinkClick?.(block)}
        className="w-full block transition-transform hover:scale-[1.01] active:scale-[0.99]"
        style={{ borderRadius: `${cardRadius}px` }}
      >
        {body}
      </a>
    );
  }
  return body;
};

export const CountdownShowcaseCard: React.FC<SharedBlockRenderProps> = ({
  block,
  tokens,
  effectiveRadius,
  fontFamily,
  scale,
  isPublicPage,
  onLinkClick,
  surfaceStyle,
}) => {
  const cfg = block.countdown;
  const [now, setNow] = useState(() => Date.now());
  const { fg, pillBg, pillText } = resolveCardPalette(surfaceStyle, tokens);
  const cardRadius = resolveCardBorderRadius(effectiveRadius, scale, 'card');
  const innerRadius = resolveCardBorderRadius(effectiveRadius, scale, 'inner');
  const controlRadius = resolveButtonControlRadius(effectiveRadius, scale);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!cfg) return null;

  const targetMs = new Date(cfg.targetAt).getTime();
  const diff = Math.max(0, Number.isNaN(targetMs) ? 0 : targetMs - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);

  return (
    <div
      className="w-full overflow-hidden flex flex-col items-center text-center gap-2 select-none"
      style={{
        ...surfaceStyle,
        color: fg,
        fontFamily,
        borderRadius: `${cardRadius}px`,
        padding: `${Math.round(14 * scale)}px`,
      }}
    >
      <div className="flex items-center gap-1.5 max-w-full">
        <Timer size={Math.round(14 * scale)} className="opacity-80 shrink-0" />
        <span
          className="font-semibold leading-tight truncate"
          style={{ fontSize: `${Math.max(12, Math.round(14 * scale))}px` }}
        >
          {block.title}
        </span>
      </div>

      {cfg.venueOrSubtitle && (
        <span className="text-[11px] opacity-75 leading-tight max-w-full truncate">
          {cfg.venueOrSubtitle}
        </span>
      )}

      {diff > 0 ? (
        <div className="grid grid-cols-4 gap-1.5 w-full max-w-[260px] my-0.5">
          {[
            { label: 'Days', val: days },
            { label: 'Hrs', val: hours },
            { label: 'Min', val: mins },
            { label: 'Sec', val: secs },
          ].map((u) => (
            <div
              key={u.label}
              className="py-1.5 px-1 flex flex-col items-center border border-current/15"
              style={{
                backgroundColor: `${fg}10`,
                borderRadius: `${innerRadius}px`,
              }}
            >
              <span className="font-mono font-bold text-[15px] leading-none">
                {String(u.val).padStart(2, '0')}
              </span>
              <span className="text-[9px] uppercase tracking-wider opacity-70 mt-0.5">
                {u.label}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="px-3 py-1 text-[12px] font-semibold"
          style={{
            backgroundColor: `${fg}18`,
            borderRadius: `${controlRadius}px`,
          }}
        >
          {cfg.expiredLabel || 'Live Now'}
        </div>
      )}

      {block.url && cfg.buttonLabel && (
        isPublicPage ? (
          <a
            href={formatExternalUrl(block.url)}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={() => onLinkClick?.(block)}
            className="mt-0.5 px-4 py-1.5 text-[12px] font-semibold transition-transform active:scale-95"
            style={{
              backgroundColor: pillBg,
              color: pillText,
              borderRadius: `${controlRadius}px`,
            }}
          >
            {cfg.buttonLabel}
          </a>
        ) : (
          <span
            className="mt-0.5 px-4 py-1.5 text-[12px] font-semibold"
            style={{
              backgroundColor: pillBg,
              color: pillText,
              borderRadius: `${controlRadius}px`,
            }}
          >
            {cfg.buttonLabel}
          </span>
        )
      )}
    </div>
  );
};

export const PromoShowcaseCard: React.FC<SharedBlockRenderProps> = ({
  block,
  tokens,
  effectiveRadius,
  fontFamily,
  scale,
  isPublicPage,
  onLinkClick,
  surfaceStyle,
}) => {
  const cfg = block.promo;
  const [copied, setCopied] = useState(false);
  if (!cfg) return null;
  const { fg, pillBg, pillText } = resolveCardPalette(surfaceStyle, tokens);
  const cardRadius = resolveCardBorderRadius(effectiveRadius, scale, 'card');
  const innerRadius = resolveCardBorderRadius(effectiveRadius, scale, 'inner');
  const controlRadius = resolveButtonControlRadius(effectiveRadius, scale);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(cfg.code);
      setCopied(true);
      onLinkClick?.(block);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div
      className="w-full overflow-hidden flex flex-col gap-2 select-none"
      style={{
        ...surfaceStyle,
        color: fg,
        fontFamily,
        borderRadius: `${cardRadius}px`,
        padding: `${Math.round(12 * scale)}px ${Math.round(14 * scale)}px`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <Ticket size={Math.round(16 * scale)} className="shrink-0 opacity-85" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {cfg.discountLabel && (
                <span
                  className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0"
                  style={{
                    backgroundColor: pillBg,
                    color: pillText,
                    borderRadius: `${Math.min(innerRadius, 6)}px`,
                  }}
                >
                  {cfg.discountLabel}
                </span>
              )}
              <span
                className="font-semibold truncate leading-tight"
                style={{ fontSize: `${Math.max(12, Math.round(13.5 * scale))}px` }}
              >
                {block.title}
              </span>
            </div>
            {(cfg.merchant || cfg.expiresLabel) && (
              <div className="text-[10px] opacity-75 truncate mt-0.5">
                {[cfg.merchant, cfg.expiresLabel].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-dashed border-current/45 font-mono text-[11px] font-bold shrink-0 whitespace-nowrap cursor-pointer transition-transform active:scale-95"
          style={{
            backgroundColor: `${fg}12`,
            borderRadius: `${controlRadius}px`,
          }}
        >
          <span>{copied ? 'Copied!' : cfg.code}</span>
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
      </div>

      {isPublicPage && block.url && (
        <a
          href={formatExternalUrl(block.url)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={() => onLinkClick?.(block)}
          className="text-[11px] underline underline-offset-2 opacity-80 hover:opacity-100 self-end inline-flex items-center gap-1"
        >
          <span>Visit store</span>
          <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
};

export const LocationShowcaseCard: React.FC<SharedBlockRenderProps> = ({
  block,
  tokens,
  effectiveRadius,
  fontFamily,
  scale,
  isPublicPage,
  onLinkClick,
  surfaceStyle,
}) => {
  const cfg = block.location;
  if (!cfg) return null;
  const { fg, pillBg, pillText } = resolveCardPalette(surfaceStyle, tokens);
  const cardRadius = resolveCardBorderRadius(effectiveRadius, scale, 'card');
  const innerRadius = resolveCardBorderRadius(effectiveRadius, scale, 'inner');
  const controlRadius = resolveButtonControlRadius(effectiveRadius, scale);

  const mapsUrl = block.url
    ? formatExternalUrl(block.url)
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${cfg.placeName} ${cfg.address}`
      )}`;

  const inner = (
    <div
      className="w-full overflow-hidden flex items-center justify-between gap-2.5 select-none text-left"
      style={{
        ...surfaceStyle,
        color: fg,
        fontFamily,
        borderRadius: `${cardRadius}px`,
        padding: `${Math.round(11 * scale)}px ${Math.round(14 * scale)}px`,
      }}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: `${Math.round(34 * scale)}px`,
            height: `${Math.round(34 * scale)}px`,
            borderRadius: `${innerRadius}px`,
            backgroundColor: `${fg}14`,
          }}
        >
          <MapPin size={Math.round(16 * scale)} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="font-semibold truncate leading-tight"
            style={{ fontSize: `${Math.max(12, Math.round(13.5 * scale))}px` }}
          >
            {cfg.placeName || block.title}
          </div>
          <div className="text-[11px] opacity-80 truncate">{cfg.address}</div>
          {cfg.hours && <div className="text-[10px] opacity-65 truncate">{cfg.hours}</div>}
        </div>
      </div>

      <span
        className="px-2.5 py-1 text-[11px] font-semibold shrink-0 whitespace-nowrap inline-flex items-center gap-1"
        style={{
          backgroundColor: pillBg,
          color: pillText,
          borderRadius: `${controlRadius}px`,
        }}
      >
        <span>{cfg.buttonLabel || 'Maps'}</span>
        <ExternalLink size={10} />
      </span>
    </div>
  );

  if (isPublicPage) {
    return (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={() => onLinkClick?.(block)}
        className="w-full block transition-transform hover:scale-[1.01] active:scale-[0.99]"
        style={{ borderRadius: `${cardRadius}px` }}
      >
        {inner}
      </a>
    );
  }
  return inner;
};

export const DownloadShowcaseCard: React.FC<SharedBlockRenderProps> = ({
  block,
  tokens,
  effectiveRadius,
  fontFamily,
  scale,
  isPublicPage,
  onLinkClick,
  surfaceStyle,
}) => {
  const cfg = block.download;
  if (!cfg) return null;
  const href = block.url ? formatExternalUrl(block.url) : '#';
  const { fg, pillBg, pillText } = resolveCardPalette(surfaceStyle, tokens);
  const cardRadius = resolveCardBorderRadius(effectiveRadius, scale, 'card');
  const innerRadius = resolveCardBorderRadius(effectiveRadius, scale, 'inner');
  const controlRadius = resolveButtonControlRadius(effectiveRadius, scale);

  const inner = (
    <div
      className="w-full overflow-hidden flex items-center justify-between gap-2.5 select-none text-left"
      style={{
        ...surfaceStyle,
        color: fg,
        fontFamily,
        borderRadius: `${cardRadius}px`,
        padding: `${Math.round(11 * scale)}px ${Math.round(14 * scale)}px`,
      }}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div
          className="flex items-center justify-center shrink-0 font-mono text-[10px] font-bold"
          style={{
            width: `${Math.round(36 * scale)}px`,
            height: `${Math.round(36 * scale)}px`,
            borderRadius: `${innerRadius}px`,
            backgroundColor: `${fg}14`,
          }}
        >
          {(cfg.fileFormat || 'PDF').slice(0, 4).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="font-semibold truncate leading-tight"
            style={{ fontSize: `${Math.max(12, Math.round(13.5 * scale))}px` }}
          >
            {block.title}
          </div>
          <div className="text-[11px] opacity-80 truncate">
            {[cfg.fileSize, cfg.description].filter(Boolean).join(' · ') ||
              'Instant Download'}
          </div>
        </div>
      </div>

      <span
        className="px-2.5 py-1 text-[11px] font-semibold shrink-0 whitespace-nowrap inline-flex items-center gap-1"
        style={{
          backgroundColor: pillBg,
          color: pillText,
          borderRadius: `${controlRadius}px`,
        }}
      >
        <FileDown size={11} />
        <span>{cfg.buttonLabel || 'Download'}</span>
      </span>
    </div>
  );

  if (isPublicPage && block.url) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={() => onLinkClick?.(block)}
        className="w-full block transition-transform hover:scale-[1.01] active:scale-[0.99]"
        style={{ borderRadius: `${cardRadius}px` }}
      >
        {inner}
      </a>
    );
  }
  return inner;
};
