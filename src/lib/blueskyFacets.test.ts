import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBlueskyActorInput,
  validateBlueskyActor,
  parseBlueskyPostInput,
  sliceBlueskyTextByFacets,
  buildBlueskyPostWebUrl,
} from './blueskyFacets.ts';

test('normalizeBlueskyActorInput accepts handles, @handles, custom domains, profile URLs, and DIDs', () => {
  assert.equal(normalizeBlueskyActorInput('alice.bsky.social'), 'alice.bsky.social');
  assert.equal(normalizeBlueskyActorInput('@Alice.Bsky.Social'), 'alice.bsky.social');
  assert.equal(normalizeBlueskyActorInput('alice.com'), 'alice.com');
  assert.equal(normalizeBlueskyActorInput('https://bsky.app/profile/alice.bsky.social'), 'alice.bsky.social');
  assert.equal(normalizeBlueskyActorInput('did:plc:ewvi7nxzyoun6zhxrhs64oiz'), 'did:plc:ewvi7nxzyoun6zhxrhs64oiz');
});

test('validateBlueskyActor rejects spaces and invalid domain strings', () => {
  assert.equal(validateBlueskyActor('alice bsky').valid, false);
  assert.equal(validateBlueskyActor('singleword').valid, false);
  assert.equal(validateBlueskyActor('alice.com').valid, true);
  assert.equal(validateBlueskyActor('did:plc:ewvi7nxzyoun6zhxrhs64oiz').kind, 'did');
});

test('parseBlueskyPostInput accepts bsky.app post URL and at:// URI', () => {
  const fromUrl = parseBlueskyPostInput('https://bsky.app/profile/alice.bsky.social/post/3kabcdef1234');
  assert.equal(fromUrl.valid, true);
  if (fromUrl.valid && 'actor' in fromUrl) {
    assert.equal(fromUrl.actor, 'alice.bsky.social');
    assert.equal(fromUrl.rkey, '3kabcdef1234');
  }

  const fromAt = parseBlueskyPostInput('at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.feed.post/3kabcdef1234');
  assert.equal(fromAt.valid, true);
  if (fromAt.valid && 'uri' in fromAt) {
    assert.equal(fromAt.uri, 'at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.feed.post/3kabcdef1234');
  }

  assert.equal(parseBlueskyPostInput('https://evil.com/post/123').valid, false);
});

test('sliceBlueskyTextByFacets slices UTF-8 byte offsets accurately with multi-byte emojis and links', () => {
  const text = '🚀 Launch @bob.bsky.social at https://iveo.site #indie';
  const enc = new TextEncoder();
  const fullBytes = enc.encode(text);

  const mentionText = '@bob.bsky.social';
  const linkText = 'https://iveo.site';
  const tagText = '#indie';

  const byteStartMention = enc.encode('🚀 Launch ').byteLength;
  const byteEndMention = byteStartMention + enc.encode(mentionText).byteLength;

  const byteStartLink = enc.encode('🚀 Launch @bob.bsky.social at ').byteLength;
  const byteEndLink = byteStartLink + enc.encode(linkText).byteLength;

  const byteStartTag = fullBytes.byteLength - enc.encode(tagText).byteLength;
  const byteEndTag = fullBytes.byteLength;

  const segments = sliceBlueskyTextByFacets(text, [
    {
      index: { byteStart: byteStartMention, byteEnd: byteEndMention },
      features: [{ $type: 'app.bsky.richtext.facet#mention', did: 'did:plc:ewvi7nxzyoun6zhxrhs64oiz' }],
    },
    {
      index: { byteStart: byteStartLink, byteEnd: byteEndLink },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://iveo.site' }],
    },
    {
      index: { byteStart: byteStartTag, byteEnd: byteEndTag },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: 'indie' }],
    },
  ]);

  assert.equal(segments.length, 6);
  assert.deepEqual(segments[0], { kind: 'text', text: '🚀 Launch ' });
  assert.deepEqual(segments[1], {
    kind: 'mention',
    text: '@bob.bsky.social',
    did: 'did:plc:ewvi7nxzyoun6zhxrhs64oiz',
    href: 'https://bsky.app/profile/did%3Aplc%3Aewvi7nxzyoun6zhxrhs64oiz',
  });
  assert.deepEqual(segments[3], { kind: 'link', text: 'https://iveo.site', href: 'https://iveo.site' });
  assert.deepEqual(segments[5], {
    kind: 'tag',
    text: '#indie',
    tag: 'indie',
    href: 'https://bsky.app/hashtag/indie',
  });
});

test('buildBlueskyPostWebUrl maps at:// URI to bsky.app post link', () => {
  assert.equal(
    buildBlueskyPostWebUrl('alice.bsky.social', 'at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.feed.post/3kxyz'),
    'https://bsky.app/profile/alice.bsky.social/post/3kxyz'
  );
});
