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
test('site: pageUrl generates clean url without duplicate slashes', () => {
  assert.equal(pageUrl('maya'), `${SITE_ORIGIN}/maya`);
  assert.equal(pageUrl('/maya'), `${SITE_ORIGIN}/maya`);
});

test('plan: defines all pro features and labels', () => {
  assert.deepEqual(PRO_FEATURES, [
    'embeds',
    'scheduling',
    'hide_footer',
    'analytics_detail',
    'password_links',
    'contact_forms',
  ]);
  assert.equal(getProFeatureName('embeds'), 'Embeds');
  assert.equal(getProFeatureName('scheduling'), 'Scheduling');
  assert.equal(getProFeatureName('hide_footer'), 'Removing the iveo mark');
  assert.equal(getProFeatureName('analytics_detail'), 'Advanced analytics');
  assert.equal(getProFeatureName('password_links'), 'Password-protected links');
  assert.equal(getProFeatureName('contact_forms'), 'Email and phone collection');
});
