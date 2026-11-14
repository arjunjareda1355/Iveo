import React, { useState } from 'react';
import { UserCheck, Download, Check } from 'lucide-react';
import { VCardConfig } from '../../data/types';
import { VibeTokens } from '../../lib/vibes';
import { buildVCardString, sanitizeVCardFilename } from '../../lib/vcard';
import {
  resolveCardBorderRadius,
  resolveButtonControlRadius,
} from '../../lib/preferences';

interface VCardBlockProps {
  config: VCardConfig;
  tokens: VibeTokens;
  buttonRadius: number;
  fontFamily?: string;
  scale?: number;
  surfaceStyle?: React.CSSProperties;
}

export const VCardBlock: React.FC<VCardBlockProps> = ({
  config,
  tokens,
  buttonRadius,
  fontFamily,
  scale = 1,
  surfaceStyle,
}) => {
  const [downloaded, setDownloaded] = useState(false);
  const barRadius = resolveCardBorderRadius(buttonRadius, scale, 'bar');
  const controlRadius = resolveButtonControlRadius(buttonRadius, scale);

  const baseSurface: React.CSSProperties = surfaceStyle || {
    backgroundColor: tokens.buttonBg,
    color: tokens.buttonText,
    border: tokens.buttonBorder
      ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
      : '1px solid rgba(0,0,0,0.06)',
    boxShadow: tokens.buttonShadow || '0 1px 3px rgba(0,0,0,0.04)',
  };

  const fg = String(baseSurface.color || tokens.buttonText || tokens.text);
  const isLightFg =
    fg.toUpperCase() === '#FFFFFF' ||
    fg.toUpperCase() === '#FAFAFA' ||
    fg.toUpperCase() === '#F8FAFC' ||
    fg.toUpperCase() === '#F5F5F5';
  const ctaBg = downloaded ? '#10B981' : fg;
  const ctaText = downloaded
    ? '#FFFFFF'
    : typeof baseSurface.backgroundColor === 'string' &&
        baseSurface.backgroundColor.startsWith('#') &&
        baseSurface.backgroundColor !== 'transparent'
      ? baseSurface.backgroundColor
      : isLightFg
        ? '#0A0A0A'
        : '#FFFFFF';

  const handleDownloadVCard = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const vcardData = buildVCardString({
      fullName: config.fullName,
      title: config.title,
      organization: config.organization,
      phone: config.phone,
      email: config.email,
      note: config.note,
      url: typeof window !== 'undefined' ? window.location.href : 'https://iveo.site',
    });

    const blob = new Blob([vcardData], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = sanitizeVCardFilename(config.fullName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  const horizPad = buttonRadius >= 999 ? Math.round(16 * scale) : Math.round(14 * scale);

  return (
    <div
      onClick={handleDownloadVCard}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleDownloadVCard(e as any);
        }
      }}
      aria-label={`Save contact for ${config.fullName}`}
      className="w-full overflow-hidden relative flex items-center justify-between gap-2.5 transition-all duration-150 cursor-pointer select-none group hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        minHeight: `${Math.round(56 * scale)}px`,
        padding: `${Math.round(10 * scale)}px ${horizPad}px`,
        ...baseSurface,
        fontFamily,
        borderRadius: `${barRadius}px`,
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
        {/* Left Icon Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-medium"
          style={{
            backgroundColor: tokens.avatarBg || fg,
            color: tokens.avatarText || tokens.bg,
            fontSize: `${Math.max(12, Math.round(13 * scale))}px`,
          }}
        >
          <UserCheck size={Math.round(18 * scale)} strokeWidth={1.75} />
        </div>

        {/* Text Details */}
        <div className="flex flex-col text-left flex-1 min-w-0 overflow-hidden">
          <div
            className="font-semibold truncate leading-tight"
            style={{
              fontSize: `${Math.max(13, Math.round(14 * scale))}px`,
              color: fg,
            }}
          >
            {config.fullName}
          </div>
          {(config.title || config.organization) && (
            <div
              className="text-[12px] opacity-75 truncate leading-tight mt-0.5"
              style={{
                fontSize: `${Math.max(11, Math.round(12 * scale))}px`,
              }}
            >
              {[config.title, config.organization].filter(Boolean).join(' • ')}
            </div>
          )}
        </div>
      </div>

      {/* Right Action Button */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 font-medium text-[11px] shrink-0 whitespace-nowrap transition-transform group-hover:scale-105"
        style={{
          backgroundColor: ctaBg,
          color: ctaText,
          borderRadius: `${controlRadius}px`,
        }}
      >
        {downloaded ? (
          <>
            <Check size={13} strokeWidth={2.5} />
            <span>Saved</span>
          </>
        ) : (
          <>
            <Download size={13} strokeWidth={2} />
            <span>Save Contact</span>
          </>
        )}
      </div>
    </div>
  );
};
