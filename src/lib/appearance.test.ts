import test from 'node:test';
import assert from 'node:assert/strict';

import { isUserPageLocation, shouldShowSiteIntro } from './intro.ts';
import {
  FONT_OPTIONS,
  getFontOption,
  canUseFont,
  getFontCssFamily,
  parseFontSettings,
  buildGoogleFontsStylesheetUrl,
} from './fonts.ts';
import {
  normalizeHexColor,
  isValidHexColor,
  getContrastTextColor,
  parseButtonColors,
  resolveEffectiveTokens,
} from './colors.ts';
import {
  parseBusinessCardConfig,
  mergeBusinessCardConfig,
  BUSINESS_CARD_TEMPLATES,
} from './businessCardConfig.ts';
import { VIBES } from './vibes.ts';

// ── 1. Intro suppression tests ────────────────────────────────────────────────
test('intro animation never plays on user path routes or user subdomains', () => {
  assert.equal(isUserPageLocation({ pathname: '/maya' }), true);
  assert.equal(isUserPageLocation({ pathname: '/arjun-studio' }), true);
  assert.equal(isUserPageLocation({ pathname: '/', hostname: 'maya.iveo.site' }), true);
  assert.equal(isUserPageLocation({ pathname: '/', hostname: 'maya.localhost' }), true);
  assert.equal(isUserPageLocation({ pathname: '/dev' }), true);
  assert.equal(isUserPageLocation({ pathname: '/', search: '?subdomain=maya' }), true);

  // Even first visit & ?intro should NOT show site intro on a user's page
  assert.equal(
    shouldShowSiteIntro({
      pathname: '/maya',
      hostname: 'iveo.site',
      search: '',
      localSeen: null,
      sessionSeen: null,
    }),
    false
  );
  assert.equal(
    shouldShowSiteIntro({
      pathname: '/maya',
      hostname: 'iveo.site',
      search: '?intro=1',
      localSeen: null,
      sessionSeen: null,
    }),
    false
  );
  assert.equal(
    shouldShowSiteIntro({
      pathname: '/',
      hostname: 'maya.iveo.site',
      search: '',
      localSeen: null,
      sessionSeen: null,
    }),
    false
  );
});

test('intro animation still plays on site routes on first visit or ?intro', () => {
  assert.equal(isUserPageLocation({ pathname: '/' }), false);
  assert.equal(isUserPageLocation({ pathname: '/pricing' }), false);
  assert.equal(isUserPageLocation({ pathname: '/dashboard/appearance' }), false);
  assert.equal(isUserPageLocation({ pathname: '/', hostname: 'www.iveo.site' }), false);

  assert.equal(
    shouldShowSiteIntro({
      pathname: '/',
      hostname: 'iveo.site',
      localSeen: null,
      sessionSeen: null,
    }),
    true
  );
  assert.equal(
    shouldShowSiteIntro({
      pathname: '/',
      hostname: 'iveo.site',
      localSeen: '1',
      sessionSeen: null,
    }),
    false
  );
  assert.equal(
    shouldShowSiteIntro({
      pathname: '/',
      hostname: 'iveo.site',
      search: '?intro=1',
      localSeen: '1',
      sessionSeen: '1',
    }),
    true
  );
});

// ── 2. Curated Free & Pro Fonts tests ─────────────────────────────────────────
test('font catalog includes both Free and Pro fonts with proper gating', () => {
  const freeFonts = FONT_OPTIONS.filter((f) => !f.isPro);
  const proFonts = FONT_OPTIONS.filter((f) => f.isPro);
  assert.ok(freeFonts.length >= 6, 'should offer multiple free fonts');
  assert.ok(proFonts.length >= 8, 'should offer multiple pro fonts');

  assert.equal(canUseFont('inter', false), true);
  assert.equal(canUseFont('space-grotesk', false), true);
  assert.equal(canUseFont('playfair', false), false);
  assert.equal(canUseFont('playfair', true), true);

  assert.match(getFontCssFamily('fraunces', 'sans-serif'), /Fraunces/);
  assert.equal(getFontCssFamily('unknown-font', "'Inter', sans-serif"), "'Inter', sans-serif");
  assert.ok(getFontOption('SYNE')?.id === 'syne');
});

