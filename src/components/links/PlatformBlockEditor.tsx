import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RefreshCw,
  RotateCcw,
  Unplug,
  X,
} from 'lucide-react';
import type {
  Block,
  CardLookStyle,
  CoffeeData,
  EmbedMetaData,
  EmbedProvider,
  PageBlock,
  YouTubeData,
} from '../../data/types';
import { useIvioSession } from '../../auth/useIvioSession';
import { VIBES } from '../../lib/vibes';
import { getFontCssFamily, loadGoogleFonts } from '../../lib/fonts';
import { resolveEffectiveTokens } from '../../lib/colors';
import {
  DEFAULT_LAYOUT_SETTINGS,
  normalizeCardLookKey,
} from '../../lib/preferences';
import { getCardLookOption, normalizeEmbedLookStyle } from '../../lib/embedLooks';
import {
  detectProviderUrl,
  getProviderDefinition,
  getProviderKindDefinition,
} from '../../lib/providers';
import type {
  CardAccentMode,
  CardButtonStyle,
  CardCornerMode,
  DisplayAsMode,
  PlayerSize,
  ProviderId,
} from '../../lib/providers/types';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Toggle } from '../ui/Toggle';
import { ScheduleSection } from './ScheduleSection';
import { CardLookTileGrid } from './CardLookTile';
import { BannerImageControls } from './BannerImageControls';
import { deleteCardBannersFromServer } from '../../lib/bannerClientImage';
import { sanitizeEmbedMetaBannerForSave } from '../../lib/cardBanner';
import { EmbedBlock, ProviderGlyph } from '../page/EmbedBlock';
import { CoffeeCardBlock } from '../page/CoffeeCardBlock';

export interface PlatformEditorSavePayload {
  url: string;
  title: string;
  provider: EmbedProvider;
  embedMeta: EmbedMetaData;
  youtubeData?: YouTubeData | null;
  coffeeData?: CoffeeData | null;
  schedule?: { startAt: string | null; endAt: string | null };
}

export interface PlatformBlockEditorProps {
  isOpen: boolean;
  onClose: () => void;
  initialProvider?: EmbedProvider;
  initialUrl?: string;
  block?: Block | null;
  isPro: boolean;
  onSave: (payload: PlatformEditorSavePayload) => Promise<void>;
  onClearScheduleImmediate?: () => Promise<void>;
}

function deriveInitialFromBlock(
  block: Block | null | undefined,
  fallbackProvider: EmbedProvider = 'generic',
  initialUrl = ''
): {
  provider: EmbedProvider;
  url: string;
  title: string;
  meta: EmbedMetaData;
  coffeeData: CoffeeData | null;
  startAt: string | null;
  endAt: string | null;
} {
  if (!block) {
    const detected = initialUrl ? detectProviderUrl(initialUrl) : null;
    const provider = (detected?.provider || fallbackProvider) as EmbedProvider;
    const def = getProviderDefinition(provider);
    const subtype = detected?.subtype || def.defaultKind;
    const kindDef = getProviderKindDefinition(provider, subtype);
    return {
      provider,
      url: detected?.canonicalUrl || initialUrl || '',
      title: '',
      meta: {
        provider,
        subtype,
        displayAs:
          detected?.defaultDisplayAs ||
          (kindDef.capabilities.player ? def.defaultDisplayMode : 'card'),
        playerSize: def.defaultPlayerSize || 'standard',
        showAvatar: true,
        showDescription: true,
        showStats: kindDef.capabilities.stats,
        showPlatformLabel: true,
      },
      coffeeData: null,
      startAt: null,
      endAt: null,
    };
  }

  // Legacy YouTube card block compatibility
  if (block.kind === 'youtube') {
    const yt = block.youtube;
    const detected = block.url ? detectProviderUrl(block.url) : null;
    const subtype = detected?.subtype || 'channel';
    return {
      provider: 'youtube',
      url: block.url || '',
      title: block.title || yt?.channelTitle || '',
      meta: {
        provider: 'youtube',
        subtype,
        title: yt?.channelTitle || block.title || null,
        subtitle: yt?.handle || block.badge || null,
        handle: yt?.handle || null,
        description: yt?.description || null,
        avatarUrl: yt?.avatarUrl || null,
        statsLabel: yt?.subscriberText || null,
        ctaLabel: yt?.buttonLabel || 'Subscribe',
        displayAs: subtype === 'video' || subtype === 'playlist' ? 'player' : 'card',
        playerSize: 'standard',
        showAvatar: true,
        showDescription: true,
        showStats: true,
        showPlatformLabel: true,
        connectedViaOAuth: Boolean(yt?.connectedViaOAuth),
        fetchedAt: yt?.fetchedAt || null,
      },
      coffeeData: null,
      startAt: block.startAt || null,
      endAt: block.endAt || null,
    };
  }

  // Legacy Instagram card block compatibility
  if (block.kind === 'instagram') {
    const detected = block.url ? detectProviderUrl(block.url) : null;
    const subtype = detected?.subtype || 'profile';
    return {
      provider: 'instagram',
      url: block.url || '',
      title: block.title || '',
      meta: {
        provider: 'instagram',
        subtype,
        title: block.title || null,
        subtitle: block.badge || null,
        displayAs: 'card',
        showAvatar: true,
        showDescription: true,
        showStats: false,
        showPlatformLabel: true,
      },
      coffeeData: null,
      startAt: block.startAt || null,
      endAt: block.endAt || null,
    };
  }

  // Buy Me a Coffee card block compatibility (legacy & themed)
  if (block.kind === 'coffee') {
    const c = block.coffee;
    const existingMeta = block.embedMeta;
    const handle = c?.slug ? `@${c.slug.replace(/^@/, '')}` : existingMeta?.handle || null;
    const fallbackUrl =
      block.url ||
      (c?.slug ? `https://www.buymeacoffee.com/${c.slug}` : 'https://www.buymeacoffee.com');
    const derivedStats =
      existingMeta?.statsLabel ??
      c?.supportersLabel ??
      (typeof c?.supportersCount === 'number' && c.supportersCount > 0
        ? `${c.supportersCount} supporters`
        : null);
    return {
      provider: 'coffee',
      url: fallbackUrl,
      title: block.title || existingMeta?.title || c?.creatorName || 'Buy Me a Coffee',
      meta: {
        ...(existingMeta || { provider: 'coffee' }),
        provider: 'coffee',
        subtype: existingMeta?.subtype || 'profile',
        title: existingMeta?.title || c?.creatorName || block.title || null,
        handle,
        subtitle:
          existingMeta?.subtitle ||
          block.badge ||
          (c?.slug ? `buymeacoffee.com/${c.slug}` : null),
        description: existingMeta?.description || c?.bio || null,
        avatarUrl: existingMeta?.avatarUrl || c?.avatarUrl || null,
        coverUrl: existingMeta?.coverUrl || c?.coverUrl || null,
        statsLabel: derivedStats,
        ctaLabel: existingMeta?.ctaLabel || c?.buttonLabel || 'Support with a Coffee',
        displayAs: 'card',
        lookStyle: existingMeta?.lookStyle
          ? normalizeEmbedLookStyle(existingMeta.lookStyle, 'match_page')
          : undefined,
        showAvatar: existingMeta?.showAvatar ?? true,
        showDescription: existingMeta?.showDescription ?? true,
        showStats: existingMeta?.showStats ?? true,
        showPlatformLabel: existingMeta?.showPlatformLabel ?? true,
      },
      coffeeData: c || null,
      startAt: block.startAt || null,
      endAt: block.endAt || null,
    };
  }

  const detected = block.url ? detectProviderUrl(block.url) : null;
  const provider = (block.embedMeta?.provider || block.embedProvider || detected?.provider || fallbackProvider) as EmbedProvider;
  const def = getProviderDefinition(provider);
  const subtype = block.embedMeta?.subtype || detected?.subtype || def.defaultKind;
  const kindDef = getProviderKindDefinition(provider, subtype);

  return {
    provider,
    url: block.url || '',
    title: block.title || block.embedMeta?.override?.title || block.embedMeta?.title || '',
    meta: {
      ...(block.embedMeta || { provider }),
      provider,
      subtype,
      lookStyle: block.embedMeta?.lookStyle
        ? normalizeEmbedLookStyle(block.embedMeta.lookStyle, 'match_page')
        : undefined,
      displayAs:
        block.embedMeta?.displayAs ||
        (kindDef.capabilities.player ? def.defaultDisplayMode : 'card'),
      playerSize: block.embedMeta?.playerSize || def.defaultPlayerSize || 'standard',
      showAvatar: block.embedMeta?.showAvatar ?? true,
      showDescription: block.embedMeta?.showDescription ?? true,
      showStats: block.embedMeta?.showStats ?? kindDef.capabilities.stats,
      showPlatformLabel: block.embedMeta?.showPlatformLabel ?? true,
    },
    coffeeData: block.coffee || null,
    startAt: block.startAt || null,
    endAt: block.endAt || null,
  };
}

