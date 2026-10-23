import { ImageResponse } from '@vercel/og';
import { getSiteOrigin } from './_lib/env.js';
import { normalizeUsername } from './_lib/usernames.js';
import { loadPublicPage, isAllowedAvatarHost } from './_lib/publicPage.js';
import { getServerVibe } from './_lib/vibes.js';
import { truncate } from './_lib/html.js';

// Strip emojis and check if string contains only Latin script, numbers, punctuation, spaces, math/currency symbols
function isRenderableLatin(text: string): boolean {
  if (!text) return true;
  // Remove emoji ranges
  const noEmoji = text.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '');
  const trimmed = noEmoji.trim();
  if (!trimmed) return false;
  return /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}\p{Sc}\p{Sm}]+$/u.test(trimmed);
}

async function fetchAvatarAsDataUrl(avatarUrl: string | null): Promise<string | null> {
  if (!avatarUrl || !isAllowedAvatarHost(avatarUrl)) {
    return null;
  }

  try {
    const res = await fetch(avatarUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('image/png') && !contentType.includes('image/jpeg')) {
      return null;
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 1000000) {
      return null;
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 1000000) {
      return null;
    }

    const base64 = Buffer.from(buffer).toString('base64');
    const mime = contentType.includes('image/png') ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
}

function renderGenericCard() {
  const rootElement: any = {
    type: 'div',
    key: null,
    props: {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#FAFAFA',
          padding: '48px',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                fontSize: 168,
                fontWeight: 700,
                color: '#0A0A0A',
                letterSpacing: -6,
                lineHeight: 1,
              },
              children: 'iveo',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: 44,
                color: '#666666',
                marginTop: 24,
                lineHeight: 1.2,
              },
              children: 'One link for everything you make.',
            },
          },
        ],
      },
    };
    return new ImageResponse(rootElement, {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  );
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawUser = url.searchParams.get('u');
  const origin = getSiteOrigin(request);
  const host = new URL(origin).host;

  const username = normalizeUsername(rawUser);
  if (!username) {
    return renderGenericCard();
  }

  try {
    const page = await loadPublicPage(username);
    if (!page) {
      return renderGenericCard();
    }

    const vibe = getServerVibe(page.vibeId);

    // Text safety checks
    let displayName = page.displayName || `@${page.username}`;
    if (!isRenderableLatin(displayName)) {
      displayName = `@${page.username}`;
    }
    displayName = truncate(displayName, 40);

    let bio = page.bio || '';
    if (!isRenderableLatin(bio)) {
      bio = '';
    }
    bio = truncate(bio, 120);

    const avatarDataUrl = await fetchAvatarAsDataUrl(page.avatarUrl);

    // Avatar element: <img> if dataUrl available, else Monogram circle
    const avatarElement = avatarDataUrl
      ? {
          type: 'img',
          props: {
            src: avatarDataUrl,
            width: 200,
            height: 200,
            style: {
              width: 200,
              height: 200,
              borderRadius: 100,
              objectFit: 'cover',
            },
          },
        }
      : {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 200,
              height: 200,
              borderRadius: 100,
              backgroundColor: vibe.avatarBg,
            },
            children: {
              type: 'div',
              props: {
                style: {
                  fontSize: 88,
                  fontWeight: 700,
                  color: vibe.text,
                },
                children: displayName.charAt(0).toUpperCase() || '?',
              },
            },
          },
        };

    const textChildren: unknown[] = [
      {
        type: 'div',
        props: {
          style: {
            fontSize: 68,
            fontWeight: 700,
            color: vibe.text,
            lineHeight: 1.1,
          },
          children: displayName,
        },
      },
      {
        type: 'div',
        props: {
          style: {
            fontSize: 36,
            color: vibe.muted,
          },
          children: `@${page.username}`,
        },
      },
    ];

    if (bio) {
      textChildren.push({
        type: 'div',
        props: {
          style: {
            fontSize: 32,
            color: vibe.text,
            lineHeight: 1.35,
            marginTop: 12,
          },
          children: bio,
        },
      });
    }

    const rootElement: any = {
      type: 'div',
      key: null,
      props: {
          style: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            backgroundColor: vibe.bg,
            padding: '72px',
          },
          children: [
            // Top Block
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: '48px',
                },
                children: [
                  avatarElement,
                  {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        maxWidth: '800px',
                      },
                      children: textChildren,
                    },
                  },
                ],
              },
            },
            // Bottom Row
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: 30,
                        color: vibe.muted,
                      },
                      children: `${host}/${page.username}`,
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      style: {
                        fontSize: 44,
                        fontWeight: 700,
                        color: vibe.text,
                        letterSpacing: -2,
                      },
                      children: 'iveo',
                    },
                  },
                ],
              },
            },
          ],
        },
      };

    return new ImageResponse(rootElement, {
      width: 1200,
        height: 630,
        headers: {
          'Cache-Control':
            'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch {
    return renderGenericCard();
  }
}
