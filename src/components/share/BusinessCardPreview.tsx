import React, { useEffect, useState } from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import {
  BusinessCardConfig,
  DEFAULT_BUSINESS_CARD_CONFIG,
  parseBusinessCardConfig,
} from '../../lib/businessCardConfig';
import { getFontCssFamily, loadGoogleFonts } from '../../lib/fonts';
import { isLightHexColor } from '../../lib/colors';

export interface BusinessCardPreviewProps {
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  qrDataUrl?: string | null;
  vibeTheme: {
    bg: string;
    text: string;
    muted: string;
    accent: string;
  };
  config?: BusinessCardConfig | null;
}

export const BusinessCardPreview: React.FC<BusinessCardPreviewProps> = ({
  username,
  displayName,
  bio,
  avatarUrl,
  qrDataUrl,
  vibeTheme,
  config,
}) => {
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  const resolved: BusinessCardConfig = {
    ...DEFAULT_BUSINESS_CARD_CONFIG,
    ...(parseBusinessCardConfig(config) || {}),
  };

  useEffect(() => {
    if (resolved.fontId) {
      loadGoogleFonts([resolved.fontId]);
    }
  }, [resolved.fontId]);

  const template = resolved.template || 'classic';

  // Resolve surface colors identically to generateBusinessCardPng
  let bg = resolved.bgColor || vibeTheme.bg;
  let accent = resolved.accentColor || vibeTheme.accent;
  let text = resolved.textColor || vibeTheme.text;
  let backgroundImage: string | undefined;

  if (template === 'gradient' && !resolved.bgColor) {
    bg = '#0F172A';
    accent = resolved.accentColor || '#38BDF8';
    text = resolved.textColor || '#FFFFFF';
    backgroundImage = `linear-gradient(135deg, ${bg} 0%, ${accent}44 100%)`;
  } else if (template === 'gradient' && resolved.bgColor) {
    backgroundImage = `linear-gradient(135deg, ${bg} 0%, ${accent}44 100%)`;
  } else if (template === 'midnight') {
    bg = resolved.bgColor || '#09090B';
    text = resolved.textColor || '#FAFAFA';
    accent = resolved.accentColor || '#A855F7';
    backgroundImage = `radial-gradient(circle at 85% 15%, ${accent}38 0%, transparent 55%)`;
  } else if (template === 'executive' && !resolved.bgColor) {
    bg = '#111827';
    text = resolved.textColor || '#F9FAFB';
    accent = resolved.accentColor || '#38BDF8';
  } else if (template === 'editorial' && !resolved.bgColor) {
    bg = '#FAF8F5';
    text = resolved.textColor || '#1C1917';
    accent = resolved.accentColor || '#B45309';
  }

  const isLight = isLightHexColor(bg);
  const mutedText = isLight ? 'rgba(15, 23, 42, 0.68)' : 'rgba(255, 255, 255, 0.72)';
  const borderColor = isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.16)';
  const cardFont = getFontCssFamily(resolved.fontId, 'var(--font-sans), Inter, sans-serif');

  const cornerRadiusClass =
    resolved.cornerStyle === 'sharp'
      ? 'rounded-[4px]'
      : resolved.cornerStyle === 'pill'
        ? 'rounded-[28px]'
        : 'rounded-[18px]';

  const cleanUsername = (username || 'creator').toLowerCase().trim();
  const initials = (displayName || cleanUsername).slice(0, 2).toUpperCase();

  return (
    <div
      className={`w-full aspect-[1.7/1] p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between shadow-md select-none border ${cornerRadiusClass}`}
      style={{
        backgroundColor: bg,
        backgroundImage,
        color: text,
        borderColor,
        fontFamily: cardFont,
      }}
    >
      {/* Template-specific geometric accents */}
      {template === 'executive' && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5"
          style={{ backgroundColor: accent }}
        />
      )}
      {template === 'classic' && (
        <div
          className={`absolute w-40 h-40 rounded-full pointer-events-none blur-2xl ${
            isLight ? '-bottom-16 -left-16 opacity-10' : '-top-14 -right-14 opacity-20'
          }`}
          style={{ backgroundColor: accent }}
        />
      )}
      {template === 'editorial' && (
        <div
          className="absolute inset-2.5 pointer-events-none border"
          style={{
            borderColor: `${accent}45`,
            borderRadius:
              resolved.cornerStyle === 'sharp'
                ? '2px'
                : resolved.cornerStyle === 'pill'
                  ? '22px'
                  : '12px',
          }}
        />
      )}

      {/* Top Row: Identity + Badge + QR */}
      <div className="flex items-start justify-between gap-3 relative z-10 pl-1">
        <div className="flex items-center gap-3 min-w-0">
          {resolved.showAvatar &&
            (avatarUrl && !avatarFailed ? (
              <img
                src={avatarUrl}
                alt={displayName || cleanUsername}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover shrink-0 border-2 shadow-xs"
                style={{ borderColor: accent }}
              />
            ) : (
              <div
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-[16px] shrink-0 border-2"
                style={{
                  backgroundColor: accent,
                  color: isLightHexColor(accent) ? '#0A0A0A' : '#FFFFFF',
                  borderColor,
                }}
              >
                {initials}
              </div>
            ))}

          <div className="min-w-0">
            {resolved.badgeText && (
              <span
                className="inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1"
                style={{
                  backgroundColor: `${accent}22`,
                  color: accent,
                  border: `1px solid ${accent}44`,
                }}
              >
                {resolved.badgeText}
              </span>
            )}
            <h4 className="text-[15px] sm:text-[17px] font-bold leading-tight truncate">
              {displayName || cleanUsername}
            </h4>
            <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] leading-tight mt-0.5">
              {resolved.role ? (
                <span className="font-medium truncate" style={{ color: accent }}>
                  {resolved.role}
                </span>
              ) : (
                <span className="font-mono" style={{ color: mutedText }}>
                  @{cleanUsername}
                </span>
              )}
              {resolved.role && resolved.companyOrLocation && (
                <span style={{ color: mutedText }}>·</span>
              )}
              {resolved.companyOrLocation && (
                <span className="truncate inline-flex items-center gap-0.5" style={{ color: mutedText }}>
                  <MapPin size={10} />
                  {resolved.companyOrLocation}
                </span>
              )}
            </div>
          </div>
        </div>

        {resolved.showQr && qrDataUrl && (
          <div className="w-12 h-12 sm:w-13 sm:h-13 bg-white p-1 rounded-lg shrink-0 shadow-xs border border-black/10">
            <img src={qrDataUrl} alt="QR code" className="w-full h-full object-contain rounded" />
          </div>
        )}
      </div>

      {/* Middle Row: Bio & Contact Chips */}
      <div className="relative z-10 pl-1 my-auto py-1 flex flex-col gap-1.5">
        {bio && (
          <p className="text-[11px] sm:text-[12px] leading-snug line-clamp-2" style={{ color: mutedText }}>
            {bio}
          </p>
        )}

        {(resolved.contactEmail || resolved.contactPhone) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px]" style={{ color: mutedText }}>
            {resolved.contactEmail && (
              <span className="inline-flex items-center gap-1 truncate max-w-full">
                <Mail size={10} style={{ color: accent }} />
                <span className="truncate">{resolved.contactEmail}</span>
              </span>
            )}
            {resolved.contactPhone && (
              <span className="inline-flex items-center gap-1 truncate">
                <Phone size={10} style={{ color: accent }} />
                <span>{resolved.contactPhone}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Footer Bar */}
      <div
        className="pt-2 border-t flex items-center justify-between text-[10px] sm:text-[11px] font-mono relative z-10 pl-1"
        style={{ borderColor, color: mutedText }}
      >
        <span className="font-semibold tracking-tight" style={{ color: text }}>
          iveo
        </span>
        <span className="truncate">iveo.site/{cleanUsername}</span>
      </div>
    </div>
  );
};
