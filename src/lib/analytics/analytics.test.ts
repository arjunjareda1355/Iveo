import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSourceParam, classifyReferrer, normalizeAnalyticsSource } from './sources.ts';
import { detectDevice } from './device.ts';
import { niceMax, yTicks, formatCtr } from './chart.ts';
import { todayUtc, addDaysUtc, formatCount } from './dates.ts';
import { rangeToDates, RANGES } from './ranges.ts';
import { buildBuckets } from './buckets.ts';
import { analyticsFromJson } from './types.ts';

test('sources: parseSourceParam handles src, utm_source, ref with priority', () => {
  assert.equal(parseSourceParam('?src=instagram'), 'instagram');
  assert.equal(parseSourceParam('?utm_source=tiktok'), 'tiktok');
  assert.equal(parseSourceParam('?ref=email'), 'email');
  assert.equal(parseSourceParam('?src=qr&utm_source=tiktok'), 'qr');
  assert.equal(parseSourceParam('?src=INVALID_HACK'), null);
  assert.equal(parseSourceParam(''), null);
});

test('sources: classifyReferrer maps android app packages and hosts correctly', () => {
  assert.equal(classifyReferrer('https://www.google.com/search', 'iveo.site'), 'google');
  assert.equal(classifyReferrer('https://mail.google.com/', 'iveo.site'), 'email');
  assert.equal(classifyReferrer('https://l.instagram.com/', 'iveo.site'), 'instagram');
  assert.equal(classifyReferrer('https://t.co/abc123xyz', 'iveo.site'), 'x');
  assert.equal(classifyReferrer('https://web.whatsapp.com/', 'iveo.site'), 'whatsapp');
  assert.equal(classifyReferrer('android-app://com.discord', 'iveo.site'), 'discord');
  assert.equal(classifyReferrer('https://random-blog.net/post', 'iveo.site'), 'other');
  assert.equal(classifyReferrer('https://iveo.site/@maya', 'iveo.site'), '');
  assert.equal(classifyReferrer('', 'iveo.site'), '');
});

test('sources: normalizeAnalyticsSource canonicalizes raw referrers and handles empty as direct', () => {
  assert.equal(normalizeAnalyticsSource(''), '');
  assert.equal(normalizeAnalyticsSource('Direct'), '');
  assert.equal(normalizeAnalyticsSource('twitter'), 'x');
  assert.equal(normalizeAnalyticsSource('https://l.instagram.com/?u=https://iveo.site/@maya'), 'instagram');
  assert.equal(normalizeAnalyticsSource('https://vm.tiktok.com/ZM8abc/'), 'tiktok');
  assert.equal(normalizeAnalyticsSource('https://l.threads.net/'), 'threads');
  assert.equal(normalizeAnalyticsSource('https://iveo.site/@maya', 'iveo.site'), '');
});

test('device: detectDevice identifies device types from User-Agent including mobile in-app WebViews', () => {
  assert.equal(detectDevice('Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)'), 'tablet');
  assert.equal(detectDevice('Mozilla/5.0 (Linux; Android 13; SM-X900 Tablet) AppleWebKit/537.36'), 'tablet');
  assert.equal(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) Mobile/15E148'), 'mobile');
  assert.equal(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1'), 'mobile');
  assert.equal(detectDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Instagram 310.0.0.0 Android'), 'mobile');
  assert.equal(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/440.0]'), 'mobile');
  assert.equal(detectDevice('Mozilla/5.0 (Linux; Android 13; SM-S918B) WhatsApp/2.23'), 'mobile');
  assert.equal(detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), 'desktop');
  assert.equal(detectDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'desktop');
  assert.equal(detectDevice('Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'), 'desktop');
  assert.equal(detectDevice('UnknownAgent/1.0'), 'other');
});

test('chart: niceMax and yTicks calculate clean scale steps', () => {
  assert.equal(niceMax(0), 4);
  assert.equal(niceMax(3), 4);
  assert.equal(niceMax(7), 10);
  assert.equal(niceMax(13), 20);
  assert.equal(niceMax(48), 50);
  assert.equal(niceMax(130), 200);

  assert.deepEqual(yTicks(4), [0, 2, 4]);
  assert.deepEqual(yTicks(50), [0, 25, 50]);
});

test('chart: formatCtr formats percentages with cap and dash for 0 views', () => {
  assert.equal(formatCtr(0, 0), '–');
  assert.equal(formatCtr(5, 0), '–');
  assert.equal(formatCtr(5, 100), '5.0%');
  assert.equal(formatCtr(1, 3), '33.3%');
  assert.equal(formatCtr(150, 100), '100%');
});

test('dates: formatCount uses compact notation only for >=100k', () => {
  assert.equal(formatCount(0), '0');
  assert.equal(formatCount(999), '999');
  assert.equal(formatCount(12500), '12,500');
  assert.match(formatCount(100000), /100k|100K/i);
});

test('ranges: rangeToDates builds contiguous UTC day intervals', () => {
  const r7 = rangeToDates('7d');
  assert.equal(r7.to, todayUtc());
  assert.equal(r7.from, addDaysUtc(r7.to, -6));
});

test('buckets: groups daily counters into day, week, and month', () => {
  const days = [
    { day: '2026-10-01', views: 10, clicks: 2 },
    { day: '2026-10-02', views: 20, clicks: 4 },
  ];
  const dayBuckets = buildBuckets(days, 'day');
  assert.equal(dayBuckets.length, 2);
  assert.equal(dayBuckets[0].views, 10);
  assert.equal(dayBuckets[1].views, 20);
});

test('analyticsFromJson: maps link titles, views, clicks, sources, devices, and countries cleanly', () => {
  const parsed = analyticsFromJson({
    range: { from: '2026-11-01', to: '2026-11-16', max_days: 90, is_pro: true },
    totals: { views: 420, clicks: 84 },
    daily: [{ day: '2026-11-16', views: 42, clicks: 9 }],
    links: [{ link_id: 'social:instagram', title: 'Instagram (@maya)', clicks: 25 }],
    sources: [{ source: 'google', views: 200, clicks: 50 }],
    devices: [{ device: 'mobile', views: 300, clicks: 65 }],
    countries: [{ country: 'United States', views: 180, clicks: 40 }],
  });

  assert.ok(parsed);
  assert.equal(parsed.totals.views, 420);
  assert.equal(parsed.totals.clicks, 84);
  assert.equal(parsed.links[0]?.linkId, 'social:instagram');
  assert.equal(parsed.links[0]?.title, 'Instagram (@maya)');
  assert.equal(parsed.sources?.[0]?.source, 'google');
  assert.equal(parsed.sources?.[0]?.views, 200);
  assert.equal(parsed.devices?.[0]?.device, 'mobile');
  assert.equal(parsed.countries?.[0]?.country, 'United States');
  assert.equal(parsed.countries?.[0]?.clicks, 40);
});
