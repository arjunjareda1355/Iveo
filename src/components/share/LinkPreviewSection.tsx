import React, { useState, useEffect } from 'react';
import { SITE_ORIGIN, pageDisplayUrl } from '../../lib/site';
import { computeShareVersion } from '../../lib/share-image';
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
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    computeShareVersion(displayName, bio, avatarUrl, vibeId).then((v) => {
      if (isMounted) setVersion(v);
    });
    return () => {
      isMounted = false;
    };
  }, [displayName, bio, avatarUrl, vibeId]);

  if (hasError) {
    // Silently hide when image fails to load (e.g. in preview where /api does not exist)
    return null;
  }

  const host = pageDisplayUrl(username);

  const titleName = displayName || `@${username}`;
  const cardTitle = `${titleName} | iveo`;
  const cardDesc = bio ? bio : `Links by @${username} on iveo.`;
  const imgUrl = `/api/og?u=${encodeURIComponent(username.toLowerCase())}&v=${version}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-[14px] font-medium text-ink leading-tight">
          {copy.sharePreview.title}
        </h3>
        <p className="text-[13px] text-muted leading-normal">
          {copy.sharePreview.helper}
        </p>
      </div>

      <div className="border border-border rounded-[14px] overflow-hidden bg-surface">
        {/* Aspect ratio 1200 / 630 container */}
        <div
          className="w-full bg-surface-2 relative overflow-hidden"
          style={{ aspectRatio: '1200 / 630' }}
        >
          <img
            src={imgUrl}
            alt={copy.sharePreview.alt}
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
            className={`w-full h-full object-cover transition-opacity duration-150 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
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
