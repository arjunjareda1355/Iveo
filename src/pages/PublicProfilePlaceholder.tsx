import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { PageRenderer } from '../components/page/PageRenderer';
import { UnlockDialog } from '../components/public/UnlockDialog';
import { SignupFormBlock } from '../components/public/SignupFormBlock';
import { NotFound } from './NotFound';
import { PRIVATE_ROUTES, validateUsername, normalizeUsername } from '../lib/username-rules';
import { fetchPublicPage } from '../data/publicPageApi';
import { PublicPageData, PageBlock, PublicBlock } from '../data/types';
import { VIBES } from '../lib/vibes';
import { pageUrl, SITE_ORIGIN } from '../lib/site';
import { copy } from '../content/copy';
import { useIveoSession } from '../auth/useIvioSession';
import { setAnalyticsContext, trackView, trackClick } from '../lib/analytics/track';
import { resolveSource } from '../lib/analytics/sources';
import { trackLinkClick } from '../lib/analytics-seam';
import { normalizeGoogleAnalyticsId, normalizeMetaPixelId } from '../lib/integrations';
import { formatExternalUrl } from '../lib/urls';
import { getFontCssFamily, loadGoogleFonts } from '../lib/fonts';
import { resolveEffectiveTokens } from '../lib/colors';
import { computeBackgroundLayers } from '../lib/backgrounds';
import { BackgroundLayer } from '../components/page/BackgroundLayer';
import { isAllowedAvatarUrl } from '../lib/avatar';
import { Loader } from '../components/ui/Loader';
import { resolveTokens } from '../lib/appearance/resolveTokens';

export interface PublicProfilePlaceholderProps {
  usernameOverride?: string;
}

function upsertMetaTag(attr: 'name' | 'property', key: string, content: string): HTMLMetaElement {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
  return el;
}

export const PublicProfilePlaceholder: React.FC<PublicProfilePlaceholderProps> = ({ usernameOverride }) => {
  const { username } = useParams<{ username: string }>();
  const rawParam = (usernameOverride || username || '').trim();
  const rawUsername = rawParam.replace(/^@+/, '');
  const cleanLower = rawUsername.toLowerCase();
  const syntaxValidation = validateUsername(rawUsername, { allowReserved: true });
  const publicValidation = validateUsername(rawUsername);
  const isReservedName = !publicValidation.ok && publicValidation.reason === 'reserved';

  // Block system private routes and syntactically invalid usernames immediately
  if (PRIVATE_ROUTES.has(cleanLower) || !syntaxValidation.ok) {
    return <NotFound />;
  }

  const clean = normalizeUsername(rawUsername);
  return <PublicProfilePlaceholderInner clean={clean} isReservedName={isReservedName} />;
};

