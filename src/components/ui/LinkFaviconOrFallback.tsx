import React, { useEffect, useState } from 'react';
import {
  Code2,
  Globe,
  Link2,
  Mail,
  Music,
  Phone,
  ShoppingBag,
  Youtube,
} from 'lucide-react';
import { getFaviconUrl, inferLinkIconKind } from '../../lib/favicons';

interface LinkFaviconOrFallbackProps {
  url?: string | null;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export const LinkFaviconOrFallback: React.FC<LinkFaviconOrFallbackProps> = ({
  url,
  size = 16,
  className = '',
  strokeWidth = 1.5,
}) => {
  const faviconUrl = getFaviconUrl(url, Math.max(32, size * 2));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [faviconUrl]);

  if (faviconUrl && !failed) {
    return (
      <img
        src={faviconUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`object-contain rounded-[3px] block shrink-0 ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    );
  }

  const kind = inferLinkIconKind(url);
  switch (kind) {
    case 'mail':
      return <Mail size={size} strokeWidth={strokeWidth} className={className} />;
    case 'phone':
      return <Phone size={size} strokeWidth={strokeWidth} className={className} />;
    case 'code':
      return <Code2 size={size} strokeWidth={strokeWidth} className={className} />;
    case 'video':
      return <Youtube size={size} strokeWidth={strokeWidth} className={className} />;
    case 'music':
      return <Music size={size} strokeWidth={strokeWidth} className={className} />;
    case 'shop':
      return <ShoppingBag size={size} strokeWidth={strokeWidth} className={className} />;
    case 'globe':
      return <Globe size={size} strokeWidth={strokeWidth} className={className} />;
    default:
      return <Link2 size={size} strokeWidth={strokeWidth} className={className} />;
  }
};
