import React, { useState, useEffect } from 'react';
import { pageDisplayUrl } from '../../lib/site';
import { computeShareVersion } from '../../lib/share-image';
import { VIBES } from '../../lib/vibes';
import { copy } from '../../content/copy';

interface LinkPreviewSectionProps {
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string | null;
  vibeId?: string;
}

export const LinkPreviewSection: React.FC<LinkPreviewSectionProps> = ({
  username,
  displayName,
  bio,
  avatarUrl,
  vibeId,
}) => {
  const [version, setVersion] = useState('1');
  const [imgFailed, setImgFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    computeShareVersion(displayName, bio, avatarUrl, vibeId).then((v) => {
      if (isMounted) {
        setVersion(v);
        setImgFailed(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [displayName, bio, avatarUrl, vibeId]);

  const cleanUsername = (username || 'creator').toLowerCase().trim();
  const host = pageDisplayUrl(cleanUsername);
  const titleName = displayName || `@${cleanUsername}`;
  const cardTitle = `${titleName} | iveo`;
  const cardDesc = bio ? bio : `Explore links & updates by @${cleanUsername} on iveo.`;
  const imgUrl = `/api/og?u=${encodeURIComponent(cleanUsername)}&v=${version}`;
  const activeVibe = VIBES.find((v) => v.id === vibeId) || VIBES[0];

  return (
    <div className="flex flex-col gap-3" data-testid="link-preview-section">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[14px] font-medium text-ink leading-tight">
          {copy.sharePreview.title}
        </h3>
        <p className="text-[13px] text-muted leading-normal">
          {copy.sharePreview.helper}
        </p>
      </div>

      <div className="border border-border rounded-[14px] overflow-hidden bg-surface">
        {/* Aspect ratio 1200 / 630 container with live rendered fallback if OG fails */}
        <div
          className="w-full bg-surface-2 relative overflow-hidden"
          style={{ aspectRatio: '1200 / 630' }}
        >
          {!imgFailed ? (
            <img
              src={imgUrl}
              alt={copy.sharePreview.alt}
              loading="lazy"
              onLoad={() => {
                setIsLoaded(true);
                setImgFailed(false);
              }}
              onError={() => {
                setImgFailed(true);
              }}
              className={`w-full h-full object-cover transition-opacity duration-150 ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ) : (
            <div
              className="w-full h-full p-5 flex flex-col justify-between select-none"
              style={{
                backgroundColor: activeVibe.tokens.bg,
                color: activeVibe.tokens.text,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono opacity-75">iveo.site/{cleanUsername}</span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: activeVibe.tokens.buttonBg,
                    color: activeVibe.tokens.buttonText,
                  }}
                >
                  iveo
                </span>
              </div>
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={titleName}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover border border-black/10 shrink-0"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-[16px] shrink-0"
                    style={{
                      backgroundColor: activeVibe.tokens.buttonBg,
                      color: activeVibe.tokens.buttonText,
                    }}
                  >
                    {titleName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[16px] font-semibold truncate">{titleName}</div>
                  <div className="text-[12px] opacity-75 truncate">{cardDesc}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Text Details */}
        <div className="p-3 flex flex-col gap-1">
          <span className="font-mono text-[12px] text-muted truncate">
            {host}
          </span>
          <span className="text-[15px] font-medium text-ink leading-snug truncate">
            {cardTitle}
          </span>
          <p className="text-[13px] text-muted leading-normal line-clamp-2">
            {cardDesc}
          </p>
        </div>
      </div>
    </div>
  );
};
