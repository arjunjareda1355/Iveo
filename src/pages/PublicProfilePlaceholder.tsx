import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { PageRenderer } from '../components/page/PageRenderer';
import { UnlockDialog } from '../components/public/UnlockDialog';
import { SignupFormBlock } from '../components/public/SignupFormBlock';
import { NotFound } from './NotFound';
import { validateUsername, normalizeUsername } from '../lib/username-rules';
import { fetchPublicPage } from '../data/publicPageApi';
import { PublicPageData, PageBlock } from '../data/types';
import { VIBES } from '../lib/vibes';
import { pageUrl } from '../lib/site';
import { copy } from '../content/copy';
import { useIveoSession } from '../auth/useIvioSession';
import { setAnalyticsContext, trackView } from '../lib/analytics/track';
import { resolveSource } from '../lib/analytics/sources';
import { trackLinkClick } from '../lib/analytics-seam';
import { normalizeGoogleAnalyticsId, normalizeMetaPixelId } from '../lib/integrations';

export interface PublicProfilePlaceholderProps {
  usernameOverride?: string;
}

export const PublicProfilePlaceholder: React.FC<PublicProfilePlaceholderProps> = ({ usernameOverride }) => {
  const { username } = useParams<{ username: string }>();
  const rawUsername = (usernameOverride || username || '').trim();
  const validation = validateUsername(rawUsername);

  // If reserved or invalid username format, render NotFound component directly
  if (!validation.ok) {
    return <NotFound />;
  }

  const clean = normalizeUsername(rawUsername);
  const [pageData, setPageData] = useState<PublicPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [unlockedUrls, setUnlockedUrls] = useState<Record<string, string>>({});
  const [unlockBlock, setUnlockBlock] = useState<PageBlock | null>(null);

  const session = useIveoSession();
  const viewTrackedRef = useRef(false);
  const ownerExclusionDoneRef = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchPublicPage(clean);
      setPageData(data);
    } catch {
      // Keep existing data on error
    } finally {
      setIsLoading(false);
    }
  }, [clean]);

  useEffect(() => {
    loadData();

    // Refetch interval 60s while tab is visible (does NOT re-trigger tracking)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadData();
    }, 60000);

    const handleVisibility = () => {
      if (!document.hidden) {
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadData]);

  // Set document title, SEO meta description, and canonical tag
  useEffect(() => {
    if (pageData?.profile) {
      const titleText =
        pageData.profile.customSeoTitle ||
        `${pageData.profile.displayName} (@${clean}) | iveo`;
      document.title = titleText;

      const descText =
        pageData.profile.customSeoDescription ||
        pageData.profile.bio ||
        `${pageData.profile.displayName} on iveo`;

      let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = descText;
    } else {
      document.title = `iveo.site/${clean}`;
    }

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = pageUrl(clean);
  }, [pageData, clean]);

  // Execute third-party integrations (Google Analytics 4 & Meta Pixel) when configured on public page
  useEffect(() => {
    const rawGaId = pageData?.profile?.googleAnalyticsId;
    if (!rawGaId) return;
    const gaCheck = normalizeGoogleAnalyticsId(rawGaId);
    if (!gaCheck.valid || !gaCheck.value) return;

    const measurementId = gaCheck.value;
    const scriptId = 'iveo-ga4-script';
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!existingScript) {
      const s = document.createElement('script');
      s.id = scriptId;
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
    w.gtag('js', new Date());
    w.gtag('config', measurementId, {
      page_path: `/${clean}`,
      page_title: document.title,
    });
  }, [pageData?.profile?.googleAnalyticsId, clean]);

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
      t.async = true;
      t.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(t);
    }
    w.fbq('init', pixelId);
    w.fbq('track', 'PageView');
  }, [pageData?.profile?.metaPixelId]);

  // Analytics tracking & owner exclusion logic (Section 5.4 & 7)
  useEffect(() => {
    if (!pageData?.profile) return;

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

    return () => {
      setAnalyticsContext({ enabled: true, username: null, source: null });
    };
  }, [pageData?.profile, clean, session.isLoaded, session.isSignedIn, session.username]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="w-8 h-8 rounded-full border-2 border-ink border-t-transparent animate-spin" />
      </div>
    );
  }

  // If page exists, render PageRenderer in live mode
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

    const bgConfig = pageData.profile.background;
    const customBgStyle: React.CSSProperties = {
      backgroundColor: vibe.tokens.bg,
    };
    if (bgConfig && (bgConfig.type === 'gradient' || bgConfig.type === 'mesh') && bgConfig.value) {
      customBgStyle.background = bgConfig.value;
    }

    return (
      <div
        className="min-h-screen w-full flex justify-center"
        style={customBgStyle}
      >
        <div className="w-full max-w-[580px] min-h-screen flex flex-col">
          <PageRenderer
            vibe={vibe}
            profile={{
              name: pageData.profile.displayName,
              handle: pageData.profile.username,
              bio: pageData.profile.bio,
              avatarUrl: pageData.profile.avatarUrl,
              socials: pageData.profile.socials,
              socialsPosition: pageData.profile.socialsPosition || 'top',
              whatsappNumber: pageData.profile.whatsappNumber || null,
              background: pageData.profile.background,
            }}
            blocks={effectiveBlocks}
            buttonRadiusOverride={buttonRadiusOverride}
            hideFooterMark={pageData.profile.hideFooter}
            embedMode="live"
            isPublicPage={true}
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
            onUnlock={(block) => setUnlockBlock(block)}
            renderSignupForm={(block) => (
              <SignupFormBlock
                block={block}
                vibe={vibe}
                ownerName={pageData.profile?.displayName || clean}
                username={clean}
                buttonRadiusOverride={buttonRadiusOverride}
              />
            )}
          />
        </div>

        <UnlockDialog
          isOpen={unlockBlock !== null}
          onClose={() => setUnlockBlock(null)}
          block={unlockBlock}
          vibe={vibe}
          buttonRadiusOverride={buttonRadiusOverride}
          onSuccess={(block, url) => {
            setUnlockedUrls((prev) => ({ ...prev, [block.id]: url }));
            trackLinkClick(block);
          }}
        />
      </div>
    );
  }

  // Otherwise, render placeholder/unclaimed page
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md bg-surface border border-border rounded-[14px] p-8 shadow-[0_1px_2px_rgba(10,10,10,0.04)] flex flex-col items-center">
        <Logo tone="light" size="lg" />

        <div className="mt-5 font-mono text-[20px] font-medium text-ink">
          iveo.site/{clean}
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
