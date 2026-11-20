import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractChannelMetaFromHtml,
  getYouTubeApiKey,
  parseRssFeedXml,
  parseYouTubeInput,
} from './youtube';

test('getYouTubeApiKey resolves configured server API key cleanly', () => {
  const prev = process.env.YOUTUBE_API_KEY;
  try {
    delete process.env.YOUTUBE_API_KEY;
    assert.equal(getYouTubeApiKey(), '');

    process.env.YOUTUBE_API_KEY = 'mock_youtube_server_key_for_test_only';
    assert.equal(getYouTubeApiKey(), 'mock_youtube_server_key_for_test_only');
  } finally {
    if (prev === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = prev;
  }
});

test('parseYouTubeInput resolves handles, channel IDs, custom URLs, shorts, and watch links', () => {
  assert.deepEqual(parseYouTubeInput('@mkbhd'), {
    kind: 'handle',
    value: '@mkbhd',
    canonicalUrl: 'https://www.youtube.com/@mkbhd',
  });
  assert.deepEqual(parseYouTubeInput('https://youtube.com/@mkbhd/videos'), {
    kind: 'handle',
    value: '@mkbhd',
    canonicalUrl: 'https://www.youtube.com/@mkbhd',
  });
  assert.deepEqual(parseYouTubeInput('https://youtu.be/dQw4w9WgXcQ'), {
    kind: 'video',
    value: 'dQw4w9WgXcQ',
    canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  });
  assert.deepEqual(parseYouTubeInput('UCX6OQ3DkcsbYNE6H8uQQuVA'), {
    kind: 'channel_id',
    value: 'UCX6OQ3DkcsbYNE6H8uQQuVA',
    canonicalUrl: 'https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA',
  });
});

test('extractChannelMetaFromHtml extracts canonical channel ID, avatar, handle, and subscribers', () => {
  const html = `
    <html>
      <head>
        <link rel="canonical" href="https://www.youtube.com/channel/UCBJycsmduvYEL83R_U4JriQ" />
        <meta property="og:title" content="Marques Brownlee - YouTube" />
        <meta property="og:image" content="https://yt3.googleusercontent.com/avatar123=s900" />
      </head>
      <script>
        var data = {"vanityChannelUrl":"https://www.youtube.com/@mkbhd","metadataParts":[{"text":{"content":"19.5M subscribers"}}]};
      </script>
    </html>
  `;
  const parsed = parseYouTubeInput('@mkbhd')!;
  const meta = extractChannelMetaFromHtml(html, parsed);

  assert.equal(meta.channelId, 'UCBJycsmduvYEL83R_U4JriQ');
  assert.equal(meta.channelTitle, 'Marques Brownlee');
  assert.equal(meta.handle, '@mkbhd');
  assert.equal(meta.avatarUrl, 'https://yt3.googleusercontent.com/avatar123=s900');
  assert.equal(meta.subscriberCountText, '19.5M subscribers');
});

test('parseRssFeedXml extracts channel author name and up to 3 latest videos', () => {
  const xml = `
    <feed>
      <author><name>Iveo Studio</name></author>
      <entry>
        <yt:videoId>vid111</yt:videoId>
        <title>First &amp; Best Launch</title>
        <published>2026-11-01T10:00:00Z</published>
      </entry>
      <entry>
        <yt:videoId>vid222</yt:videoId>
        <title>Second Video</title>
        <published>2026-10-20T10:00:00Z</published>
      </entry>
    </feed>
  `;
  const res = parseRssFeedXml(xml);
  assert.equal(res.channelName, 'Iveo Studio');
  assert.equal(res.videos.length, 2);
  assert.equal(res.videos[0].videoId, 'vid111');
  assert.equal(res.videos[0].title, 'First & Best Launch');
  assert.equal(res.videos[0].thumbnailUrl, 'https://i.ytimg.com/vi/vid111/hqdefault.jpg');
});
