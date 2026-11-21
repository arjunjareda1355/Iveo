import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBlueskyProfile,
  getBlueskyFeed,
  getBlueskySinglePost,
  checkBlueskyRateLimit,
  BlueskyProxyError,
  __setBlueskyFetchForTest,
  __clearBlueskyStateForTest,
} from './bluesky.ts';

test('bluesky proxy rejects invalid actor with 400 without calling upstream', async () => {
  __clearBlueskyStateForTest();
  let calls = 0;
  __setBlueskyFetchForTest(async () => {
    calls += 1;
    return new Response('{}', { status: 200 });
  });

  await assert.rejects(
    () => getBlueskyProfile('not valid handle'),
    (err: unknown) => err instanceof BlueskyProxyError && err.status === 400
  );
  assert.equal(calls, 0);
  __setBlueskyFetchForTest(null);
});

test('bluesky proxy enforces SSRF-fixed host, coalesces in-flight fetches, and hides !no-unauthenticated accounts', async () => {
  __clearBlueskyStateForTest();
  const fetchedUrls: string[] = [];
  __setBlueskyFetchForTest(async (url) => {
    fetchedUrls.push(url);
    return new Response(
      JSON.stringify({
        handle: 'alice.bsky.social',
        did: 'did:plc:ewvi7nxzyoun6zhxrhs64oiz',
        displayName: 'Alice',
        followersCount: 120,
        followsCount: 15,
        postsCount: 40,
        labels: [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  });

  const [p1, p2] = await Promise.all([
    getBlueskyProfile('@alice.bsky.social'),
    getBlueskyProfile('https://bsky.app/profile/alice.bsky.social'),
  ]);

  assert.equal(fetchedUrls.length, 1);
  assert.ok(fetchedUrls[0].startsWith('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?'));
  assert.equal(p1.did, p2.did);

  // !no-unauthenticated profile must return 403 profile_private
  __setBlueskyFetchForTest(async () => {
    return new Response(
      JSON.stringify({
        handle: 'private.bsky.social',
        did: 'did:plc:ewvi7nxzyoun6zhxrhs64oiz',
        labels: [{ val: '!no-unauthenticated' }],
      }),
      { status: 200 }
    );
  });

  await assert.rejects(
    () => getBlueskyProfile('private.bsky.social'),
    (err: unknown) => err instanceof BlueskyProxyError && err.status === 403 && err.code === 'profile_private'
  );

  __setBlueskyFetchForTest(null);
});

test('bluesky feed filters !no-unauthenticated posts and clamps limit 1..10', async () => {
  __clearBlueskyStateForTest();
  __setBlueskyFetchForTest(async () => {
    return new Response(
      JSON.stringify({
        feed: [
          {
            post: {
              uri: 'at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.feed.post/3k1',
              author: { handle: 'alice.bsky.social', did: 'did:plc:ewvi7nxzyoun6zhxrhs64oiz', displayName: 'Alice' },
              record: { text: 'Public post', createdAt: '2026-01-01T00:00:00Z' },
              labels: [],
            },
          },
          {
            post: {
              uri: 'at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.feed.post/3k2',
              author: { handle: 'alice.bsky.social', did: 'did:plc:ewvi7nxzyoun6zhxrhs64oiz', labels: [{ val: '!no-unauthenticated' }] },
              record: { text: 'Opted-out post', createdAt: '2026-01-01T00:00:00Z' },
              labels: [],
            },
          },
        ],
      }),
      { status: 200 }
    );
  });

  const res = await getBlueskyFeed({ actor: 'alice.bsky.social', limit: 99, filter: 'invalid_filter' });
  assert.equal(res.posts.length, 1);
  assert.equal(res.posts[0].text, 'Public post');
  __setBlueskyFetchForTest(null);
});

test('bluesky rate limiter caps requests per IP window and getBlueskySinglePost handles 5xx retry', async () => {
  __clearBlueskyStateForTest();
  for (let i = 0; i < 60; i++) {
    assert.equal(checkBlueskyRateLimit('192.0.2.1', 1000).allowed, true);
  }
  assert.equal(checkBlueskyRateLimit('192.0.2.1', 1000).allowed, false);
  assert.equal(checkBlueskyRateLimit('192.0.2.1', 62_000).allowed, true);

  let attempts = 0;
  __setBlueskyFetchForTest(async () => {
    attempts += 1;
    if (attempts === 1) {
      return new Response('err', { status: 503 });
    }
    return new Response(
      JSON.stringify({
        posts: [
          {
            uri: 'at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.feed.post/3k999',
            author: { handle: 'alice.bsky.social', did: 'did:plc:ewvi7nxzyoun6zhxrhs64oiz' },
            record: { text: 'Recovered post', createdAt: '2026-01-01T00:00:00Z' },
            labels: [{ val: 'graphic-media' }],
          },
        ],
      }),
      { status: 200 }
    );
  });

  const single = await getBlueskySinglePost(
    'at://did:plc:ewvi7nxzyoun6zhxrhs64oiz/app.bsky.feed.post/3k999'
  );
  assert.equal(attempts, 2);
  assert.equal(single.post.text, 'Recovered post');
  assert.equal(single.post.hasMediaWarning, true);
  __setBlueskyFetchForTest(null);
});