const PublicProfilePlaceholderInner: React.FC<{ clean: string; isReservedName: boolean }> = ({
  clean,
  isReservedName,
}) => {
  const [pageData, setPageData] = useState<PublicPageData | null>(() => {
    if (typeof window === 'undefined' || !clean) return null;

    let ssrData: PublicPageData | null = null;
    try {
      const ssrEl = document.getElementById('iveo-ssr-bootstrap');
      if (ssrEl && ssrEl.textContent) {
        const ssrParsed = JSON.parse(ssrEl.textContent);
        if (ssrParsed?.profile?.username?.toLowerCase() === clean) {
          ssrData = {
            profile: {
              ...ssrParsed.profile,
              avatarUrl: isAllowedAvatarUrl(ssrParsed.profile.avatarUrl)
                ? ssrParsed.profile.avatarUrl
                : null,
            },
            links: Array.isArray(ssrParsed.links) ? ssrParsed.links : [],
          };
        }
      }
    } catch {
      // Ignore invalid SSR JSON
    }

    let localData: PublicPageData | null = null;
    try {
      const cached = localStorage.getItem(`iveo_profile_${clean}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        const cachedBlocksRaw =
          localStorage.getItem(`iveo_public_blocks_${clean}`) ||
          localStorage.getItem(`iveo_blocks_${clean}`);
        const cachedBlocks = cachedBlocksRaw ? JSON.parse(cachedBlocksRaw) : [];
        localData = {
          profile: {
            username: clean,
            displayName: parsed.displayName || clean,
            bio: parsed.bio || '',
            avatarUrl: isAllowedAvatarUrl(parsed.avatarUrl) ? parsed.avatarUrl : null,
            avatarType: parsed.avatarType,
            avatarId: parsed.avatarId,
            vibeId: parsed.vibeId || 'clean',
            plan: parsed.isPro || parsed.plan === 'pro' ? 'pro' : 'free',
            isPro: Boolean(parsed.isVerified ?? parsed.isPro ?? parsed.plan === 'pro'),
            isVerified: Boolean(parsed.isVerified ?? parsed.isPro ?? parsed.plan === 'pro'),
            isOwnerProfile: Boolean(parsed.isOwnerProfile),
            buttonShape: parsed.buttonShape || null,
            socials: parsed.socials || {},
            socialsPosition: parsed.socialsPosition || 'top',
            hideFromSearch: Boolean(parsed.hideFromSearch),
            hideFooter: Boolean(parsed.hideFooter),
            background: parsed.background || null,
            googleAnalyticsId: parsed.googleAnalyticsId || null,
            metaPixelId: parsed.metaPixelId || null,
            whatsappNumber: parsed.whatsappNumber || null,
            customSeoTitle: parsed.customSeoTitle || null,
            customSeoDescription: parsed.customSeoDescription || null,
            fontSettings: parsed.fontSettings || null,
            buttonColors: parsed.buttonColors || null,
            layoutSettings: parsed.layoutSettings || null,
            businessCard: parsed.businessCard || null,
            appearance: parsed.appearance || null,
            updatedAt: parsed.updatedAt || null,
          },
          links: Array.isArray(cachedBlocks) ? cachedBlocks : [],
        };
      }
    } catch {
      // Ignore invalid localStorage cache
    }

    if (ssrData && localData) {
      const ssrTime = ssrData.profile?.updatedAt ? Date.parse(ssrData.profile.updatedAt) : 0;
      const localTime = localData.profile?.updatedAt ? Date.parse(localData.profile.updatedAt) : 0;
      if (localTime > ssrTime) {
        return localData;
      }
      return ssrData;
    }

    return ssrData || localData;
  });
  const [isLoading, setIsLoading] = useState(() => pageData === null);
  const [unlockedUrls, setUnlockedUrls] = useState<Record<string, string>>({});
  const [unlockBlock, setUnlockBlock] = useState<PageBlock | null>(null);

  const session = useIveoSession();
  const viewTrackedRef = useRef(false);
  const ownerExclusionDoneRef = useRef(false);
  const isFetchingRef = useRef(false);

  const isDemoMode =
    typeof window !== 'undefined' &&
    (() => {
      const params = new URLSearchParams(window.location.search);
      return params.get('demo') === '1' || params.get('autostart') === '1';
    })();

  const buildDemoPageData = useCallback((): PublicPageData | null => {
    if (!isDemoMode || !session.username || session.username.toLowerCase() !== clean) {
      return null;
    }
    let cachedBlocks: PublicBlock[] = [];
    try {
      const raw =
        localStorage.getItem(`iveo_public_blocks_${clean}`) ||
        localStorage.getItem(`iveo_blocks_${clean}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) cachedBlocks = parsed;
      }
    } catch {}
    if (cachedBlocks.length === 0) {
      const baseVibe = VIBES.find((v) => v.id === session.vibeId) || VIBES[0];
      cachedBlocks = baseVibe.persona.links.map((item, idx) => ({
        id: `demo-${idx}`,
        kind: 'link' as const,
        title: typeof item === 'string' ? item : item.title,
        url: typeof item === 'string' ? 'https://iveo.site' : item.url,
        icon: null,
        thumbnailPath: null,
        thumbnailUrl: null,
        embedProvider: null,
        layout: 'classic' as const,
        isProtected: false,
      }));
    }
    return {
      profile: {
        username: clean,
        displayName: session.displayName || clean,
        bio: session.bio || '',
        avatarUrl: session.imageUrl,
        vibeId: session.vibeId || 'clean',
        plan: session.plan,
        isPro: session.isPro,
        isVerified: session.isPro,
        isOwnerProfile: false,
        buttonShape: session.buttonShape || null,
        socials: session.socials || {},
        socialsPosition: session.socialsPosition || 'top',
        hideFromSearch: false,
        hideFooter: Boolean(session.hideIveoFooter || session.hideIvioFooter),
        background: session.background || null,
        googleAnalyticsId: session.googleAnalyticsId || null,
        metaPixelId: session.metaPixelId || null,
        whatsappNumber: session.whatsappNumber || null,
        customSeoTitle: session.customSeoTitle || null,
        customSeoDescription: session.customSeoDescription || null,
        fontSettings: session.fontSettings || null,
        buttonColors: session.buttonColors || null,
        layoutSettings: session.layoutSettings || null,
        businessCard: session.businessCard || null,
        appearance: session.appearance || null,
        updatedAt: session.updatedAt || null,
      },
      links: cachedBlocks,
    };
  }, [isDemoMode, session, clean]);

  const pendingRefetchRef = useRef(false);

  const loadData = useCallback(async (forceSync = false) => {
    if (isDemoMode && session.username?.toLowerCase() === clean) {
      const demoData = buildDemoPageData();
      if (demoData) {
        setPageData(demoData);
        setIsLoading(false);
        return;
      }
    }
    if (isFetchingRef.current) {
      if (forceSync) pendingRefetchRef.current = true;
      return;
    }
    isFetchingRef.current = true;
    try {
      const data = await fetchPublicPage(clean);
      setPageData((prev) => {
        if (!data || forceSync) return data;
        if (prev?.profile?.updatedAt && data?.profile?.updatedAt) {
          const prevTs = Date.parse(prev.profile.updatedAt);
          const nextTs = Date.parse(data.profile.updatedAt);
          if (!Number.isNaN(prevTs) && !Number.isNaN(nextTs) && prevTs > nextTs && prevTs - nextTs < 10000) {
            return { ...data, profile: prev.profile };
          }
        }
        return data;
      });
    } catch {
      // Keep existing data on error
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
      if (pendingRefetchRef.current) {
        pendingRefetchRef.current = false;
        void loadData(true);
      }
    }
  }, [clean, isDemoMode, session.username, buildDemoPageData]);

  useEffect(() => {
    void loadData(false);

    // Refetch every 30s while tab is visible + immediate on focus/visibility/BroadcastChannel
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void loadData(false);
    }, 30000);

    const handleVisibility = () => {
      if (!document.hidden) {
        void loadData(true);
      }
    };

    const handleFocus = () => {
      void loadData(true);
    };

    const handleSyncEvent = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (detail && typeof detail === 'object' && String(detail.username || '').toLowerCase() === clean) {
        void loadData(true);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key &&
        (event.key === `iveo_profile_${clean}` ||
          event.key === `iveo_public_blocks_${clean}` ||
          event.key === `iveo_blocks_${clean}` ||
          event.key === 'iveo_demo_session_maya')
      ) {
        void loadData(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('iveo_profile_sync', handleSyncEvent);
    window.addEventListener('storage', handleStorage);

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('iveo_profile_sync');
        channel.onmessage = (event) => {
          const msg = event?.data;
          if (msg && typeof msg === 'object' && String(msg.username || '').toLowerCase() === clean) {
            void loadData(true);
          }
        };
      }
    } catch {}

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('iveo_profile_sync', handleSyncEvent);
      window.removeEventListener('storage', handleStorage);
      try {
        channel?.close();
      } catch {}
    };
  }, [loadData, clean]);

  // Sync full-viewport document background color with active background/vibe so overscroll matches theme
  useEffect(() => {
    if (!pageData?.profile) return;
    const vibe = VIBES.find((v) => v.id === pageData.profile?.vibeId) || VIBES[0];
    const resolvedBodyV2 =
      pageData.profile.appearance && pageData.profile.appearance.schemaVersion === 2
        ? resolveTokens(pageData.profile.appearance, {
            isPro: Boolean(pageData.profile.isVerified ?? pageData.profile.isPro ?? true),
          })
        : null;
    const baseBg =
      resolvedBodyV2?.bgProfile.meanHex ||
      computeBackgroundLayers(pageData.profile.background, vibe.tokens.bg).baseColor;
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = baseBg;
    document.documentElement.style.backgroundColor = baseBg;

    // Preload any user-selected custom Google Fonts immediately
    loadGoogleFonts([
      pageData.profile.fontSettings?.nameFont,
      pageData.profile.fontSettings?.bioFont,
      pageData.profile.fontSettings?.buttonFont,
      pageData.profile.businessCard?.fontId,
    ]);

    return () => {
      document.body.style.backgroundColor = prevBodyBg;
      document.documentElement.style.backgroundColor = prevHtmlBg;
    };
  }, [pageData?.profile?.vibeId, pageData?.profile]);

  // Set document title, robots, canonical, OpenGraph, Twitter, and Schema.org JSON-LD SEO metadata
  useEffect(() => {
    const canonicalHref = pageUrl(clean);
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    const prevCanonicalHref = canonical.getAttribute('href');
    canonical.href = canonicalHref;

    if (pageData?.profile) {
      const display = pageData.profile.displayName || `@${clean}`;
      const titleText =
        pageData.profile.customSeoTitle ||
        `${display} – Links, Projects & Social Profiles | Iveo`;
      document.title = titleText;

      const bioClean = pageData.profile.bio?.trim() || '';
      const descText =
        pageData.profile.customSeoDescription ||
        (bioClean
          ? `${bioClean} — Discover ${display} (@${clean}) on Iveo.`
          : `Discover ${display} on Iveo. Explore their projects, websites, social media links and latest work.`);

      const robotsValue = pageData.profile.hideFromSearch ? 'noindex, nofollow' : 'index, follow';
      const origin = typeof window !== 'undefined' ? window.location.origin : SITE_ORIGIN;
      const ogImageUrl = `${origin}/api/og?u=${encodeURIComponent(clean)}`;

      upsertMetaTag('name', 'description', descText);
      upsertMetaTag('name', 'robots', robotsValue);
      upsertMetaTag('property', 'og:type', 'profile');
      upsertMetaTag('property', 'og:locale', 'en_US');
      upsertMetaTag('property', 'og:site_name', 'Iveo');
      upsertMetaTag('property', 'og:title', titleText);
      upsertMetaTag('property', 'og:description', descText);
      upsertMetaTag('property', 'og:url', canonicalHref);
      upsertMetaTag('property', 'og:image', ogImageUrl);
      upsertMetaTag('property', 'og:image:type', 'image/png');
      upsertMetaTag('property', 'profile:username', clean);
      upsertMetaTag('name', 'twitter:card', 'summary_large_image');
      upsertMetaTag('name', 'twitter:site', '@iveosite');
      upsertMetaTag('name', 'twitter:title', titleText);
      upsertMetaTag('name', 'twitter:description', descText);
      upsertMetaTag('name', 'twitter:image', ogImageUrl);

      const socialUrls = Object.values(pageData.profile.socials || {})
        .filter((val): val is string => typeof val === 'string' && val.trim().length > 0)
        .map((val) => formatExternalUrl(val));

      for (const blk of pageData.links || []) {
        if (
          blk.url &&
          !blk.isProtected &&
          (blk.embedMeta?.connectedViaOAuth === true ||
            blk.kind === 'youtube' ||
            blk.kind === 'bluesky')
        ) {
          socialUrls.push(formatExternalUrl(blk.url));
        }
      }

      const sameAs = Array.from(new Set(socialUrls.filter((u) => /^https?:\/\//i.test(u))));

      const mainEntity: Record<string, unknown> = {
        '@type': 'Person',
        '@id': `${canonicalHref}#person`,
        name: display,
        alternateName: [clean, `@${clean}`],
        identifier: clean,
        url: canonicalHref,
      };
      if (bioClean || descText) mainEntity.description = bioClean || descText;
      if (pageData.profile.avatarUrl) {
        mainEntity.image = pageData.profile.avatarUrl.startsWith('/')
          ? `${origin}${pageData.profile.avatarUrl}`
          : pageData.profile.avatarUrl;
      }
      if (sameAs.length > 0) {
        mainEntity.sameAs = sameAs;
      }

      let ldScript = document.getElementById('iveo-profile-jsonld') as HTMLScriptElement | null;
      if (!ldScript) {
        ldScript = document.createElement('script');
        ldScript.id = 'iveo-profile-jsonld';
        ldScript.type = 'application/ld+json';
        document.head.appendChild(ldScript);
      }
      ldScript.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        '@id': `${canonicalHref}#profile`,
        url: canonicalHref,
        inLanguage: 'en',
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonicalHref,
        },
        mainEntity,
      });
    } else {
      document.title = `Page not found (@${clean}) | Iveo`;
      upsertMetaTag('name', 'robots', 'noindex, nofollow');
    }

    return () => {
      const ldScript = document.getElementById('iveo-profile-jsonld');
      if (ldScript) ldScript.remove();
      if (canonical && prevCanonicalHref) {
        canonical.href = prevCanonicalHref;
      }
    };
  }, [pageData, clean]);

  // Execute third-party integrations (Google Analytics 4 & Meta Pixel) when configured on public page
  useEffect(() => {
    const rawGaId = pageData?.profile?.googleAnalyticsId;
    const scriptId = 'iveo-ga4-script';
    const existing = document.getElementById(scriptId);

    if (!rawGaId) {
      if (existing) existing.remove();
      return;
    }
    const gaCheck = normalizeGoogleAnalyticsId(rawGaId);
    if (!gaCheck.valid || !gaCheck.value) {
      if (existing) existing.remove();
      return;
    }

    const measurementId = gaCheck.value;
    if (existing && (existing as HTMLScriptElement).dataset.gaId !== measurementId) {
      existing.remove();
    }
    if (!document.getElementById(scriptId)) {
      const s = document.createElement('script');
      s.id = scriptId;
      s.dataset.gaId = measurementId;
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      document.head.appendChild(s);
    }

    const w = window as any;
    w.dataLayer = w.dataLayer || [];
    if (typeof w.gtag !== 'function') {
      w.gtag = function gtag() {
        w.dataLayer.push(arguments);
      };
    }
    const resolvedTitle =
      pageData?.profile?.customSeoTitle ||
      `${pageData?.profile?.displayName || `@${clean}`} – Links, Projects & Social Profiles | Iveo`;
    w.gtag('js', new Date());
    w.gtag('config', measurementId, {
      page_path: `/@${clean}`,
      page_location: pageUrl(clean),
      page_title: resolvedTitle,
    });

    return () => {
      const el = document.getElementById(scriptId);
      if (el) el.remove();
    };
  }, [pageData?.profile?.googleAnalyticsId, pageData?.profile?.customSeoTitle, pageData?.profile?.displayName, clean]);

  useEffect(() => {
    const rawPixelId = pageData?.profile?.metaPixelId;
    if (!rawPixelId) return;
    const pixelCheck = normalizeMetaPixelId(rawPixelId);
    if (!pixelCheck.valid || !pixelCheck.value) return;

    const pixelId = pixelCheck.value;
    const w = window as any;
    if (!w.fbq) {
      const n: any = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!w._fbq) w._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      w.fbq = n;
      const t = document.createElement('script');
      t.id = 'iveo-meta-pixel-script';
      t.async = true;
      t.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(t);
    }
    w.fbq('init', pixelId);
    w.fbq('track', 'PageView');
  }, [pageData?.profile?.metaPixelId]);

  // Reset tracking flags & analytics context only on handle change or unmount (not 60s background refresh)
  useEffect(() => {
    viewTrackedRef.current = false;
    ownerExclusionDoneRef.current = false;
    return () => {
      setAnalyticsContext({ enabled: true, username: null, source: null });
    };
  }, [clean]);

  // Analytics tracking & owner exclusion logic (Section 5.4 & 7)
  const hasLoadedProfile = Boolean(pageData?.profile);
  useEffect(() => {
    if (!hasLoadedProfile) return;

    const source = resolveSource();
    setAnalyticsContext({ username: clean, source, enabled: true });

    const sendViewWhenReady = () => {
      if (viewTrackedRef.current) return;

      const executeView = () => {
        if (viewTrackedRef.current) return;
        viewTrackedRef.current = true;
        trackView(clean, source);
      };

      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        const onVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            executeView();
          }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
      } else {
        executeView();
      }
    };

    const evaluateOwner = () => {
      if (ownerExclusionDoneRef.current) return;
      ownerExclusionDoneRef.current = true;

      const isOwner =
        session.isSignedIn &&
        session.username?.toLowerCase() === clean.toLowerCase();

      if (isOwner) {
        setAnalyticsContext({ enabled: false });
      } else {
        sendViewWhenReady();
      }
    };

    if (session.isLoaded) {
      evaluateOwner();
    } else {
      // 1200ms fallback timer to avoid blocking public view on Clerk
      const timer = setTimeout(() => {
        evaluateOwner();
      }, 1200);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [hasLoadedProfile, clean, session.isLoaded, session.isSignedIn, session.username]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-bg flex items-center justify-center p-6 text-ink/70" aria-busy="true">
        <Loader size="lg" />
      </div>
    );
  }

  if (pageData?.redirectTo) {
    return <Navigate to={`/@${pageData.redirectTo}`} replace />;
  }

  // If reserved name is NOT claimed in the database, do not show "Claim this address" to public visitors
  if (!pageData?.profile && isReservedName) {
    return <NotFound />;
  }

  // If page exists, render full-viewport themed background + PageRenderer in live mode
  if (pageData && pageData.profile) {
    const vibe =
      VIBES.find((v) => v.id === pageData.profile?.vibeId) || VIBES[0];

    const BUTTON_RADIUS_MAP: Record<string, number> = {
      square: 0,
      rounded: 12,
      pill: 999,
    };

    const buttonRadiusOverride = pageData.profile.buttonShape
      ? BUTTON_RADIUS_MAP[pageData.profile.buttonShape]
      : undefined;

    const resolvedV2 =
      pageData.profile.appearance && pageData.profile.appearance.schemaVersion === 2
        ? resolveTokens(pageData.profile.appearance, {
            isPro: Boolean(pageData.profile.isVerified ?? pageData.profile.isPro ?? true),
          })
        : null;

    const effectiveBlocks = pageData.links.map((b) => {
      if (unlockedUrls[b.id]) {
        return {
          ...b,
          url: unlockedUrls[b.id],
          isProtected: false,
        };
      }
      return b;
    });

    const widthClass = resolvedV2
      ? resolvedV2.layout.width === 'focused'
        ? 'max-w-[440px]'
        : resolvedV2.layout.width === 'wide'
          ? 'max-w-[720px]'
          : 'max-w-[560px]'
      : pageData.profile.layoutSettings?.pageWidth === 'compact'
        ? 'max-w-[460px]'
        : pageData.profile.layoutSettings?.pageWidth === 'wide'
          ? 'max-w-[680px]'
          : 'max-w-[580px]';

    return (
      <div
        className="relative min-h-[100dvh] w-full flex justify-center overflow-x-hidden"
        style={{
          backgroundColor: resolvedV2 ? resolvedV2.bgProfile.meanHex : vibe.tokens.bg,
          ...(resolvedV2 ? (resolvedV2.cssVars as React.CSSProperties) : {}),
        }}
      >
        {/* Full-Viewport Background Layer */}
        <BackgroundLayer
          mode="fixed"
          background={pageData.profile.background}
          backgroundV2={resolvedV2?.background || null}
          smartScrim={resolvedV2?.smartScrim || null}
          fallbackBg={resolvedV2?.bgProfile.meanHex || vibe.tokens.bg}
        />

        <div className={`relative z-10 w-full min-h-[100dvh] flex flex-col ${widthClass}`}>
          {(() => {
            const effectiveTokens = resolveEffectiveTokens(
              vibe.tokens,
              pageData.profile.buttonColors,
              pageData.profile.background
            );
            const effectiveVibe = { ...vibe, tokens: effectiveTokens };
            const buttonFontFamily =
              resolvedV2?.typography.button.cssFamily ||
              getFontCssFamily(pageData.profile.fontSettings?.buttonFont, vibe.fontFamily);

            return (
              <>
                <PageRenderer
                  vibe={vibe}
                  profile={{
                    name: pageData.profile.displayName,
                    handle: pageData.profile.username,
                    bio: pageData.profile.bio,
                    avatarUrl: pageData.profile.avatarUrl,
                    isPro: Boolean(pageData.profile.isPro),
                    isVerified: Boolean(pageData.profile.isVerified ?? pageData.profile.isPro),
                    isOwnerProfile: Boolean(pageData.profile.isOwnerProfile),
                    socials: pageData.profile.socials,
                    socialsPosition: pageData.profile.socialsPosition || 'top',
                    whatsappNumber: pageData.profile.whatsappNumber || null,
                    background: pageData.profile.background,
                    fontSettings: pageData.profile.fontSettings,
                    buttonColors: pageData.profile.buttonColors,
                    layoutSettings: pageData.profile.layoutSettings,
                    businessCard: pageData.profile.businessCard,
                    appearance: pageData.profile.appearance || null,
                  }}
                  blocks={effectiveBlocks}
                  buttonRadiusOverride={buttonRadiusOverride}
                  hideFooterMark={pageData.profile.hideFooter}
                  embedMode="live"
                  isPublicPage={true}
                  isOwner={
                    Boolean(
                      session.isSignedIn &&
                        session.username?.toLowerCase() === clean.toLowerCase()
                    )
                  }
                  onLinkClick={(block) => {
                    trackLinkClick(block);
                    const w = window as any;
                    if (typeof w.gtag === 'function' && pageData?.profile?.googleAnalyticsId) {
                      w.gtag('event', 'link_click', {
                        link_title: block.title,
                        link_url: block.url || '',
                        creator: clean,
                      });
                    }
                  }}
                  onSocialClick={(platform, url) => {
                    const isOwnerViewer = Boolean(
                      session.isSignedIn &&
                        session.username?.toLowerCase() === clean.toLowerCase()
                    );
                    if (!isOwnerViewer) {
                      trackClick(clean, `social:${platform}`, resolveSource());
                    }
                    const w = window as any;
                    if (typeof w.gtag === 'function' && pageData?.profile?.googleAnalyticsId) {
                      w.gtag('event', 'social_click', {
                        platform,
                        link_url: url,
                        creator: clean,
                      });
                    }
                  }}
                  onWhatsAppClick={(phone) => {
                    const isOwnerViewer = Boolean(
                      session.isSignedIn &&
                        session.username?.toLowerCase() === clean.toLowerCase()
                    );
                    if (!isOwnerViewer) {
                      trackClick(clean, 'whatsapp', resolveSource());
                    }
                    const w = window as any;
                    if (typeof w.gtag === 'function' && pageData?.profile?.googleAnalyticsId) {
                      w.gtag('event', 'whatsapp_click', {
                        phone,
                        creator: clean,
                      });
                    }
                  }}
                  onUnlock={(block) => setUnlockBlock(block)}
                  renderSignupForm={(block, surfaceStyle) => (
                    <SignupFormBlock
                      block={block}
                      vibe={effectiveVibe}
                      ownerName={pageData.profile?.displayName || clean}
                      username={clean}
                      buttonRadiusOverride={buttonRadiusOverride}
                      buttonFontFamily={buttonFontFamily}
                      surfaceStyle={surfaceStyle}
                    />
                  )}
                />

                <UnlockDialog
                  isOpen={unlockBlock !== null}
                  onClose={() => setUnlockBlock(null)}
                  block={unlockBlock}
                  vibe={effectiveVibe}
                  username={clean}
                  buttonRadiusOverride={buttonRadiusOverride}
                  fontFamily={buttonFontFamily}
                  onSuccess={(block, url) => {
                    setUnlockedUrls((prev) => ({ ...prev, [block.id]: url }));
                    trackLinkClick(block);
                  }}
                />
              </>
            );
          })()}
        </div>
      </div>
    );
  }

  // Otherwise, render placeholder/unclaimed page
  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-surface border border-border rounded-[14px] p-8 shadow-[0_1px_2px_rgba(10,10,10,0.04)] flex flex-col items-center">
        <Logo tone="light" size="lg" />

        <div className="mt-5 font-mono text-[20px] font-medium text-ink">
          iveo.site/@{clean}
        </div>

        <h1 className="mt-3 text-[24px] font-medium text-ink leading-tight tracking-[-0.02em]">
          {copy.publicPlaceholder.heading}
        </h1>

        <p className="mt-2 text-[15px] text-muted">
          {copy.publicPlaceholder.body}
        </p>

        <div className="mt-8 w-full flex flex-col gap-2">
          <Button as={Link} to="/" variant="secondary" size="md" fullWidth>
            {copy.publicPlaceholder.button}
          </Button>
          <Button as={Link} to={`/signup?u=${clean}`} variant="primary" size="md" fullWidth>
            Claim this address
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PublicProfilePlaceholder;
