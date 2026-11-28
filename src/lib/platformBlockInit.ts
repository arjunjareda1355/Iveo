import type { Block, CoffeeData, EmbedMetaData, EmbedProvider } from '../data/types.ts';
import { normalizeEmbedLookStyle } from './embedLooks.ts';
import {
  detectProviderUrl,
  getProviderDefinition,
  getProviderKindDefinition,
} from './providers/index.ts';

export function deriveInitialFromBlock(
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
    const existingMeta = block.embedMeta;
    const detected = block.url ? detectProviderUrl(block.url) : null;
    const subtype = existingMeta?.subtype || detected?.subtype || 'channel';
    const def = getProviderDefinition('youtube');
    const kindDef = getProviderKindDefinition('youtube', subtype);
    return {
      provider: 'youtube',
      url: block.url || '',
      title: block.title || existingMeta?.override?.title || existingMeta?.title || yt?.channelTitle || '',
      meta: {
        ...(existingMeta || { provider: 'youtube' }),
        provider: 'youtube',
        subtype,
        title: existingMeta?.title || yt?.channelTitle || block.title || null,
        subtitle: existingMeta?.subtitle || yt?.handle || block.badge || null,
        handle: existingMeta?.handle || yt?.handle || null,
        description: existingMeta?.description || yt?.description || null,
        avatarUrl: existingMeta?.avatarUrl || yt?.avatarUrl || null,
        statsLabel: existingMeta?.statsLabel || yt?.subscriberText || null,
        ctaLabel: existingMeta?.ctaLabel || yt?.buttonLabel || 'Subscribe',
        lookStyle: existingMeta?.lookStyle
          ? normalizeEmbedLookStyle(existingMeta.lookStyle, 'match_page')
          : undefined,
        displayAs:
          existingMeta?.displayAs ||
          (subtype === 'video' || subtype === 'playlist'
            ? 'player'
            : kindDef.capabilities.player
              ? def.defaultDisplayMode
              : 'card'),
        playerSize: existingMeta?.playerSize || def.defaultPlayerSize || 'standard',
        showAvatar: existingMeta?.showAvatar ?? true,
        showDescription: existingMeta?.showDescription ?? true,
        showStats: existingMeta?.showStats ?? true,
        showPlatformLabel: existingMeta?.showPlatformLabel ?? true,
        connectedViaOAuth: Boolean(existingMeta?.connectedViaOAuth ?? yt?.connectedViaOAuth),
        fetchedAt: existingMeta?.fetchedAt || yt?.fetchedAt || null,
      },
      coffeeData: null,
      startAt: block.startAt || null,
      endAt: block.endAt || null,
    };
  }

  // Legacy Instagram card block compatibility
  if (block.kind === 'instagram') {
    const existingMeta = block.embedMeta;
    const detected = block.url ? detectProviderUrl(block.url) : null;
    const subtype = existingMeta?.subtype || detected?.subtype || 'profile';
    return {
      provider: 'instagram',
      url: block.url || '',
      title: block.title || existingMeta?.override?.title || existingMeta?.title || '',
      meta: {
        ...(existingMeta || { provider: 'instagram' }),
        provider: 'instagram',
        subtype,
        title: existingMeta?.title || block.title || null,
        subtitle: existingMeta?.subtitle || block.badge || null,
        ctaLabel: existingMeta?.ctaLabel || 'Follow',
        lookStyle: existingMeta?.lookStyle
          ? normalizeEmbedLookStyle(existingMeta.lookStyle, 'match_page')
          : undefined,
        displayAs: existingMeta?.displayAs || 'card',
        showAvatar: existingMeta?.showAvatar ?? true,
        showDescription: existingMeta?.showDescription ?? true,
        showStats: existingMeta?.showStats ?? false,
        showPlatformLabel: existingMeta?.showPlatformLabel ?? true,
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