test('parseFontSettings and Google Fonts URL builder ignore invalid IDs', () => {
  const parsed = parseFontSettings({
    nameFont: 'Playfair',
    bioFont: 'dm-sans',
    buttonFont: 'not-a-font',
  });
  assert.deepEqual(parsed, {
    nameFont: 'playfair',
    bioFont: 'dm-sans',
    buttonFont: null,
  });
  assert.equal(parseFontSettings({ nameFont: 'invalid' }), null);

  const cssUrl = buildGoogleFontsStylesheetUrl(['playfair', 'dm-sans', 'playfair']);
  assert.ok(cssUrl && cssUrl.includes('Playfair+Display') && cssUrl.includes('DM+Sans'));
});

// ── 3. Hex color validation & effective button token tests ────────────────────
test('hex color normalization handles shorthand, missing #, case, and invalid strings', () => {
  assert.equal(normalizeHexColor('2563eb'), '#2563EB');
  assert.equal(normalizeHexColor('#f0a'), '#FF00AA');
  assert.equal(normalizeHexColor(' #112233 '), '#112233');
  assert.equal(normalizeHexColor('transparent', { allowTransparent: true }), 'transparent');
  assert.equal(normalizeHexColor('transparent'), null);
  assert.equal(normalizeHexColor('red'), null);
  assert.equal(isValidHexColor('#0A0A0A'), true);
  assert.equal(isValidHexColor('#GGGGGG'), false);

  assert.equal(getContrastTextColor('#FFFFFF'), '#0A0A0A');
  assert.equal(getContrastTextColor('#1E293B'), '#FFFFFF');
});

test('resolveEffectiveTokens applies custom button hex colors and auto-contrast fallback', () => {
  const cleanTokens = VIBES[0].tokens; // bg #FFFFFF, buttonBg #0A0A0A, buttonText #FFFFFF
  const custom = parseButtonColors({ bg: 'fef08a', border: '#ca8a04' });
  assert.deepEqual(custom, { bg: '#FEF08A', text: null, border: '#CA8A04' });

  const resolved = resolveEffectiveTokens(cleanTokens, custom, null);
  assert.equal(resolved.buttonBg, '#FEF08A');
  assert.equal(resolved.buttonText, '#0A0A0A'); // Auto-computed dark text for bright yellow fill
  assert.equal(resolved.buttonBorder, '#CA8A04');

  // Dark backdrop with light vibe elevates page text to high-contrast light ink
  const resolvedDarkBg = resolveEffectiveTokens(cleanTokens, null, {
    type: 'mesh',
    presetId: 'aurora',
    value: 'radial-gradient(...)',
  });
  assert.equal(resolvedDarkBg.text, '#F8FAFC');
});

// ── 4. Business Card config parsing & merging ─────────────────────────────────
test('business card config parses templates, custom hex colors, and contact fields', () => {
  assert.ok(BUSINESS_CARD_TEMPLATES.length >= 5);
  const parsed = parseBusinessCardConfig({
    template: 'executive',
    bgColor: '111827',
    accentColor: '#38bdf8',
    fontId: 'outfit',
    role: 'Product Designer',
    companyOrLocation: 'Studio Ode · Lisbon',
    contactEmail: 'maya@iveo.site',
    showAvatar: true,
    showQr: false,
    cornerStyle: 'sharp',
  });
  assert.ok(parsed);
  assert.equal(parsed.template, 'executive');
  assert.equal(parsed.bgColor, '#111827');
  assert.equal(parsed.accentColor, '#38BDF8');
  assert.equal(parsed.showQr, false);
  assert.equal(parsed.cornerStyle, 'sharp');

  const merged = mergeBusinessCardConfig(parsed, { showQr: true });
  assert.equal(merged.showQr, true);
  assert.equal(merged.role, 'Product Designer');
});
