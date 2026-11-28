import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, ExternalLink } from 'lucide-react';
import { fetchPublicPage } from '../data/publicPageApi';
import { PublicPageData } from '../data/types';
import { VIBES } from '../lib/vibes';
import { resolveEffectiveTokens } from '../lib/colors';
import { pageUrl } from '../lib/site';
import { normalizeUsername } from '../lib/username-rules';
import { formatExternalUrl } from '../lib/urls';
import { normalizeEmbedStyle, normalizeEmbedTheme, ProfileEmbedTheme } from '../lib/profileEmbed';
import { VerifiedTick } from '../components/ui/VerifiedTick';
import { SocialIcon } from '../components/phone/SocialIcons';
import { PageRenderer } from '../components/page/PageRenderer';
import { BackgroundLayer } from '../components/page/BackgroundLayer';
import { LinkFaviconOrFallback } from '../components/ui/LinkFaviconOrFallback';
import { Loader } from '../components/ui/Loader';
import { usePageMeta } from '../hooks/usePageMeta';

function resolveEmbedPalette(theme: ProfileEmbedTheme, vibeTokens: { bg: string; text: string; muted: string; buttonBg: string; buttonText: string; buttonBorder?: string | null }) {
  if (theme === 'light') {
    return {
      surfaceBg: '#FFFFFF',
      text: '#0A0A0A',
      muted: '#52525B',
      buttonBg: '#0A0A0A',
      buttonText: '#FFFFFF',
      border: 'rgba(10, 10, 10, 0.12)',
      isDark: false,
    };
  }
  if (theme === 'dark') {
    return {
      surfaceBg: '#0B0F17',
      text: '#FAFAFA',
      muted: '#A1A1AA',
      buttonBg: '#FFFFFF',
      buttonText: '#0A0A0A',
      border: 'rgba(255, 255, 255, 0.14)',
      isDark: true,
    };
  }
  if (theme === 'glass') {
    return {
      surfaceBg: 'rgba(15, 23, 42, 0.72)',
      text: '#FFFFFF',
      muted: 'rgba(255, 255, 255, 0.74)',
      buttonBg: 'rgba(255, 255, 255, 0.16)',
      buttonText: '#FFFFFF',
      border: 'rgba(255, 255, 255, 0.22)',
      isDark: true,
      backdrop: 'blur(16px)',
    };
  }
  return {
    surfaceBg: vibeTokens.bg,
    text: vibeTokens.text,
    muted: vibeTokens.muted,
    buttonBg: vibeTokens.buttonBg === 'transparent' ? vibeTokens.text : vibeTokens.buttonBg,
    buttonText: vibeTokens.buttonBg === 'transparent' ? vibeTokens.bg : vibeTokens.buttonText,
    border: vibeTokens.buttonBorder || 'rgba(128, 128, 128, 0.2)',
    isDark: vibeTokens.text.toUpperCase() === '#FFFFFF' || vibeTokens.bg.toLowerCase().startsWith('#0') || vibeTokens.bg.toLowerCase().startsWith('#1'),
  };
}