export const PlatformBlockEditor: React.FC<PlatformBlockEditorProps> = ({
  isOpen,
  onClose,
  initialProvider = 'generic',
  initialUrl = '',
  block = null,
  isPro,
  onSave,
  onClearScheduleImmediate,
}) => {
  const session = useIvioSession();
  const isEditing = Boolean(block);

  const initialState = useMemo(
    () => deriveInitialFromBlock(block, initialProvider, initialUrl),
    [block, initialProvider, initialUrl]
  );

  const [provider, setProvider] = useState<EmbedProvider>(initialState.provider);
  const [urlInput, setUrlInput] = useState(initialState.url);
  const [titleInput, setTitleInput] = useState(initialState.title);
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(Boolean(initialState.title));
  const [meta, setMeta] = useState<EmbedMetaData>(initialState.meta);
  const [coffeeData, setCoffeeData] = useState<CoffeeData | null>(initialState.coffeeData);
  const [startAt, setStartAt] = useState<string | null>(initialState.startAt);
  const [endAt, setEndAt] = useState<string | null>(initialState.endAt);

  // More options state
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [mobilePreviewExpanded, setMobilePreviewExpanded] = useState(true);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Async & validation status
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [mismatchHint, setMismatchHint] = useState<{
    provider: ProviderId;
    name: string;
    canonicalUrl: string;
  } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [oauthAvailability, setOauthAvailability] = useState<Record<string, boolean> | null>(null);

  const [isBannerUploading, setIsBannerUploading] = useState(false);

  const linkInputRef = useRef<HTMLInputElement | null>(null);
  const lastResolvedUrlRef = useRef<string>(block?.url || '');
  const lookupSeqRef = useRef(0);
  const uncommittedBannerUrlsRef = useRef<Set<string>>(new Set());

  // Sync state whenever editor opens or target block changes
  useEffect(() => {
    if (!isOpen) return;
    const init = deriveInitialFromBlock(block, initialProvider, initialUrl);
    setProvider(init.provider);
    setUrlInput(init.url);
    setTitleInput(init.title);
    setTitleManuallyEdited(Boolean(init.title));
    setMeta(init.meta);
    setCoffeeData(init.coffeeData);
    setStartAt(init.startAt);
    setEndAt(init.endAt);
    setIsMoreOpen(false);
    setConfirmDiscard(false);
    setLookupFailed(false);
    setUrlError(null);
    setMismatchHint(null);
    setSaveError(null);
    setIsBannerUploading(false);
    uncommittedBannerUrlsRef.current.clear();
    setIsDirty(!block && Boolean(init.url));
    lastResolvedUrlRef.current = block?.url || '';

    const timer = setTimeout(() => {
      if (!block) linkInputRef.current?.focus();
    }, 60);

    let cancelled = false;
    fetch('/api/oauth/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.ok && json?.providers && typeof json.providers === 'object') {
          setOauthAvailability(json.providers);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, block, initialProvider, initialUrl]);

  // Body scroll lock + Escape close guard
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (isDirty && !confirmDiscard) {
          setConfirmDiscard(true);
        } else {
          cleanupUncommittedAndClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, isDirty, confirmDiscard]);

  const providerDef = getProviderDefinition(provider);
  const detectedCurrent = useMemo(
    () => detectProviderUrl(urlInput.trim(), provider),
    [urlInput, provider]
  );
  const activeSubtype = meta.subtype || detectedCurrent?.subtype || providerDef.defaultKind;
  const kindDef = getProviderKindDefinition(provider, activeSubtype);

  // Page appearance tokens for live preview & card look tiles
  const activeVibe = useMemo(
    () => VIBES.find((v) => v.id === session.vibeId) || VIBES[0],
    [session.vibeId]
  );

  useEffect(() => {
    if (session.fontSettings) {
      loadGoogleFonts([
        session.fontSettings.nameFont,
        session.fontSettings.bioFont,
        session.fontSettings.buttonFont,
      ]);
    }
  }, [session.fontSettings]);

  const pageCardLook: CardLookStyle = normalizeCardLookKey(
    session.layoutSettings?.cardLook || DEFAULT_LAYOUT_SETTINGS.cardLook,
    'match_page'
  );

  const effectiveRadius = useMemo(() => {
    const shape =
      session.buttonShape ||
      (activeVibe.nativeShape.toLowerCase() as 'square' | 'rounded' | 'pill');
    if (shape === 'square') return 0;
    if (shape === 'pill') return 999;
    return 12;
  }, [session.buttonShape, activeVibe]);

  const effectiveTokens = useMemo(
    () => resolveEffectiveTokens(activeVibe.tokens, session.buttonColors || null, session.background),
    [activeVibe, session.buttonColors, session.background]
  );

  const canChooseDisplayMode =
    providerDef.allowedDisplayModes.length > 1 && kindDef.capabilities.player;

  const displayAs: DisplayAsMode =
    meta.displayAs === 'player' && kindDef.capabilities.player
      ? 'player'
      : meta.displayAs === 'card'
        ? 'card'
        : kindDef.capabilities.player
          ? providerDef.defaultDisplayMode
          : 'card';
  const isSocialProfileFlow =
    provider !== 'generic' && kindDef.contentKind === 'profile' && displayAs === 'card';

  const pendingRedirectOAuthRef = useRef<any>(null);

  // Consume one-time server OAuth redirect result on mount if popup was blocked on mobile
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const resultToken = params.get('iveo_oauth_result');
    const oauthErr = params.get('iveo_oauth_error');
    if (!resultToken && !oauthErr) return;

    params.delete('iveo_oauth_result');
    params.delete('iveo_oauth_error');
    const nextSearch = params.toString();
    const cleanUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, cleanUrl);

    if (oauthErr) {
      pendingRedirectOAuthRef.current = {
        type: 'IVEO_SOCIAL_OAUTH_ERROR',
        error: oauthErr,
      };
      return;
    }

    if (resultToken) {
      fetch(`/api/oauth/result?token=${encodeURIComponent(resultToken)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (json?.ok && json?.result) {
            pendingRedirectOAuthRef.current = json.result;
          }
        })
        .catch(() => {});
    }
  }, []);

  // Listen for account connection popup events (ZERO "OAuth" copy shown to creator)
  useEffect(() => {
    if (!isOpen) return;

    const handlePopupPayload = (payload: any) => {
      if (!payload || typeof payload !== 'object') return;
      if (payload.type === 'IVEO_SOCIAL_OAUTH_SUCCESS') {
        if (payload.provider && payload.provider !== provider) return;
        const em = (payload.embed || payload.connection?.embedMeta || {}) as EmbedMetaData & {
          url?: string;
        };
        const nextUrl = em.url || payload.connection?.url || urlInput;
        if (nextUrl) {
          setUrlInput(nextUrl);
          lastResolvedUrlRef.current = nextUrl;
        }
        setMeta((prev) => ({
          ...prev,
          ...em,
          provider,
          connectedViaOAuth: true,
          needsAttention: false,
          failureCount: 0,
          fetchedAt: em.fetchedAt || new Date().toISOString(),
        }));
        if (!titleManuallyEdited && (em.title || payload.connection?.title)) {
          setTitleInput(String(em.title || payload.connection?.title).slice(0, 60));
        }
        setIsDirty(true);
        setLookupFailed(false);
        setUrlError(null);
        setIsConnecting(false);
      } else if (payload.type === 'IVEO_YOUTUBE_OAUTH_SUCCESS' && provider === 'youtube' && payload.channel) {
        const ch = payload.channel;
        const chUrl = ch.channelUrl || urlInput;
        if (chUrl) {
          setUrlInput(chUrl);
          lastResolvedUrlRef.current = chUrl;
        }
        setMeta((prev) => ({
          ...prev,
          provider: 'youtube',
          subtype: 'channel',
          title: ch.channelTitle || prev.title,
          handle: ch.handle || prev.handle,
          subtitle: ch.handle || prev.subtitle,
          avatarUrl: ch.avatarUrl || prev.avatarUrl,
          statsLabel: ch.subscriberCountText || prev.statsLabel,
          displayAs: 'card',
          connectedViaOAuth: true,
          needsAttention: false,
          failureCount: 0,
          fetchedAt: new Date().toISOString(),
        }));
        if (!titleManuallyEdited && ch.channelTitle) {
          setTitleInput(String(ch.channelTitle).slice(0, 60));
        }
        setIsDirty(true);
        setLookupFailed(false);
        setUrlError(null);
        setIsConnecting(false);
      } else if (
        payload.type === 'IVEO_SOCIAL_OAUTH_ERROR' ||
        payload.type === 'IVEO_YOUTUBE_OAUTH_ERROR'
      ) {
        setSaveError(payload.error || `Couldn't finish connecting ${providerDef.name}.`);
        setIsConnecting(false);
      }
    };

    if (pendingRedirectOAuthRef.current) {
      const pending = pendingRedirectOAuthRef.current;
      pendingRedirectOAuthRef.current = null;
      handlePopupPayload(pending);
    }

    const onMessage = (e: MessageEvent) => handlePopupPayload(e.data);
    const onStorage = (e: StorageEvent) => {
      if (
        (e.key === 'iveo_social_oauth_result' || e.key === 'iveo_yt_oauth_result') &&
        e.newValue
      ) {
        try {
          handlePopupPayload(JSON.parse(e.newValue));
          localStorage.removeItem(e.key);
        } catch {
          // ignore
        }
      }
    };

    let bcSocial: BroadcastChannel | null = null;
    let bcYt: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bcSocial = new BroadcastChannel('iveo_social_oauth');
        bcSocial.onmessage = (e) => handlePopupPayload(e.data);
        bcYt = new BroadcastChannel('iveo_yt_oauth');
        bcYt.onmessage = (e) => handlePopupPayload(e.data);
      }
    } catch {
      // ignore
    }

    window.addEventListener('message', onMessage);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('storage', onStorage);
      bcSocial?.close();
      bcYt?.close();
    };
  }, [isOpen, provider, providerDef.name, titleManuallyEdited, urlInput]);

  // Debounced URL lookup
  const runLookup = async (targetUrl: string, force = false) => {
    const clean = targetUrl.trim();
    if (!clean) {
      setUrlError(null);
      setMismatchHint(null);
      return;
    }

    const detected = detectProviderUrl(clean, provider);
    if (!detected) {
      setMismatchHint(null);
      setUrlError(`This doesn't look like a ${providerDef.name} link or username`);
      return;
    }

    // Mismatch detection if editor was opened specifically for a different platform
    if (
      provider !== 'generic' &&
      detected.provider !== 'generic' &&
      detected.provider !== provider
    ) {
      const detectedDef = getProviderDefinition(detected.provider);
      setMismatchHint({
        provider: detected.provider,
        name: detectedDef.name,
        canonicalUrl: detected.canonicalUrl,
      });
      setUrlError(`This doesn't look like a ${providerDef.name} link`);
      return;
    }

    setMismatchHint(null);
    setUrlError(null);

    if (!force && detected.canonicalUrl === lastResolvedUrlRef.current && meta.fetchedAt) {
      return;
    }

    const seq = ++lookupSeqRef.current;
    setIsLookingUp(true);
    setLookupFailed(false);

    try {
      // Buy Me a Coffee live creator & supporters lookup
      if (detected.provider === 'coffee' || provider === 'coffee') {
        const res = await fetch(
          `/api/integrations/buymeacoffee?url=${encodeURIComponent(detected.canonicalUrl)}`
        );
        const data = await res.json().catch(() => null);
        if (seq !== lookupSeqRef.current) return;

        if (res.ok && data?.ok && data?.profile) {
          const p = data.profile;
          lastResolvedUrlRef.current = detected.canonicalUrl;
          const creatorTitle = p.displayName || p.creatorName || p.slug || 'Buy Me a Coffee';
          const mappedSupporters = Array.isArray(p.recentSupporters)
            ? p.recentSupporters.map((s: any, idx: number) => ({
                id: String(s.id || idx),
                supporterName: String(s.supporterName || s.name || 'Supporter'),
                coffees: Number(s.coffees || 1),
                note: s.note ?? s.message ?? null,
                createdAt: s.createdAt ?? null,
              }))
            : [];
          const countNum =
            typeof p.supporterCount === 'number'
              ? p.supporterCount
              : typeof p.supportersCount === 'number'
                ? p.supportersCount
                : undefined;

          const mergedCoffee: CoffeeData = {
            ...(coffeeData || {}),
            slug: p.slug || coffeeData?.slug,
            creatorName: creatorTitle,
            bio: p.bio || coffeeData?.bio,
            avatarUrl: p.avatarUrl || coffeeData?.avatarUrl,
            coverUrl: p.coverUrl || coffeeData?.coverUrl,
            coffeePrice: p.coffeePrice || coffeeData?.coffeePrice,
            supportersCount: countNum ?? coffeeData?.supportersCount,
            supportersLabel: p.supportersLabel || coffeeData?.supportersLabel,
            extrasCount: typeof p.extrasCount === 'number' ? p.extrasCount : coffeeData?.extrasCount,
            recentSupporters: mappedSupporters.length > 0 ? mappedSupporters : coffeeData?.recentSupporters,
            extras: Array.isArray(p.extras) && p.extras.length > 0 ? p.extras : coffeeData?.extras,
            buttonLabel: meta.ctaLabel?.trim() || coffeeData?.buttonLabel || 'Support with a Coffee',
            fetchedAt: p.fetchedAt || new Date().toISOString(),
          };
          setCoffeeData(mergedCoffee);

          const statsText =
            p.supportersLabel ||
            (typeof countNum === 'number' && countNum > 0 ? `${countNum} supporters` : null);

          setMeta((prev) => ({
            ...prev,
            provider: 'coffee',
            subtype: 'profile',
            title: creatorTitle,
            handle: p.slug ? `@${String(p.slug).replace(/^@/, '')}` : prev.handle ?? null,
            subtitle: p.slug ? `buymeacoffee.com/${p.slug}` : prev.subtitle ?? null,
            description: p.bio ?? prev.description ?? null,
            avatarUrl: p.avatarUrl ?? prev.avatarUrl ?? null,
            coverUrl: p.coverUrl ?? prev.coverUrl ?? null,
            statsLabel: statsText ?? prev.statsLabel ?? null,
            source: 'opengraph',
            needsAttention: false,
            failureCount: 0,
            fetchedAt: p.fetchedAt || new Date().toISOString(),
          }));

          if (!titleManuallyEdited && creatorTitle) {
            setTitleInput(String(creatorTitle).slice(0, 60));
          }
        } else {
          setLookupFailed(true);
          setIsMoreOpen(true);
        }
        return;
      }

      const qs = new URLSearchParams({ url: detected.canonicalUrl });
      if (force) qs.set('forceRefresh', '1');
      if (block?.id) qs.set('blockId', block.id);

      const res = await fetch(`/api/integrations/embed?${qs.toString()}`);
      const data = await res.json().catch(() => null);

      if (seq !== lookupSeqRef.current) return;

      const resolved = data?.embed || data?.embedMeta;
      if (res.ok && data?.ok && resolved) {
        lastResolvedUrlRef.current = data.canonicalUrl || detected.canonicalUrl;
        const resolvedProvider = (data.provider || detected.provider || provider) as EmbedProvider;
        const resolvedSubtype = resolved.subtype || detected.subtype || activeSubtype;
        const resolvedKindDef = getProviderKindDefinition(resolvedProvider, resolvedSubtype);

        setMeta((prev) => ({
          ...prev,
          provider: resolvedProvider,
          subtype: resolvedSubtype,
          title: resolved.title ?? prev.title ?? null,
          subtitle: resolved.subtitle ?? prev.subtitle ?? null,
          handle: resolved.handle ?? prev.handle ?? null,
          description: resolved.description ?? prev.description ?? null,
          avatarUrl: resolved.avatarUrl ?? prev.avatarUrl ?? null,
          coverUrl: resolved.coverUrl ?? prev.coverUrl ?? null,
          statsLabel: resolvedKindDef.capabilities.stats
            ? resolved.statsLabel ?? prev.statsLabel ?? null
            : null,
          stats: resolvedKindDef.capabilities.stats ? resolved.stats : undefined,
          source: resolved.source || 'opengraph',
          staleSnapshot: Boolean(resolved.staleSnapshot),
          needsAttention: false,
          failureCount: 0,
          fetchedAt: resolved.fetchedAt || new Date().toISOString(),
        }));

        if (!titleManuallyEdited && (resolved.title || data.suggestedTitle)) {
          setTitleInput(String(resolved.title || data.suggestedTitle).slice(0, 60));
        }
      } else {
        setLookupFailed(true);
        setIsMoreOpen(true);
      }
    } catch {
      if (seq === lookupSeqRef.current) {
        setLookupFailed(true);
        setIsMoreOpen(true);
      }
    } finally {
      if (seq === lookupSeqRef.current) {
        setIsLookingUp(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const clean = urlInput.trim();
    if (!clean) {
      setUrlError(null);
      setMismatchHint(null);
      return;
    }

    const timer = setTimeout(() => {
      void runLookup(clean, false);
    }, 380);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlInput, provider, isOpen]);

  // Debounced live preview block (150ms per ED-4)
  const [previewBlock, setPreviewBlock] = useState<PageBlock>(() => ({
    id: block?.id || 'preview-platform-block',
    kind: provider === 'coffee' ? 'coffee' : 'embed',
    title: titleInput || kindDef.label,
    url: detectedCurrent?.canonicalUrl || urlInput || null,
    embedProvider: provider,
    embedMeta: meta,
    coffee: provider === 'coffee' ? coffeeData : undefined,
    isActive: true,
    isArchived: false,
  }));

  useEffect(() => {
    const timer = setTimeout(() => {
      setPreviewBlock({
        id: block?.id || 'preview-platform-block',
        kind: provider === 'coffee' ? 'coffee' : 'embed',
        title: titleInput.trim() || meta.title || kindDef.label,
        url: detectedCurrent?.canonicalUrl || urlInput.trim() || null,
        embedProvider: provider,
        embedMeta: {
          ...meta,
          provider,
          subtype: activeSubtype,
          displayAs,
        },
        coffee: provider === 'coffee' ? coffeeData : undefined,
        isActive: true,
        isArchived: false,
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [block?.id, titleInput, urlInput, detectedCurrent?.canonicalUrl, provider, meta, coffeeData, activeSubtype, displayAs, kindDef.label]);

  if (!isOpen) return null;

  const fallbackConnectByProfileOrHint = async () => {
    if (provider === 'pinterest') {
      try {
        const pinRes = await fetch('/api/integrations/pinterest/me');
        const pinData = await pinRes.json().catch(() => null);
        if (pinRes.ok && pinData?.ok && pinData?.profile) {
          const p = pinData.profile;
          const profileUrl = p.profileUrl || `https://www.pinterest.com/${p.username || ''}/`;
          setUrlInput(profileUrl);
          lastResolvedUrlRef.current = profileUrl;
          setMeta((prev) => ({
            ...prev,
            provider: 'pinterest',
            subtype: 'profile',
            title: p.displayName || p.username || prev.title,
            handle: p.username ? `@${p.username}` : prev.handle,
            subtitle: p.username ? `@${p.username}` : prev.subtitle,
            description: p.bio || prev.description,
            avatarUrl: p.avatarUrl || prev.avatarUrl,
            statsLabel: p.statsLabel || prev.statsLabel,
            connectedViaOAuth: true,
            needsAttention: false,
            failureCount: 0,
            fetchedAt: new Date().toISOString(),
          }));
          if (!titleManuallyEdited && (p.displayName || p.username)) {
            setTitleInput(String(p.displayName || p.username).slice(0, 60));
          }
          setIsDirty(true);
          setUrlError(null);
          setIsConnecting(false);
          return;
        }
      } catch {
        // Fall through to link sync / prompt
      }
    }

    if (urlInput.trim()) {
      setIsConnecting(false);
      await runLookup(urlInput.trim(), true);
      return;
    }

    setIsConnecting(false);
    setUrlError(`Enter your ${providerDef.name} profile link or @username above to connect.`);
    linkInputRef.current?.focus();
  };

  const handleConnectAccount = async () => {
    setSaveError(null);
    setUrlError(null);
    setIsConnecting(true);
    try {
      let availability = oauthAvailability;
      if (!availability) {
        try {
          const stRes = await fetch('/api/oauth/status');
          const stJson = await stRes.json().catch(() => null);
          if (stRes.ok && stJson?.ok && stJson?.providers && typeof stJson.providers === 'object') {
            availability = stJson.providers;
            setOauthAvailability(stJson.providers);
          }
        } catch {
          // ignore
        }
      }

      if (!availability || !availability[provider]) {
        await fallbackConnectByProfileOrHint();
        return;
      }

      const commonQs = new URLSearchParams({
        origin: window.location.origin,
        returnTo: `${window.location.pathname}${window.location.search}`,
      });
      if (session.username) commonQs.set('username', session.username);
      if (session.userId) commonQs.set('userId', session.userId);

      const baseEndpoint =
        provider === 'youtube'
          ? `/api/oauth/youtube/url`
          : `/api/oauth/${provider}/url`;
      const res = await fetch(`${baseEndpoint}?${commonQs.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data?.url) {
        if (
          res.status === 503 ||
          data?.error === 'oauth_not_configured' ||
          /not configured/i.test(String(data?.message || ''))
        ) {
          await fallbackConnectByProfileOrHint();
          return;
        }
        setSaveError(data?.message || `${providerDef.name} connection is unavailable right now.`);
        setIsConnecting(false);
        return;
      }

      const w = 520;
      const h = 660;
      const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
      const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
      const popup = window.open(
        data.url,
        `iveo_connect_${provider}`,
        `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );
      if (!popup) {
        const redirectQs = new URLSearchParams(commonQs);
        redirectQs.set('mode', 'redirect');
        const redirectRes = await fetch(`${baseEndpoint}?${redirectQs.toString()}`).catch(() => null);
        const redirectData = await redirectRes?.json().catch(() => null);
        if (redirectRes?.ok && redirectData?.ok && redirectData?.url) {
          window.location.assign(redirectData.url);
          return;
        }
        setSaveError('Allow popups to connect your account, or paste the link directly above.');
        setIsConnecting(false);
      }
    } catch {
      await fallbackConnectByProfileOrHint();
    }
  };

  const handleDisconnectAccount = () => {
    setMeta((prev) => ({ ...prev, connectedViaOAuth: false }));
    setIsDirty(true);
  };

  const handleResetDefaults = () => {
    setMeta((prev) => ({
      ...prev,
      lookStyle: undefined,
      accentMode: undefined,
      accentColor: undefined,
      corners: 'page',
      buttonStyle: undefined,
      showAvatar: true,
      showPlatformLabel: true,
      override: undefined,
    }));
    setIsDirty(true);
  };

  const handleSwitchDetectedProvider = (target: {
    provider: ProviderId;
    canonicalUrl: string;
  }) => {
    const nextDef = getProviderDefinition(target.provider);
    const nextDet = detectProviderUrl(target.canonicalUrl);
    const nextSub = nextDet?.subtype || nextDef.defaultKind;
    const nextKind = getProviderKindDefinition(target.provider, nextSub);
    setProvider(target.provider as EmbedProvider);
    setUrlInput(target.canonicalUrl);
    setMismatchHint(null);
    setUrlError(null);
    setMeta((prev) => ({
      ...prev,
      provider: target.provider as EmbedProvider,
      subtype: nextSub,
      displayAs: nextKind.capabilities.player ? nextDef.defaultDisplayMode : 'card',
      playerSize: nextDef.defaultPlayerSize || 'standard',
      showStats: nextKind.capabilities.stats,
    }));
    lastResolvedUrlRef.current = '';
    setIsDirty(true);
  };

  const updateMeta = (patch: Partial<EmbedMetaData>) => {
    setMeta((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  };

  const updateOverride = (patch: NonNullable<EmbedMetaData['override']>) => {
    setMeta((prev) => ({
      ...prev,
      override: {
        ...(prev.override || {}),
        ...patch,
      },
    }));
    setIsDirty(true);
  };

  const effectiveLook: CardLookStyle = meta.lookStyle
    ? normalizeEmbedLookStyle(meta.lookStyle, pageCardLook)
    : pageCardLook;

  const isUsingPageDefaultLook = !meta.lookStyle;
  const activeLookOption = getCardLookOption(effectiveLook);

  const isPlainBackground =
    !session.background ||
    session.background.type === 'none' ||
    session.background.type === 'solid';

  const activeOverridesSummary = (() => {
    const parts: string[] = [];
    if (meta.accentMode && meta.accentMode !== (effectiveLook === 'match_page' ? 'page' : 'brand')) {
      parts.push(`Accent: ${meta.accentMode}`);
    }
    if (meta.corners && meta.corners !== 'page') {
      parts.push(`Corners: ${meta.corners}`);
    }
    if (meta.buttonStyle) {
      parts.push(`Button: ${meta.buttonStyle}`);
    }
    if (meta.override?.title || meta.override?.description || meta.override?.imageUrl) {
      parts.push('Custom text/image');
    }
    return parts.length > 0 ? parts.join(' · ') : 'Default';
  })();

  const canSubmit =
    Boolean(urlInput.trim()) &&
    Boolean(detectedCurrent) &&
    !urlError &&
    !isSaving &&
    !isBannerUploading &&
    (!isEditing || isDirty);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!urlInput.trim() || !detectedCurrent) {
      setUrlError(`Enter a valid ${providerDef.name} link.`);
      return;
    }
    if (startAt && endAt && new Date(endAt) <= new Date(startAt)) {
      setSaveError('Hide time must be after the show time.');
      return;
    }

    const finalUrl = detectedCurrent.canonicalUrl;
    const finalTitle =
      titleInput.trim() ||
      meta.override?.title?.trim() ||
      meta.title?.trim() ||
      kindDef.label;

    const cleanOverride = meta.override
      ? {
          title: meta.override.title?.trim() || null,
          subtitle: meta.override.subtitle?.trim() || null,
          description: meta.override.description?.trim() || null,
          imageUrl: meta.override.imageUrl?.trim() || null,
        }
      : undefined;

    const rawFinalMeta: EmbedMetaData = {
      ...meta,
      provider,
      subtype: activeSubtype,
      displayAs,
      playerSize: displayAs === 'player' ? meta.playerSize || providerDef.defaultPlayerSize || 'standard' : undefined,
      ctaLabel: meta.ctaLabel?.trim() || null,
      override:
        cleanOverride &&
        (cleanOverride.title ||
          cleanOverride.subtitle ||
          cleanOverride.description ||
          cleanOverride.imageUrl)
          ? cleanOverride
          : undefined,
    };

    const finalMeta: EmbedMetaData =
      (sanitizeEmbedMetaBannerForSave(
        rawFinalMeta,
        displayAs === 'card' ? effectiveLook : 'player',
        { allowDataUrl: !session.userId }
      ) as EmbedMetaData) || rawFinalMeta;

    const youtubeData: YouTubeData | undefined =
      block?.kind === 'youtube'
        ? {
            ...(block.youtube || {}),
            channelTitle: finalMeta.title || finalTitle,
            handle: finalMeta.handle || block.youtube?.handle || null,
            description: finalMeta.description || block.youtube?.description || null,
            avatarUrl: finalMeta.avatarUrl || block.youtube?.avatarUrl || null,
            subscriberText: finalMeta.statsLabel || block.youtube?.subscriberText || null,
            buttonLabel: finalMeta.ctaLabel || block.youtube?.buttonLabel || 'Subscribe',
            connectedViaOAuth: Boolean(finalMeta.connectedViaOAuth),
          }
        : undefined;

    const finalCoffeeData: CoffeeData | undefined =
      provider === 'coffee'
        ? {
            ...(coffeeData || block?.coffee || {}),
            slug:
              (finalMeta.handle || '').replace(/^@/, '').trim() ||
              coffeeData?.slug ||
              block?.coffee?.slug ||
              finalUrl.split('/').filter(Boolean).pop() ||
              undefined,
            creatorName: finalMeta.override?.title || finalMeta.title || finalTitle,
            bio:
              finalMeta.override?.description ||
              finalMeta.description ||
              coffeeData?.bio ||
              block?.coffee?.bio,
            avatarUrl:
              finalMeta.override?.imageUrl ||
              finalMeta.avatarUrl ||
              coffeeData?.avatarUrl ||
              block?.coffee?.avatarUrl,
            coverUrl: finalMeta.coverUrl || coffeeData?.coverUrl || block?.coffee?.coverUrl,
            supportersLabel:
              finalMeta.statsLabel ||
              coffeeData?.supportersLabel ||
              block?.coffee?.supportersLabel,
            buttonLabel:
              finalMeta.ctaLabel ||
              coffeeData?.buttonLabel ||
              block?.coffee?.buttonLabel ||
              'Support with a Coffee',
          }
        : undefined;

    setIsSaving(true);
    try {
      await onSave({
        url: finalUrl,
        title: finalTitle,
        provider,
        embedMeta: finalMeta,
        youtubeData,
        coffeeData: finalCoffeeData,
        schedule: { startAt, endAt },
      });
      uncommittedBannerUrlsRef.current.clear();
      setIsDirty(false);
    } catch (err: any) {
      setSaveError(err?.message || "Couldn't save changes. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const cleanupUncommittedAndClose = () => {
    const urlsToDelete = Array.from(uncommittedBannerUrlsRef.current).filter(
      (u) =>
        u !== block?.embedMeta?.banner?.imageUrl &&
        u !== block?.embedMeta?.banner?.smallImageUrl
    );
    if (urlsToDelete.length > 0) {
      void deleteCardBannersFromServer({
        urls: urlsToDelete,
        username: session.username,
        userId: session.userId,
        primaryEmail: session.primaryEmail,
      });
    }
    uncommittedBannerUrlsRef.current.clear();
    onClose();
  };

  const requestClose = () => {
    if (isDirty && !confirmDiscard) {
      setConfirmDiscard(true);
    } else {
      cleanupUncommittedAndClose();
    }
  };

  const modalTitle = `${isEditing ? 'Edit' : 'Add'} ${providerDef.name} ${
    displayAs === 'player' ? 'player' : 'card'
  }`;

  const previewStageContent = (
    <div
      className="w-full rounded-[14px] border border-border p-4 flex flex-col justify-center min-h-[140px] transition-colors"
      style={{
        backgroundColor: activeVibe.tokens.bg,
        fontFamily: getFontCssFamily(session.fontSettings?.buttonFont, activeVibe.fontFamily),
      }}
    >
      {urlInput.trim() || meta.override?.title || meta.title ? (
        provider === 'coffee' ? (
          <CoffeeCardBlock
            block={previewBlock}
            vibe={activeVibe}
            effectiveRadius={effectiveRadius}
            embedMode="placeholder"
            fontFamily={getFontCssFamily(session.fontSettings?.buttonFont, activeVibe.fontFamily)}
            pageCardLook={pageCardLook}
            background={session.background}
            userAvatarUrl={session.imageUrl}
            userDisplayName={session.displayName}
            surfaceStyle={{
              backgroundColor: effectiveTokens.buttonBg,
              color: effectiveTokens.buttonText,
              borderColor: effectiveTokens.buttonBorder,
            }}
          />
        ) : (
          <EmbedBlock
            block={previewBlock}
            vibe={activeVibe}
            effectiveRadius={effectiveRadius}
            embedMode="placeholder"
            activeEmbedId={null}
            onActivate={() => {}}
            fontFamily={getFontCssFamily(session.fontSettings?.buttonFont, activeVibe.fontFamily)}
            pageCardLook={pageCardLook}
            background={session.background}
            userAvatarUrl={session.imageUrl}
            userDisplayName={session.displayName}
            surfaceStyle={{
              backgroundColor: effectiveTokens.buttonBg,
              color: effectiveTokens.buttonText,
              borderColor: effectiveTokens.buttonBorder,
            }}
          />
        )
      ) : (
        <div
          className="w-full py-6 px-4 rounded-[12px] border border-dashed text-center text-[13px]"
          style={{
            borderColor: effectiveTokens.buttonBorder || 'rgba(128,128,128,0.28)',
            color: effectiveTokens.muted,
          }}
        >
          Paste a link or @username to see your card
        </div>
      )}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/45 backdrop-blur-[2px] lg:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={modalTitle}
        onClick={(e) => e.stopPropagation()}
        className="w-full lg:max-w-4xl bg-surface border border-border rounded-t-[20px] lg:rounded-[20px] shadow-[var(--shadow-lg)] flex flex-col h-[92dvh] lg:h-auto lg:max-h-[88vh] overflow-hidden"
      >
        {/* Mobile grab handle */}
        <div className="lg:hidden flex justify-center pt-2.5 pb-1 shrink-0" aria-hidden="true">
          <span className="w-9 h-1 rounded-full bg-border-strong" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-divider flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
              style={{
                backgroundColor:
                  providerDef.brandColor === '#FFFC00'
                    ? 'rgba(255, 252, 0, 0.35)'
                    : providerDef.brandColor === '#FFDD00'
                      ? 'rgba(255, 221, 0, 0.35)'
                      : `${providerDef.brandColor}16`,
                color:
                  providerDef.brandColor === '#000000' ||
                  providerDef.brandColor === '#FFFC00' ||
                  providerDef.brandColor === '#FFDD00'
                    ? '#0A0A0A'
                    : providerDef.brandColor,
              }}
            >
              <ProviderGlyph provider={provider} size={18} />
            </div>
            <h2 className="text-[17px] sm:text-[18px] font-semibold text-ink truncate">
              {modalTitle}
            </h2>
          </div>

          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Unsaved discard confirmation bar */}
        {confirmDiscard && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3 text-[13px] shrink-0">
            <span className="font-medium text-ink">Discard unsaved changes?</span>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDiscard(false)}
              >
                Keep editing
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={cleanupUncommittedAndClose}>
                Discard
              </Button>
            </div>
          </div>
        )}

        {/* Mobile collapsible pinned live preview (<lg) */}
        <div className="lg:hidden border-b border-divider bg-surface-2/50 px-5 py-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setMobilePreviewExpanded((v) => !v)}
            className="w-full flex items-center justify-between text-[12px] font-medium text-muted hover:text-ink cursor-pointer py-0.5"
          >
            <span>Live preview</span>
            <span className="inline-flex items-center gap-1">
              <span>{mobilePreviewExpanded ? 'Hide' : 'Show'}</span>
              <ChevronDown
                size={14}
                className={`transition-transform ${mobilePreviewExpanded ? 'rotate-180' : ''}`}
              />
            </span>
          </button>
          {mobilePreviewExpanded && (
            <div className="mt-2 max-h-[210px] overflow-y-auto">{previewStageContent}</div>
          )}
        </div>

        {/* Body: 1 column on mobile, 2 columns on desktop */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
            {/* LEFT FORM COLUMN */}
            <div className="flex flex-col gap-5 pb-4">
              {/* 1. Source */}
              <section className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="platform-link-input" className="text-[14px] font-semibold text-ink">
                    {kindDef.contentKind === 'profile' ? 'Profile link or username' : 'Link'}
                  </label>
                  <div className="flex items-center gap-2">
                    {detectedCurrent && (
                      <span className="px-2 py-0.5 rounded-[6px] bg-surface-2 border border-border text-[11px] font-medium text-muted">
                        {kindDef.label}
                      </span>
                    )}
                    {urlInput.trim() && detectedCurrent && (
                      <button
                        type="button"
                        onClick={() => void runLookup(urlInput, true)}
                        disabled={isLookingUp}
                        aria-label="Refresh link details"
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={isLookingUp ? 'animate-spin' : ''} />
                        <span>Refresh</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <input
                    id="platform-link-input"
                    ref={linkInputRef}
                    type="text"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setIsDirty(true);
                    }}
                    placeholder={
                      kindDef.contentKind === 'profile'
                        ? `@username, username, or ${kindDef.placeholder}`
                        : kindDef.placeholder
                    }
                    className="w-full h-11 min-h-[44px] px-3.5 pr-10 bg-surface border border-border rounded-[12px] text-[14px] text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-ink"
                  />
                  {isLookingUp && (
                    <Loader2
                      size={16}
                      className="animate-spin text-muted absolute right-3.5 top-1/2 -translate-y-1/2"
                    />
                  )}
                </div>

                {urlError && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[color:var(--error,#B3261E)]">
                    <span className="inline-flex items-center gap-1.5">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{urlError}</span>
                    </span>
                    {mismatchHint && (
                      <button
                        type="button"
                        onClick={() => handleSwitchDetectedProvider(mismatchHint)}
                        className="font-semibold text-ink underline underline-offset-2 cursor-pointer"
                      >
                        Switch to {mismatchHint.name}
                      </button>
                    )}
                  </div>
                )}

                {providerDef.supportsOAuth && (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    {meta.connectedViaOAuth ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[12px] font-medium ${
                            meta.needsAttention
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          <CheckCircle2 size={12} />
                          <span>{meta.needsAttention ? 'Needs reconnecting' : 'Connected'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleConnectAccount}
                          disabled={isConnecting}
                          className="text-[12px] font-medium text-muted hover:text-ink underline underline-offset-2 cursor-pointer"
                        >
                          Reconnect
                        </button>
                        <button
                          type="button"
                          onClick={handleDisconnectAccount}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink cursor-pointer"
                        >
                          <Unplug size={12} />
                          <span>Disconnect</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="text-[12px] text-muted truncate">
                          {providerDef.oauthCopy || `Connect ${providerDef.name} to load profile details.`}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleConnectAccount}
                          disabled={isConnecting}
                          className="shrink-0 text-ink"
                        >
                          {isConnecting ? (
                            <>
                              <Loader2 size={13} className="animate-spin mr-1" />
                              <span>Connecting...</span>
                            </>
                          ) : (
                            'Connect account'
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* 2. Display As (only when platform & kind support both Card & Player) */}
              {canChooseDisplayMode && (
                <section className="flex flex-col gap-2 pt-4 border-t border-divider">
                  <span className="text-[14px] font-semibold text-ink">Display as</span>
                  <SegmentedControl<DisplayAsMode>
                    options={[
                      { value: 'card', label: 'Card' },
                      { value: 'player', label: 'Player' },
                    ]}
                    value={displayAs}
                    onChange={(next) => updateMeta({ displayAs: next })}
                    ariaLabel="Display as"
                  />
                </section>
              )}

              {/* 3. Content (collapsed out of main add-flow for social profiles except Buy Me a Coffee) */}
              {(isEditing || !isSocialProfileFlow || provider === 'coffee') && (
              <section className="flex flex-col gap-3.5 pt-4 border-t border-divider">
                <h3 className="text-[14px] font-semibold text-ink">Content</h3>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="platform-title-input" className="text-[13px] font-medium text-ink">
                      Title
                    </label>
                    <span className="text-[11px] text-muted tabular-nums">
                      {titleInput.length}/60
                    </span>
                  </div>
                  <input
                    id="platform-title-input"
                    type="text"
                    maxLength={60}
                    value={titleInput}
                    onChange={(e) => {
                      setTitleInput(e.target.value);
                      setTitleManuallyEdited(e.target.value.trim().length > 0);
                      setIsDirty(true);
                    }}
                    placeholder={meta.title || kindDef.label}
                    className="w-full h-11 min-h-[44px] px-3.5 bg-surface border border-border rounded-[12px] text-[14px] text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-ink"
                  />
                </div>

                {displayAs === 'card' && (
                  <>
                    {kindDef.capabilities.summary && (
                      <div className="flex items-center justify-between gap-3 py-1">
                        <span className="text-[14px] text-ink">Show summary</span>
                        <Toggle
                          checked={meta.showDescription !== false}
                          onChange={() => updateMeta({ showDescription: meta.showDescription === false })}
                          ariaLabel="Show summary"
                        />
                      </div>
                    )}

                    {kindDef.capabilities.stats && (
                      <div className="flex items-center justify-between gap-3 py-1">
                        <span className="text-[14px] text-ink">Show stats</span>
                        <Toggle
                          checked={meta.showStats !== false}
                          onChange={() => updateMeta({ showStats: meta.showStats === false })}
                          ariaLabel="Show stats"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="platform-btn-text" className="text-[13px] font-medium text-ink">
                          Button text
                        </label>
                        <span className="text-[11px] text-muted tabular-nums">
                          {(meta.ctaLabel || '').length}/24
                        </span>
                      </div>
                      <input
                        id="platform-btn-text"
                        type="text"
                        maxLength={24}
                        value={meta.ctaLabel || ''}
                        onChange={(e) => updateMeta({ ctaLabel: e.target.value })}
                        placeholder={kindDef.defaultButtonText}
                        className="w-full h-11 min-h-[44px] px-3.5 bg-surface border border-border rounded-[12px] text-[14px] text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-ink"
                      />
                    </div>
                  </>
                )}
              </section>
              )}

              {/* 4. Look (when Card) OR Size (when Player) */}
              {displayAs === 'card' ? (
                <section className="flex flex-col gap-2.5 pt-4 border-t border-divider">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[14px] font-semibold text-ink">Look</h3>
                    {!isUsingPageDefaultLook && (
                      <button
                        type="button"
                        onClick={() => updateMeta({ lookStyle: undefined })}
                        className="text-[12px] font-medium text-muted hover:text-ink underline underline-offset-2 cursor-pointer"
                      >
                        Use page default
                      </button>
                    )}
                  </div>

                  <CardLookTileGrid
                    value={effectiveLook}
                    onChange={(nextLook) => updateMeta({ lookStyle: nextLook })}
                    brandColor={providerDef.brandColor}
                    pageBg={activeVibe.tokens.bg}
                    pageSurface={effectiveTokens.buttonBg}
                    pageText={effectiveTokens.buttonText}
                    pageBorder={effectiveTokens.buttonBorder}
                    pageAccent={effectiveTokens.buttonBg}
                  />

                  <p className="text-[12px] text-muted leading-snug">
                    {activeLookOption.description}
                    {isUsingPageDefaultLook ? ' (Using page default)' : ''}
                  </p>

                  {effectiveLook === 'glass' && isPlainBackground && (
                    <p className="text-[12px] text-muted">
                      Glass looks best over a photo or gradient background.
                    </p>
                  )}

                  {providerDef.restrictions?.restrictionReason && (
                    <p className="text-[12px] text-muted">
                      {providerDef.restrictions.restrictionReason}.
                    </p>
                  )}

                  {effectiveLook === 'banner' && (
                    <BannerImageControls
                      banner={meta.banner}
                      onChangeBanner={(nextBanner) => updateMeta({ banner: nextBanner })}
                      onUploadingChange={setIsBannerUploading}
                      onTrackUncommittedUrl={(url, smallUrl) => {
                        if (url) uncommittedBannerUrlsRef.current.add(url);
                        if (smallUrl) uncommittedBannerUrlsRef.current.add(smallUrl);
                      }}
                      onDeleteServerUrls={(urls) => {
                        urls.forEach((u) => uncommittedBannerUrlsRef.current.delete(u));
                        const toDeleteNow = urls.filter(
                          (u) =>
                            u !== block?.embedMeta?.banner?.imageUrl &&
                            u !== block?.embedMeta?.banner?.smallImageUrl
                        );
                        if (toDeleteNow.length > 0) {
                          void deleteCardBannersFromServer({
                            urls: toDeleteNow,
                            username: session.username,
                            userId: session.userId,
                            primaryEmail: session.primaryEmail,
                          });
                        }
                      }}
                      username={session.username}
                      userId={session.userId}
                      primaryEmail={session.primaryEmail}
                      provider={provider}
                      providerName={providerDef.name}
                      brandColor={providerDef.brandColor}
                      meta={meta}
                      title={titleInput.trim() || meta.override?.title?.trim() || meta.title || kindDef.label}
                      subtitle={meta.override?.subtitle?.trim() || meta.handle || meta.subtitle || null}
                      userAvatarUrl={session.imageUrl}
                      userDisplayName={session.displayName}
                      cardSurfaceHex={effectiveTokens.buttonBg}
                      cardTextColor={effectiveTokens.buttonText}
                      cardMutedColor={effectiveTokens.muted}
                      cardBorderColor={effectiveTokens.buttonBorder || 'rgba(128,128,128,0.22)'}
                      platformGlyph={<ProviderGlyph provider={provider} size={12} />}
                    />
                  )}
                </section>
              ) : (
                providerDef.playerSizes &&
                providerDef.playerSizes.length > 0 && (
                  <section className="flex flex-col gap-2 pt-4 border-t border-divider">
                    <span className="text-[14px] font-semibold text-ink">Player size</span>
                    <SegmentedControl<PlayerSize>
                      options={providerDef.playerSizes.map((sz) => ({
                        value: sz,
                        label: sz.charAt(0).toUpperCase() + sz.slice(1),
                      }))}
                      value={
                        (meta.playerSize as PlayerSize) ||
                        providerDef.defaultPlayerSize ||
                        'standard'
                      }
                      onChange={(nextSize) => updateMeta({ playerSize: nextSize })}
                      ariaLabel="Player size"
                    />
                  </section>
                )
              )}

              {/* 5. More options */}
              {(isEditing || !isSocialProfileFlow || provider === 'coffee') && (
              <section className="pt-4 border-t border-divider">
                <button
                  type="button"
                  aria-expanded={isMoreOpen}
                  onClick={() => setIsMoreOpen((v) => !v)}
                  className="w-full min-h-[44px] flex items-center justify-between gap-2 text-left cursor-pointer group"
                >
                  <div className="min-w-0">
                    <span className="text-[14px] font-semibold text-ink block">
                      More options
                    </span>
                    <span className="text-[12px] text-muted truncate block">
                      {activeOverridesSummary}
                    </span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-muted group-hover:text-ink transition-transform shrink-0 ${
                      isMoreOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isMoreOpen && (
                  <div className="pt-3 flex flex-col gap-4">
                    {lookupFailed && (
                      <div className="p-3 rounded-[12px] bg-surface-2 border border-border text-[12px] text-muted leading-snug">
                        We couldn&apos;t load details from {providerDef.name}. Your card will use what you enter below.
                      </div>
                    )}

                    {displayAs === 'card' && (
                      <>
                        {/* Accent */}
                        <div className="flex flex-col gap-2">
                          <span className="text-[13px] font-medium text-ink">Accent color</span>
                          <SegmentedControl<CardAccentMode>
                            options={[
                              { value: 'brand', label: 'Brand' },
                              { value: 'page', label: 'Page' },
                              { value: 'custom', label: 'Custom' },
                            ]}
                            value={
                              (meta.accentMode as CardAccentMode) ||
                              (effectiveLook === 'match_page' ? 'page' : 'brand')
                            }
                            onChange={(nextAccent) => updateMeta({ accentMode: nextAccent })}
                            ariaLabel="Accent color"
                          />
                          {meta.accentMode === 'custom' && (
                            <div className="flex items-center gap-2.5 pt-1">
                              <input
                                type="color"
                                aria-label="Pick accent color"
                                value={meta.accentColor || providerDef.brandColor}
                                onChange={(e) => updateMeta({ accentColor: e.target.value.toUpperCase() })}
                                className="w-11 h-11 rounded-[10px] border border-border bg-surface p-1 cursor-pointer"
                              />
                              <input
                                type="text"
                                aria-label="Accent hex code"
                                value={meta.accentColor || providerDef.brandColor}
                                onChange={(e) => updateMeta({ accentColor: e.target.value })}
                                maxLength={7}
                                className="h-11 px-3 bg-surface border border-border rounded-[10px] text-[13px] font-mono text-ink w-32"
                              />
                            </div>
                          )}
                        </div>

                        {/* Corners */}
                        <div className="flex flex-col gap-2">
                          <span className="text-[13px] font-medium text-ink">Corners</span>
                          <SegmentedControl<CardCornerMode>
                            options={[
                              { value: 'page', label: 'Page' },
                              { value: 'sharp', label: 'Sharp' },
                              { value: 'rounded', label: 'Rounded' },
                              { value: 'pill', label: 'Pill' },
                            ]}
                            value={(meta.corners as CardCornerMode) || 'page'}
                            onChange={(nextCorners) => updateMeta({ corners: nextCorners })}
                            ariaLabel="Corners"
                          />
                        </div>

                        {/* Toggles */}
                        <div className="flex items-center justify-between gap-3 py-1">
                          <span className="text-[14px] text-ink">
                            {kindDef.contentKind === 'item' ? 'Show artwork' : 'Show avatar'}
                          </span>
                          <Toggle
                            checked={meta.showAvatar !== false}
                            onChange={() => updateMeta({ showAvatar: meta.showAvatar === false })}
                            ariaLabel={kindDef.contentKind === 'item' ? 'Show artwork' : 'Show avatar'}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-3 py-1">
                          <span className="text-[14px] text-ink">Show platform label</span>
                          <Toggle
                            checked={meta.showPlatformLabel !== false}
                            onChange={() => updateMeta({ showPlatformLabel: meta.showPlatformLabel === false })}
                            ariaLabel="Show platform label"
                          />
                        </div>

                        {/* Button style */}
                        <div className="flex flex-col gap-2">
                          <span className="text-[13px] font-medium text-ink">Button style</span>
                          <SegmentedControl<CardButtonStyle>
                            options={[
                              { value: 'filled', label: 'Filled' },
                              { value: 'outline', label: 'Outline' },
                              { value: 'text', label: 'Text' },
                              { value: 'hidden', label: 'Hidden' },
                            ]}
                            value={
                              (meta.buttonStyle as CardButtonStyle) ||
                              (effectiveLook === 'match_page'
                                ? 'text'
                                : effectiveLook === 'glass'
                                  ? 'outline'
                                  : 'filled')
                            }
                            onChange={(nextBtnStyle) => updateMeta({ buttonStyle: nextBtnStyle })}
                            ariaLabel="Button style"
                          />
                        </div>
                      </>
                    )}

                    {/* Override details */}
                    <div className="flex flex-col gap-3 pt-3 border-t border-divider">
                      <span className="text-[13px] font-semibold text-ink">Override details</span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label htmlFor="override-name" className="text-[12px] font-medium text-muted">
                            Name
                          </label>
                          <input
                            id="override-name"
                            type="text"
                            maxLength={60}
                            value={meta.override?.title || ''}
                            onChange={(e) => updateOverride({ title: e.target.value })}
                            placeholder={meta.title || titleInput || kindDef.label}
                            className="h-11 px-3 bg-surface border border-border rounded-[10px] text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                          />
                        </div>

                        {kindDef.capabilities.handle && (
                          <div className="flex flex-col gap-1">
                            <label htmlFor="override-handle" className="text-[12px] font-medium text-muted">
                              Handle
                            </label>
                            <input
                              id="override-handle"
                              type="text"
                              maxLength={60}
                              value={meta.override?.subtitle || ''}
                              onChange={(e) => updateOverride({ subtitle: e.target.value })}
                              placeholder={meta.handle || '@username'}
                              className="h-11 px-3 bg-surface border border-border rounded-[10px] text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <label htmlFor="override-image" className="text-[12px] font-medium text-muted">
                          Image URL
                        </label>
                        <input
                          id="override-image"
                          type="url"
                          value={meta.override?.imageUrl || ''}
                          onChange={(e) => updateOverride({ imageUrl: e.target.value })}
                          placeholder="https://..."
                          className="h-11 px-3 bg-surface border border-border rounded-[10px] text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
                        />
                      </div>

                      {kindDef.capabilities.summary && (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <label htmlFor="override-summary" className="text-[12px] font-medium text-muted">
                              Summary
                            </label>
                            <span className="text-[11px] text-muted tabular-nums">
                              {(meta.override?.description || '').length}/160
                            </span>
                          </div>
                          <textarea
                            id="override-summary"
                            rows={2}
                            maxLength={160}
                            value={meta.override?.description || ''}
                            onChange={(e) => updateOverride({ description: e.target.value })}
                            placeholder={meta.description || 'Short line shown inside the card'}
                            className="p-3 bg-surface border border-border rounded-[10px] text-[13px] text-ink resize-none focus-visible:outline-2 focus-visible:outline-ink"
                          />
                        </div>
                      )}
                    </div>

                    {/* Schedule */}
                    <ScheduleSection
                      isPro={isPro}
                      startAt={startAt}
                      endAt={endAt}
                      onChange={(s, e) => {
                        setStartAt(s);
                        setEndAt(e);
                        setIsDirty(true);
                      }}
                      onClearScheduleImmediate={async () => {
                        setStartAt(null);
                        setEndAt(null);
                        await onClearScheduleImmediate?.();
                      }}
                    />

                    <div className="pt-1 flex justify-start">
                      <button
                        type="button"
                        onClick={handleResetDefaults}
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-ink underline underline-offset-2 cursor-pointer py-1"
                      >
                        <RotateCcw size={12} />
                        <span>Reset to defaults</span>
                      </button>
                    </div>
                  </div>
                )}
              </section>
              )}
            </div>

            {/* DESKTOP STICKY RIGHT PREVIEW COLUMN (lg+) */}
            <aside className="hidden lg:block">
              <div className="sticky top-0 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-[12px] font-medium text-muted px-0.5">
                  <span>Live preview</span>
                  <span>{displayAs === 'player' ? 'Player' : activeLookOption.label}</span>
                </div>
                {previewStageContent}
              </div>
            </aside>
          </div>

          {saveError && (
            <div className="px-5 py-2 border-t border-divider bg-red-50/70 text-[13px] text-[color:var(--error,#B3261E)] font-medium shrink-0">
              {saveError}
            </div>
          )}

          {/* Sticky Footer */}
          <div className="px-5 py-3.5 border-t border-divider bg-surface flex items-center justify-end gap-2.5 shrink-0 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))]">
            <Button type="button" variant="ghost" size="md" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!canSubmit}
              className="min-w-[128px]"
            >
              {isSaving ? (
                <>
                  <Loader2 size={15} className="animate-spin mr-1.5" />
                  <span>Saving...</span>
                </>
              ) : isEditing ? (
                'Save changes'
              ) : (
                `Add ${displayAs === 'player' ? 'player' : 'card'}`
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
