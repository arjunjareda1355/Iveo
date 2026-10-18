import React from 'react';
import { Link2, ShoppingBag, Globe, Mail, Calendar } from 'lucide-react';
import { Vibe } from '../../lib/vibes';
import { InstagramIcon, PlayIcon, MusicIcon, MailIcon } from './SocialIcons';

export interface PhoneProfile {
  name: string;
  handle: string;
  bio?: string;
  avatarUrl?: string | null;
  initials?: string;
  links?: readonly string[];
}

interface PhonePageProps {
  vibe: Vibe;
  profile?: PhoneProfile;
  buttonRadiusOverride?: number;
  scale?: number; // relative to 300px base
}

const BUTTON_ICONS = [Link2, ShoppingBag, Globe, Mail, Calendar];

export const PhonePage: React.FC<PhonePageProps> = React.memo(
  ({ vibe, profile, buttonRadiusOverride, scale = 1 }) => {
    const { tokens, persona } = vibe;
    const effectiveRadius =
      buttonRadiusOverride !== undefined ? buttonRadiusOverride : tokens.buttonRadius;

    // Use profile override or persona
    const displayName = profile?.name ?? persona.name;
    const displayHandle = profile?.handle ?? persona.handle;
    const displayBio = profile ? (profile.bio || 'Your bio goes here.') : persona.bio;
    const displayLinks = profile?.links ?? persona.links;
    const displayInitials =
      profile?.initials ??
      (profile ? (profile.name.slice(0, 2).toUpperCase() || 'IV') : persona.initials);

    return (
      <div
        className="w-full h-full flex flex-col items-center select-none overflow-hidden"
        style={{
          backgroundColor: tokens.bg,
          color: tokens.text,
          fontFamily: vibe.fontFamily,
          paddingLeft: `${Math.round(20 * scale)}px`,
          paddingRight: `${Math.round(20 * scale)}px`,
        }}
      >
        {/* Avatar */}
        <div
          className="rounded-full flex items-center justify-center shrink-0 font-semibold shadow-xs overflow-hidden"
          style={{
            width: `${Math.round(72 * scale)}px`,
            height: `${Math.round(72 * scale)}px`,
            marginTop: `${Math.round(18 * scale)}px`,
            backgroundColor: tokens.avatarBg,
            color: tokens.avatarText,
            fontSize: `${Math.round(26 * scale)}px`,
            fontFamily: "'Geist', sans-serif",
          }}
        >
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            displayInitials
          )}
        </div>

        {/* Name */}
        <div
          className="font-semibold text-center leading-tight truncate w-full"
          style={{
            fontSize: `${Math.round(18 * scale)}px`,
            marginTop: `${Math.round(14 * scale)}px`,
          }}
        >
          {displayName}
        </div>

        {/* Handle */}
        <div
          className="text-center font-mono truncate w-full"
          style={{
            color: tokens.muted,
            fontSize: `${Math.round(13 * scale)}px`,
            marginTop: `${Math.round(2 * scale)}px`,
          }}
        >
          @{displayHandle}
        </div>

        {/* Bio */}
        <p
          className="text-center line-clamp-2 max-w-[240px] leading-snug"
          style={{
            color: tokens.text,
            opacity: 0.85,
            fontSize: `${Math.round(13 * scale)}px`,
            marginTop: `${Math.round(10 * scale)}px`,
          }}
        >
          {displayBio}
        </p>

        {/* Links */}
        <div
          className="w-full flex flex-col"
          style={{
            marginTop: `${Math.round(20 * scale)}px`,
            gap: `${Math.round(10 * scale)}px`,
          }}
        >
          {displayLinks.map((linkTitle, idx) => {
            const Icon = BUTTON_ICONS[idx % BUTTON_ICONS.length];
            return (
              <div
                key={idx}
                className="w-full relative flex items-center justify-center truncate transition-all duration-150"
                style={{
                  height: `${Math.round(44 * scale)}px`,
                  paddingLeft: `${Math.round(14 * scale)}px`,
                  paddingRight: `${Math.round(14 * scale)}px`,
                  backgroundColor: tokens.buttonBg,
                  color: tokens.buttonText,
                  borderRadius: `${Math.round(effectiveRadius * scale)}px`,
                  border: tokens.buttonBorder
                    ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
                    : 'none',
                  boxShadow: tokens.buttonShadow || 'none',
                  fontSize: `${Math.max(12, Math.round(14 * scale))}px`,
                  fontWeight: 500,
                }}
              >
                <span
                  className="absolute left-3.5 flex items-center shrink-0 opacity-70"
                  style={{ width: `${Math.round(16 * scale)}px` }}
                >
                  <Icon size={Math.round(16 * scale)} strokeWidth={1.5} />
                </span>
                <span className="truncate px-5 text-center leading-none">
                  {linkTitle}
                </span>
              </div>
            );
          })}
        </div>

        {/* Social Row */}
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            marginTop: `${Math.round(18 * scale)}px`,
            gap: `${Math.round(16 * scale)}px`,
            color: tokens.text,
            opacity: 0.75,
          }}
        >
          <InstagramIcon size={Math.round(18 * scale)} />
          <PlayIcon size={Math.round(18 * scale)} />
          <MusicIcon size={Math.round(18 * scale)} />
          <MailIcon size={Math.round(18 * scale)} />
        </div>

        {/* Footer mark */}
        <div
          className="flex items-center justify-center shrink-0 pb-6"
          style={{
            marginTop: `${Math.round(16 * scale)}px`,
            color: tokens.muted,
            gap: `${Math.round(6 * scale)}px`,
          }}
        >
          <svg
            width={Math.round(14 * scale)}
            height={Math.round(14 * scale)}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect width="24" height="24" rx="7" fill="currentColor" />
            <circle cx="12" cy="7.25" r="1.75" fill={tokens.bg} />
            <rect x="10.5" y="10.5" width="3" height="8" rx="1.5" fill={tokens.bg} />
          </svg>
          <span
            className="font-semibold tracking-tight"
            style={{ fontSize: `${Math.round(11 * scale)}px` }}
          >
            ivio
          </span>
        </div>
      </div>
    );
  }
);

PhonePage.displayName = 'PhonePage';