export const EmbedProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [searchParams] = useSearchParams();
  const clean = normalizeUsername((username || searchParams.get('u') || '').replace(/^@+/, ''));
  const style = normalizeEmbedStyle(searchParams.get('style'));
  const theme = normalizeEmbedTheme(searchParams.get('theme'));

  const [pageData, setPageData] = useState<PublicPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarFailed, setAvatarFailed] = useState(false);

  usePageMeta({
    title: clean ? `@${clean} | Iveo` : 'Iveo Embed',
    robots: 'noindex, nofollow',
  });

  useEffect(() => {
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    return () => {
      document.body.style.backgroundColor = prevBodyBg;
      document.documentElement.style.backgroundColor = prevHtmlBg;
    };
  }, []);

  useEffect(() => {
    if (!clean) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setAvatarFailed(false);
    fetchPublicPage(clean)
      .then((res) => {
        if (!cancelled) setPageData(res);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clean]);

  if (loading) {
    return (
      <div className="w-full min-h-[76px] flex items-center justify-center p-4 bg-transparent text-ink/70" aria-busy="true">
        <Loader size="sm" />
      </div>
    );
  }

  if (!clean || !pageData?.profile) {
    return (
      <div className="w-full p-4 rounded-2xl border border-border bg-surface text-center text-[13px] text-muted">
        Profile @{clean || 'unknown'} is unavailable.
      </div>
    );
  }

  const prof = pageData.profile;
  const vibe = VIBES.find((v) => v.id === prof.vibeId) || VIBES[0];
  const effectiveTokens = resolveEffectiveTokens(vibe.tokens, prof.buttonColors, prof.background);
  const palette = resolveEmbedPalette(theme, effectiveTokens);
  const canonicalUrl = pageUrl(clean);
  const isVerified = Boolean(prof.isVerified ?? prof.isPro);
  const displayName = prof.displayName || `@${clean}`;
  const initials = displayName.slice(0, 2).toUpperCase();
  const activeSocials = Object.entries(prof.socials || {}).filter(
    ([, val]) => typeof val === 'string' && val.trim().length > 0
  );
  const linkBlocks = (pageData.links || []).filter(
    (b) => (b.kind === 'link' || b.kind === 'youtube' || b.kind === 'product' || b.kind === 'booking') && !b.isProtected && b.url
  );

  // 1. Full Interactive Page style
  if (style === 'full') {
    const themedVibe =
      theme === 'auto'
        ? vibe
        : {
            ...vibe,
            tokens: {
              ...vibe.tokens,
              bg: palette.surfaceBg,
              text: palette.text,
              muted: palette.muted,
              buttonBg: palette.buttonBg,
              buttonText: palette.buttonText,
              buttonBorder: palette.border,
            },
          };
    return (
      <div className="relative min-h-[100dvh] w-full flex justify-center overflow-x-hidden">
        {theme === 'auto' && (
          <BackgroundLayer mode="fixed" background={prof.background} fallbackBg={vibe.tokens.bg} />
        )}
        <div className="relative z-10 w-full max-w-[560px] flex flex-col">
          <PageRenderer
            vibe={themedVibe}
            profile={{
              name: prof.displayName,
              handle: prof.username,
              bio: prof.bio,
              avatarUrl: prof.avatarUrl,
              isPro: Boolean(prof.isPro),
              isVerified,
              socials: prof.socials,
              socialsPosition: prof.socialsPosition || 'top',
              whatsappNumber: prof.whatsappNumber || null,
              background: theme === 'auto' ? prof.background : null,
              fontSettings: prof.fontSettings,
              buttonColors: theme === 'auto' ? prof.buttonColors : null,
              layoutSettings: prof.layoutSettings,
              businessCard: prof.businessCard,
            }}
            blocks={pageData.links}
            hideFooterMark={prof.hideFooter}
            embedMode="live"
            isPublicPage={false}
          />
        </div>
      </div>
    );
  }

  // 2. Creator Pill / Badge style
  if (style === 'badge') {
    return (
      <div className="w-full p-2 bg-transparent">
        <a
          href={canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full max-w-[340px] mx-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-full border transition-transform hover:scale-[1.01] active:scale-[0.99] shadow-sm"
          style={{
            backgroundColor: palette.surfaceBg,
            color: palette.text,
            borderColor: palette.border,
            backdropFilter: (palette as any).backdrop,
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {prof.avatarUrl && !avatarFailed ? (
              <img
                src={prof.avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-9 h-9 rounded-full object-cover shrink-0 border border-current/15"
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[13px] shrink-0"
                style={{ backgroundColor: palette.buttonBg, color: palette.buttonText }}
              >
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[13px] font-semibold truncate leading-tight">
                  {displayName}
                </span>
                {isVerified && <VerifiedTick size={13} onDark={palette.isDark} />}
              </div>
              <span className="text-[11px] font-mono block truncate" style={{ color: palette.muted }}>
                iveo.site/@{clean}
              </span>
            </div>
          </div>

          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
            style={{ backgroundColor: palette.buttonBg, color: palette.buttonText }}
          >
            <span>Open</span>
            <ArrowUpRight size={12} />
          </span>
        </a>
      </div>
    );
  }

  // 3. Minimal Header Card style
  if (style === 'minimal') {
    return (
      <div className="w-full p-2 bg-transparent">
        <div
          className="w-full max-w-[480px] mx-auto rounded-2xl border p-4 shadow-sm flex flex-col gap-3"
          style={{
            backgroundColor: palette.surfaceBg,
            color: palette.text,
            borderColor: palette.border,
            backdropFilter: (palette as any).backdrop,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {prof.avatarUrl && !avatarFailed ? (
                <img
                  src={prof.avatarUrl}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="w-12 h-12 rounded-full object-cover shrink-0 border border-current/15"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-[16px] shrink-0"
                  style={{ backgroundColor: palette.buttonBg, color: palette.buttonText }}
                >
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1 className="text-[15px] font-semibold truncate">{displayName}</h1>
                  {isVerified && <VerifiedTick size={14} onDark={palette.isDark} />}
                </div>
                <p className="text-[12px] font-mono truncate" style={{ color: palette.muted }}>
                  @{clean}
                </p>
              </div>
            </div>

            <a
              href={canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-semibold shrink-0 transition-opacity hover:opacity-90"
              style={{ backgroundColor: palette.buttonBg, color: palette.buttonText }}
            >
              <span>Visit</span>
              <ExternalLink size={12} />
            </a>
          </div>

          {prof.bio && (
            <p className="text-[12.5px] leading-relaxed line-clamp-2" style={{ color: palette.muted }}>
              {prof.bio}
            </p>
          )}

          {activeSocials.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {activeSocials.slice(0, 6).map(([platform, url]) => (
                <a
                  key={platform}
                  href={formatExternalUrl(url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={platform}
                  className="w-7 h-7 rounded-full border flex items-center justify-center transition-transform hover:scale-105"
                  style={{ borderColor: palette.border, color: palette.text }}
                >
                  <SocialIcon platform={platform} size={13} />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3b. Spotlight Hero Embed style ('spotlight')
  if (style === 'spotlight') {
    return (
      <div className="w-full p-2 bg-transparent">
        <div
          className="w-full max-w-[440px] mx-auto rounded-2xl border overflow-hidden shadow-sm flex flex-col"
          style={{
            backgroundColor: palette.surfaceBg,
            color: palette.text,
            borderColor: palette.border,
            backdropFilter: (palette as any).backdrop,
          }}
        >
          <div
            className="h-20 w-full relative shrink-0"
            style={{
              background: `linear-gradient(135deg, ${palette.buttonBg} 0%, ${palette.text}55 100%)`,
            }}
          />
          <div className="px-5 pb-5 -mt-9 flex flex-col items-center text-center relative z-10">
            {prof.avatarUrl && !avatarFailed ? (
              <img
                src={prof.avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-[72px] h-[72px] rounded-full object-cover border-[3px] shadow-sm mb-2.5"
                style={{ borderColor: palette.surfaceBg }}
              />
            ) : (
              <div
                className="w-[72px] h-[72px] rounded-full flex items-center justify-center font-bold text-[22px] border-[3px] shadow-sm mb-2.5"
                style={{
                  backgroundColor: palette.buttonBg,
                  color: palette.buttonText,
                  borderColor: palette.surfaceBg,
                }}
              >
                {initials}
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <h1 className="text-[18px] font-semibold leading-tight">{displayName}</h1>
              {isVerified && <VerifiedTick size={15} onDark={palette.isDark} />}
            </div>
            <span className="text-[12px] font-mono mt-0.5" style={{ color: palette.muted }}>
              @{clean}
            </span>
            {prof.bio && (
              <p className="text-[12.5px] mt-2 line-clamp-2 max-w-[36ch]" style={{ color: palette.muted }}>
                {prof.bio}
              </p>
            )}

            {activeSocials.length > 0 && (
              <div className="flex items-center justify-center gap-1.5 flex-wrap mt-3">
                {activeSocials.slice(0, 6).map(([platform, url]) => (
                  <a
                    key={platform}
                    href={formatExternalUrl(url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={platform}
                    className="w-8 h-8 rounded-full border flex items-center justify-center transition-transform hover:scale-105"
                    style={{ borderColor: palette.border, color: palette.text }}
                  >
                    <SocialIcon platform={platform} size={14} />
                  </a>
                ))}
              </div>
            )}

            <div className="w-full flex flex-col gap-2 mt-4">
              {linkBlocks.slice(0, 3).map((b) => (
                <a
                  key={b.id}
                  href={formatExternalUrl(b.url!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-10 px-4 rounded-full flex items-center justify-between gap-2 text-[13px] font-semibold transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  style={{ backgroundColor: palette.buttonBg, color: palette.buttonText }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <LinkFaviconOrFallback url={b.url} size={14} />
                    <span className="truncate">{b.title || b.url}</span>
                  </div>
                  <ArrowUpRight size={14} className="shrink-0 opacity-80" />
                </a>
              ))}
            </div>

            <a
              href={canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 pt-2.5 w-full border-t text-center text-[11px] font-mono opacity-80 hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
              style={{ borderColor: palette.border, color: palette.muted }}
            >
              <span>iveo.site/@{clean}</span>
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 3c. Showcase Bento Embed style ('showcase')
  if (style === 'showcase') {
    return (
      <div className="w-full p-2 bg-transparent">
        <div
          className="w-full max-w-[460px] mx-auto rounded-2xl border p-5 shadow-sm flex flex-col gap-4"
          style={{
            backgroundColor: palette.surfaceBg,
            color: palette.text,
            borderColor: palette.border,
            backdropFilter: (palette as any).backdrop,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {prof.avatarUrl && !avatarFailed ? (
                <img
                  src={prof.avatarUrl}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-current/15"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-[18px] shrink-0"
                  style={{ backgroundColor: palette.buttonBg, color: palette.buttonText }}
                >
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1 className="text-[16px] font-semibold truncate">{displayName}</h1>
                  {isVerified && <VerifiedTick size={14} onDark={palette.isDark} />}
                </div>
                <span className="text-[12px] font-mono block truncate" style={{ color: palette.muted }}>
                  @{clean}
                </span>
              </div>
            </div>

            <a
              href={canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[12px] font-semibold shrink-0 transition-opacity hover:opacity-90"
              style={{ backgroundColor: palette.buttonBg, color: palette.buttonText }}
            >
              <span>Follow</span>
              <ArrowUpRight size={12} />
            </a>
          </div>

          {prof.bio && (
            <p className="text-[12.5px] leading-relaxed line-clamp-2" style={{ color: palette.muted }}>
              {prof.bio}
            </p>
          )}

          {linkBlocks.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {linkBlocks.slice(0, 4).map((b) => (
                <a
                  key={b.id}
                  href={formatExternalUrl(b.url!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border p-3 flex flex-col justify-between gap-2 min-h-[72px] transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    borderColor: palette.border,
                    backgroundColor: palette.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(10,10,10,0.03)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <LinkFaviconOrFallback url={b.url} size={15} />
                    <ArrowUpRight size={13} style={{ color: palette.muted }} className="shrink-0" />
                  </div>
                  <span className="text-[12.5px] font-medium line-clamp-1">
                    {b.title || b.url}
                  </span>
                </a>
              ))}
            </div>
          )}

          <div
            className="pt-2.5 border-t flex items-center justify-between gap-2"
            style={{ borderColor: palette.border }}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeSocials.slice(0, 5).map(([platform, url]) => (
                <a
                  key={platform}
                  href={formatExternalUrl(url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={platform}
                  className="w-7 h-7 rounded-full border flex items-center justify-center transition-transform hover:scale-105"
                  style={{ borderColor: palette.border, color: palette.text }}
                >
                  <SocialIcon platform={platform} size={13} />
                </a>
              ))}
            </div>
            <a
              href={canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-mono opacity-80 hover:opacity-100 inline-flex items-center gap-1"
              style={{ color: palette.muted }}
            >
              <span>iveo.site/@{clean}</span>
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 4. Default Profile Card style ('card')
  return (
    <div className="w-full p-2 bg-transparent">
      <div
        className="w-full max-w-[420px] mx-auto rounded-2xl border p-5 shadow-sm flex flex-col gap-3.5"
        style={{
          backgroundColor: palette.surfaceBg,
          color: palette.text,
          borderColor: palette.border,
          backdropFilter: (palette as any).backdrop,
        }}
      >
        <div className="flex flex-col items-center text-center">
          {prof.avatarUrl && !avatarFailed ? (
            <img
              src={prof.avatarUrl}
              alt={displayName}
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="w-14 h-14 rounded-full object-cover border border-current/15 mb-2"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-[18px] mb-2"
              style={{ backgroundColor: palette.buttonBg, color: palette.buttonText }}
            >
              {initials}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <h1 className="text-[16px] font-semibold leading-tight">{displayName}</h1>
            {isVerified && <VerifiedTick size={14} onDark={palette.isDark} />}
          </div>
          <span className="text-[12px] font-mono mt-0.5" style={{ color: palette.muted }}>
            @{clean}
          </span>
          {prof.bio && (
            <p className="text-[12px] mt-1.5 line-clamp-2 max-w-[34ch]" style={{ color: palette.muted }}>
              {prof.bio}
            </p>
          )}
        </div>

        {activeSocials.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {activeSocials.slice(0, 6).map(([platform, url]) => (
              <a
                key={platform}
                href={formatExternalUrl(url)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={platform}
                className="w-8 h-8 rounded-full border flex items-center justify-center transition-transform hover:scale-105"
                style={{ borderColor: palette.border, color: palette.text }}
              >
                <SocialIcon platform={platform} size={14} />
              </a>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {linkBlocks.slice(0, 4).map((b) => (
            <a
              key={b.id}
              href={formatExternalUrl(b.url!)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-10 px-3.5 rounded-xl flex items-center justify-between gap-2 text-[13px] font-medium transition-transform hover:scale-[1.01] active:scale-[0.99]"
              style={{
                backgroundColor: palette.buttonBg,
                color: palette.buttonText,
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <LinkFaviconOrFallback url={b.url} size={14} />
                <span className="truncate">{b.title || b.url}</span>
              </div>
              <ArrowUpRight size={14} className="shrink-0 opacity-75" />
            </a>
          ))}
        </div>

        <a
          href={canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="pt-2 border-t text-center text-[11px] font-mono opacity-75 hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
          style={{ borderColor: palette.border, color: palette.muted }}
        >
          <span>iveo.site/@{clean}</span>
          <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
};

export default EmbedProfilePage;
