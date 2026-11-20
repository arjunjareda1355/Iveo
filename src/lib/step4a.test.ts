import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEmbedUrl } from './embeds.ts';
import { getScheduleState, isBlockVisibleNow, formatScheduleTime } from './time.ts';
import { pageUrl, SITE_ORIGIN } from './site.ts';
import { PRO_FEATURES, getProFeatureName } from './plan.ts';

// 1. YouTube embeds
test('embeds: parses valid YouTube links correctly', () => {
  const watchUrl = parseEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.notEqual(watchUrl, null);
  assert.equal(watchUrl?.provider, 'youtube');
  assert.equal(watchUrl?.canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(
    watchUrl?.embedSrc,
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1'
  );
  assert.equal(watchUrl?.aspect, '16 / 9');

  const shortUrl = parseEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=42');
  assert.notEqual(shortUrl, null);
  assert.equal(shortUrl?.canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s');
  assert.equal(
    shortUrl?.embedSrc,
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1&start=42'
  );

  const shortsUrl = parseEmbedUrl('https://m.youtube.com/shorts/dQw4w9WgXcQ');
  assert.notEqual(shortsUrl, null);
  assert.equal(shortsUrl?.canonicalUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('embeds: rejects invalid YouTube links', () => {
  assert.equal(parseEmbedUrl('https://www.youtube.com/playlist?list=PL12345'), null);
  assert.equal(parseEmbedUrl('https://www.youtube.com/@channel'), null);
  assert.equal(parseEmbedUrl('https://vimeo.com/12345678'), null);
});

// 2. Spotify embeds
test('embeds: parses valid Spotify links correctly', () => {
  const track = parseEmbedUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
  assert.notEqual(track, null);
  assert.equal(track?.provider, 'spotify');
  assert.equal(track?.height, 152);
  assert.equal(track?.canonicalUrl, 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
  assert.equal(
    track?.embedSrc,
    'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT?utm_source=generator'
  );

  const album = parseEmbedUrl('https://open.spotify.com/album/4cOdK2wGLETKBW3PvgPWqT');
  assert.notEqual(album, null);
  assert.equal(album?.height, 352);

  const playlistWithLocale = parseEmbedUrl(
    'https://open.spotify.com/intl-de/playlist/4cOdK2wGLETKBW3PvgPWqT'
  );
  assert.notEqual(playlistWithLocale, null);
  assert.equal(playlistWithLocale?.height, 352);
});

test('embeds: rejects invalid Spotify links', () => {
  assert.equal(parseEmbedUrl('spotify:track:4cOdK2wGLETKBW3PvgPWqT'), null);
  assert.equal(parseEmbedUrl('https://spotify.link/shortcode'), null);
  assert.equal(parseEmbedUrl('https://open.spotify.com/user/artistname'), null);
});

// 3. SoundCloud embeds
test('embeds: parses valid SoundCloud links correctly', () => {
  const track = parseEmbedUrl('https://soundcloud.com/artist/cool-track');
  assert.notEqual(track, null);
  assert.equal(track?.provider, 'soundcloud');
  assert.equal(track?.height, 166);
  assert.equal(track?.canonicalUrl, 'https://soundcloud.com/artist/cool-track');

  const set = parseEmbedUrl('https://soundcloud.com/artist/sets/cool-set');
  assert.notEqual(set, null);
  assert.equal(set?.height, 300);
});

test('embeds: rejects invalid SoundCloud links', () => {
  assert.equal(parseEmbedUrl('https://soundcloud.com/artist'), null);
  assert.equal(parseEmbedUrl('https://on.soundcloud.com/xyz123'), null);
  assert.equal(parseEmbedUrl('https://m.soundcloud.com/artist/track'), null);
});

// 3b. Social Embeds (Discord, GitHub, LinkedIn, X)
test('embeds: parses Discord, GitHub, LinkedIn, and X links correctly', () => {
  const discordInvite = parseEmbedUrl('https://discord.gg/iveo');
  assert.equal(discordInvite?.provider, 'discord');
  assert.equal(discordInvite?.subtype, 'invite');
  assert.equal(discordInvite?.identifier, 'iveo');

  const githubRepo = parseEmbedUrl('https://github.com/vercel/next.js');
  assert.equal(githubRepo?.provider, 'github');
  assert.equal(githubRepo?.subtype, 'repo');
  assert.equal(githubRepo?.identifier, 'vercel/next.js');

  const githubUser = parseEmbedUrl('https://github.com/torvalds');
  assert.equal(githubUser?.provider, 'github');
  assert.equal(githubUser?.subtype, 'profile');
  assert.equal(githubUser?.identifier, 'torvalds');

  const linkedinProfile = parseEmbedUrl('https://www.linkedin.com/in/maya-ellis/');
  assert.equal(linkedinProfile?.provider, 'linkedin');
  assert.equal(linkedinProfile?.subtype, 'in');
  assert.equal(linkedinProfile?.identifier, 'maya-ellis');

  const xPost = parseEmbedUrl('https://x.com/iveosite/status/184567890123456');
  assert.equal(xPost?.provider, 'x');
  assert.equal(xPost?.subtype, 'post');

  const xProfile = parseEmbedUrl('https://twitter.com/iveosite');
  assert.equal(xProfile?.provider, 'x');
  assert.equal(xProfile?.subtype, 'profile');
  assert.equal(xProfile?.canonicalUrl, 'https://x.com/iveosite');

  const igProfile = parseEmbedUrl('https://www.instagram.com/iveosite/');
  assert.equal(igProfile?.provider, 'instagram');
  assert.equal(igProfile?.subtype, 'profile');
  assert.equal(igProfile?.identifier, 'iveosite');
  assert.equal(igProfile?.canonicalUrl, 'https://www.instagram.com/iveosite/');

  const igReel = parseEmbedUrl('https://instagram.com/reel/C9abc123XYZ/');
  assert.equal(igReel?.provider, 'instagram');
  assert.equal(igReel?.subtype, 'reel');

  const fbPage = parseEmbedUrl('https://www.facebook.com/meta');
  assert.equal(fbPage?.provider, 'facebook');
  assert.equal(fbPage?.subtype, 'profile');
  assert.equal(fbPage?.identifier, 'meta');

  const fbGroup = parseEmbedUrl('https://www.facebook.com/groups/developers');
  assert.equal(fbGroup?.provider, 'facebook');
  assert.equal(fbGroup?.subtype, 'group');

  const threadsProfile = parseEmbedUrl('https://www.threads.net/@zuck');
  assert.equal(threadsProfile?.provider, 'threads');
  assert.equal(threadsProfile?.subtype, 'profile');
  assert.equal(threadsProfile?.identifier, 'zuck');
  assert.equal(threadsProfile?.canonicalUrl, 'https://www.threads.net/@zuck');

  const threadsPost = parseEmbedUrl('https://threads.com/@zuck/post/C8xyz987');
  assert.equal(threadsPost?.provider, 'threads');
  assert.equal(threadsPost?.subtype, 'post');

  const pinUrl = parseEmbedUrl('https://www.pinterest.com/pin/123456789/');
  assert.equal(pinUrl?.provider, 'pinterest');
  assert.equal(pinUrl?.subtype, 'pin');
  assert.equal(pinUrl?.identifier, '123456789');

  const boardUrl = parseEmbedUrl('https://www.pinterest.com/creator/moodboard/');
  assert.equal(boardUrl?.provider, 'pinterest');
  assert.equal(boardUrl?.subtype, 'board');
  assert.equal(boardUrl?.identifier, 'creator/moodboard');

  const pinProfile = parseEmbedUrl('https://in.pinterest.com/designstudio');
  assert.equal(pinProfile?.provider, 'pinterest');
  assert.equal(pinProfile?.subtype, 'profile');
  assert.equal(pinProfile?.identifier, 'designstudio');

  const pinShort = parseEmbedUrl('https://pin.it/abc123XYZ');
  assert.equal(pinShort?.provider, 'pinterest');
  assert.equal(pinShort?.subtype, 'pin');
});

// 4. Scheduling & Time
test('time: getScheduleState correctly determines state', () => {
  const now = new Date('2026-10-20T12:00:00Z');

  // No schedule
  assert.equal(getScheduleState({}, now), 'none');

  // Upcoming
  assert.equal(
    getScheduleState({ startAt: '2026-10-20T13:00:00Z' }, now),
    'upcoming'
  );

  // Live
  assert.equal(
    getScheduleState(
      { startAt: '2026-10-20T11:00:00Z', endAt: '2026-10-20T14:00:00Z' },
      now
    ),
    'live'
  );

  // Ended
  assert.equal(
    getScheduleState({ endAt: '2026-10-20T11:59:00Z' }, now),
    'ended'
  );
});

test('time: isBlockVisibleNow enforces Pro and scheduling status', () => {
  const now = new Date('2026-10-20T12:00:00Z');

  // Active basic link is visible on Free and Pro
  assert.equal(
    isBlockVisibleNow({ isActive: true, isArchived: false, kind: 'link' }, 'free', now),
    true
  );

  // Embed requires Pro
  assert.equal(
    isBlockVisibleNow({ isActive: true, isArchived: false, kind: 'embed' }, 'free', now),
    false
  );
  assert.equal(
    isBlockVisibleNow({ isActive: true, isArchived: false, kind: 'embed' }, 'pro', now),
    true
  );

  // Scheduled item requires Pro
  assert.equal(
    isBlockVisibleNow(
      {
        isActive: true,
        isArchived: false,
        kind: 'link',
        startAt: '2026-10-20T11:00:00Z',
      },
      'free',
      now
    ),
    false
  );
  assert.equal(
    isBlockVisibleNow(
      {
        isActive: true,
        isArchived: false,
        kind: 'link',
        startAt: '2026-10-20T11:00:00Z',
      },
      'pro',
      now
    ),
    true
  );

  // Upcoming item is hidden even on Pro
  assert.equal(
    isBlockVisibleNow(
      {
        isActive: true,
        isArchived: false,
        kind: 'link',
        startAt: '2026-10-20T13:00:00Z',
      },
      'pro',
      now
    ),
    false
  );
});

// 5. Site Origin & Plan
test('site: pageUrl generates clean url without duplicate slashes in format iveo.site/@username', () => {
  assert.equal(pageUrl('maya'), 'https://iveo.site/@maya');
  assert.equal(pageUrl('/maya'), 'https://iveo.site/@maya');
  assert.equal(pageUrl('@maya'), 'https://iveo.site/@maya');
});

test('plan: defines all pro features and labels', () => {
  assert.deepEqual(PRO_FEATURES, [
    'embeds',
    'scheduling',
    'hide_footer',
    'analytics_detail',
    'password_links',
    'contact_forms',
    'backgrounds',
    'fonts',
    'pro_vibes',
    'verified_badge',
  ]);
  assert.equal(getProFeatureName('embeds'), 'Playable media embeds');
  assert.equal(getProFeatureName('scheduling'), 'Link scheduling & expiration');
  assert.equal(getProFeatureName('hide_footer'), 'Removing the iveo mark');
  assert.equal(getProFeatureName('analytics_detail'), 'Advanced analytics');
  assert.equal(getProFeatureName('password_links'), 'Password-protected links');
  assert.equal(getProFeatureName('contact_forms'), 'Email and phone collection');
  assert.equal(getProFeatureName('backgrounds'), 'Pro backdrops & custom photo uploads');
  assert.equal(getProFeatureName('fonts'), 'Pro designer fonts & pairings');
  assert.equal(getProFeatureName('pro_vibes'), 'Pro Vibes (6 exclusive themes)');
  assert.equal(getProFeatureName('verified_badge'), 'Verified Pro tick next to your handle');
});
