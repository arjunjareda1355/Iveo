import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dbClaimUsername,
  dbGetProfile,
  dbGetProfileByUserId,
  dbVerifyOwnership,
  dbSaveProfile,
  dbSaveBlocks,
  dbGetBlocks,
  dbDeleteAccount,
} from '../../api/_lib/azureSql.ts';

test('dbClaimUsername: rejects invalid format and reserved usernames', async () => {
  // Too short
  const shortRes = await dbClaimUsername('user_123', 'ab');
  assert.equal(shortRes.ok, false);
  assert.equal(shortRes.error, 'invalid_format');

  // Invalid characters (spaces, special symbols)
  const invalidRes = await dbClaimUsername('user_123', 'bad name!');
  assert.equal(invalidRes.ok, false);
  assert.equal(invalidRes.error, 'invalid_format');

  // Reserved keyword
  const reservedRes = await dbClaimUsername('user_123', 'admin');
  assert.equal(reservedRes.ok, false);
  assert.equal(reservedRes.error, 'reserved');
});

test('dbClaimUsername: atomically claims username and enforces case-insensitive uniqueness', async () => {
  const testUserA = `user_alice_${Date.now()}`;
  const testUserB = `user_bob_${Date.now()}`;
  const username = `alice-${Date.now()}`;

  // 1. User A claims username
  const claimA = await dbClaimUsername(testUserA, username, {
    displayName: 'Alice Artist',
    bio: 'Painter & illustrator',
    vibeId: 'vibrant',
  });
  assert.equal(claimA.ok, true);
  assert.equal(claimA.username, username.toLowerCase());
  assert.equal(claimA.profileUrl, `https://${username.toLowerCase()}.iveo.site`);

  // 2. User B tries to claim the same username (uppercase variant) -> must be rejected
  const claimB = await dbClaimUsername(testUserB, username.toUpperCase());
  assert.equal(claimB.ok, false);
  assert.equal(claimB.error, 'already_claimed');

  // 3. Centralized database lookup returns User A's profile
  const profile = await dbGetProfile(username.toUpperCase());
  assert.ok(profile);
  assert.equal(profile.userId, testUserA);
  assert.equal(profile.displayName, 'Alice Artist');
  assert.equal(profile.vibeId, 'vibrant');

  // Cleanup
  await dbDeleteAccount(username, testUserA);
});

test('dbGetProfileByUserId: resolves user page on new browser / device via authenticated account ID', async () => {
  const testUserId = `user_device_sync_${Date.now()}`;
  const username = `sync-${Date.now()}`;

  // User claims on Device 1
  await dbClaimUsername(testUserId, username, {
    displayName: 'Device Sync User',
    bio: 'Testing cross-browser synchronization',
  });

  // Simulated Device 2 / Incognito session calls dbGetProfileByUserId
  const retrieved = await dbGetProfileByUserId(testUserId);
  assert.ok(retrieved);
  assert.equal(retrieved.username, username);
  assert.equal(retrieved.displayName, 'Device Sync User');

  // Cleanup
  await dbDeleteAccount(username, testUserId);
});

test('dbVerifyOwnership: prevents unauthorized users from modifying or deleting pages', async () => {
  const ownerId = `user_owner_${Date.now()}`;
  const hackerId = `user_hacker_${Date.now()}`;
  const username = `sec-${Date.now()}`;

  // Owner claims
  await dbClaimUsername(ownerId, username, {
    displayName: 'Legitimate Owner',
  });

  // Owner can save
  const ownerSave = await dbSaveProfile({
    userId: ownerId,
    username,
    displayName: 'Legitimate Owner Updated',
  });
  assert.equal(ownerSave.ok, true);

  // Hacker attempts to overwrite profile -> rejected with unauthorized
  const hackerSave = await dbSaveProfile({
    userId: hackerId,
    username,
    displayName: 'Hacked Page',
  });
  assert.equal(hackerSave.ok, false);
  assert.equal(hackerSave.error, 'unauthorized');

  // Hacker attempts to overwrite blocks -> rejected with unauthorized
  const hackerBlocks = await dbSaveBlocks(username, [{ id: 'bad1', title: 'Malicious' }], hackerId);
  assert.equal(hackerBlocks.ok, false);
  assert.equal(hackerBlocks.error, 'unauthorized');

  // Hacker attempts to delete account -> rejected with unauthorized
  const hackerDelete = await dbDeleteAccount(username, hackerId);
  assert.equal(hackerDelete.ok, false);
  assert.equal(hackerDelete.error, 'unauthorized');

  // Owner can save blocks and delete account
  const ownerBlocks = await dbSaveBlocks(username, [{ id: 'b1', title: 'Owner Link', isActive: true }], ownerId);
  assert.equal(ownerBlocks.ok, true);

  const ownerDelete = await dbDeleteAccount(username, ownerId);
  assert.equal(ownerDelete.ok, true);
});

test('dbClaimUsername: user can rename their address and their blocks transfer seamlessly', async () => {
  const userId = `user_rename_${Date.now()}`;
  const oldName = `old-${Date.now()}`;
  const newName = `new-${Date.now()}`;

  // Claim initial address
  await dbClaimUsername(userId, oldName, { displayName: 'Renamer' });
  await dbSaveBlocks(oldName, [{ id: 'b_initial', title: 'My Work', isActive: true }], userId);

  // Rename to new address
  const renameRes = await dbClaimUsername(userId, newName, { displayName: 'Renamer' });
  assert.equal(renameRes.ok, true);
  assert.equal(renameRes.username, newName);

  // Old address is freed
  const oldProfile = await dbGetProfile(oldName);
  assert.equal(oldProfile, null);

  // New address has the profile and migrated blocks
  const newProfile = await dbGetProfile(newName);
  assert.ok(newProfile);
  assert.equal(newProfile.userId, userId);

  const newBlocks = await dbGetBlocks(newName);
  assert.equal(newBlocks.length, 1);
  assert.equal(newBlocks[0].title, 'My Work');

  // Cleanup
  await dbDeleteAccount(newName, userId);
});
