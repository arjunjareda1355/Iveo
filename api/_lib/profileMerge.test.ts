import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeProfileForSave } from './profileMerge';

test('mergeProfileForSave preserves omitted fields on partial profile update', () => {
  const existing = {
    userId: 'user_123',
    username: 'maya',
    displayName: 'Maya Ellis',
    bio: 'Painter & illustrator',
    avatarUrl: 'https://cdn.example.com/maya.jpg',
    avatarType: 'uploaded',
    avatarId: null,
    vibeId: 'editorial',
    buttonShape: 'pill',
    socials: { instagram: 'mayaellis', youtube: '@mayaellis' },
    socialsPosition: 'bottom',
    primaryEmail: 'maya@example.com',
    plan: 'pro',
    status: 'active',
    isPublished: true,
    hideFooter: true,
    hideFromSearch: false,
    background: { type: 'gradient', value: 'linear-gradient(...)' },
    googleAnalyticsId: 'G-ABC1234567',
    metaPixelId: '123456789012345',
    whatsappNumber: '+15550001234',
    customSeoTitle: 'Maya Studio',
    customSeoDescription: 'Watercolor commissions',
    fontSettings: { nameFont: 'instrument-serif' },
    buttonColors: { bg: '#111111' },
    businessCard: { frontPaletteId: 'obsidian-gold' },
    layoutSettings: { headerAlign: 'left' },
  };

  // Partial save only updating displayName and bio
  const merged = mergeProfileForSave(
    existing,
    {
      userId: 'user_123',
      username: 'Maya',
      displayName: 'Maya E.',
      bio: 'Updated bio',
    },
    false
  );

  assert.equal(merged.username, 'maya');
  assert.equal(merged.displayName, 'Maya E.');
  assert.equal(merged.bio, 'Updated bio');
  assert.equal(merged.vibeId, 'editorial');
  assert.equal(merged.buttonShape, 'pill');
  assert.deepEqual(merged.socials, { instagram: 'mayaellis', youtube: '@mayaellis' });
  assert.equal(merged.socialsPosition, 'bottom');
  assert.equal(merged.googleAnalyticsId, 'G-ABC1234567');
  assert.equal(merged.metaPixelId, '123456789012345');
  assert.equal(merged.whatsappNumber, '+15550001234');
  assert.deepEqual(merged.businessCard, { frontPaletteId: 'obsidian-gold' });
  assert.deepEqual(merged.layoutSettings, { headerAlign: 'left' });
  assert.equal(merged.plan, 'pro');
  assert.equal(merged.hideFooter, true);
});

test('mergeProfileForSave allows explicit null to clear integration or appearance fields', () => {
  const existing = {
    userId: 'user_123',
    username: 'alex',
    googleAnalyticsId: 'G-TEST12345',
    buttonShape: 'rounded',
    vibeId: 'clean',
  };

  const merged = mergeProfileForSave(
    existing,
    {
      userId: 'user_123',
      username: 'alex',
      googleAnalyticsId: null,
      buttonShape: null,
    },
    false
  );

  assert.equal(merged.googleAnalyticsId, null);
  assert.equal(merged.buttonShape, null);
  assert.equal(merged.vibeId, 'clean');
});
