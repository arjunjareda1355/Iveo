import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getEmbedLookOptions,
  normalizeEmbedLookStyle,
  getDefaultEmbedCtaLabel,
  isSocialEmbedProvider,
} from './embedLooks.ts';
import type { EmbedProvider } from '../data/types.ts';

describe('embedLooks helpers', () => {
  const providers: EmbedProvider[] = [
    'discord',
    'github',
    'linkedin',
    'x',
    'youtube',
    'spotify',
    'soundcloud',
  ];

  it('provides 5 bespoke look options for every embed provider', () => {
    const signatureLabels = new Set<string>();
    for (const provider of providers) {
      const options = getEmbedLookOptions(provider);
      assert.equal(options.length, 5);
      assert.deepEqual(
        options.map((o) => o.id),
        ['signature', 'spotlight', 'glass', 'minimal', 'theme']
      );
      signatureLabels.add(options[0].label);
    }
    // Every provider has a distinct signature look label tailored to its brand
    assert.equal(signatureLabels.size, providers.length);
  });

  it('normalizes embed look styles with safe fallback', () => {
    assert.equal(normalizeEmbedLookStyle('spotlight'), 'spotlight');
    assert.equal(normalizeEmbedLookStyle('glass'), 'glass');
    assert.equal(normalizeEmbedLookStyle('invalid', 'minimal'), 'minimal');
    assert.equal(normalizeEmbedLookStyle(undefined), 'signature');
  });

  it('distinguishes social account embeds from playable media embeds', () => {
    assert.equal(isSocialEmbedProvider('discord'), true);
    assert.equal(isSocialEmbedProvider('github'), true);
    assert.equal(isSocialEmbedProvider('linkedin'), true);
    assert.equal(isSocialEmbedProvider('x'), true);
    assert.equal(isSocialEmbedProvider('youtube'), false);
    assert.equal(isSocialEmbedProvider('spotify'), false);
    assert.equal(isSocialEmbedProvider('soundcloud'), false);
    assert.equal(isSocialEmbedProvider(null), false);
  });

  it('returns tailored default CTA labels per provider and subtype', () => {
    assert.equal(getDefaultEmbedCtaLabel('discord', 'server'), 'Join Server');
    assert.equal(getDefaultEmbedCtaLabel('discord', 'user'), 'Add on Discord');
    assert.equal(getDefaultEmbedCtaLabel('github', 'repo'), 'View Repo');
    assert.equal(getDefaultEmbedCtaLabel('github', 'profile'), 'View on GitHub');
    assert.equal(getDefaultEmbedCtaLabel('linkedin', 'company'), 'View Page');
    assert.equal(getDefaultEmbedCtaLabel('x', 'post'), 'Read Post');
    assert.equal(getDefaultEmbedCtaLabel('x', 'profile'), 'Follow on X');
    assert.equal(getDefaultEmbedCtaLabel('youtube'), 'Play');
  });
});
