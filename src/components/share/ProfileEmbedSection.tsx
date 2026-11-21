import React, { useState } from 'react';
import { Check, Code2, Copy, ExternalLink, ArrowUpRight } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  buildProfileEmbedIframeCode,
  buildProfileEmbedUrl,
  getEmbedStyleMeta,
  PROFILE_EMBED_STYLES,
  PROFILE_EMBED_THEMES,
  ProfileEmbedStyle,
  ProfileEmbedTheme,
} from '../../lib/profileEmbed';
import { VIBES } from '../../lib/vibes';
import { VerifiedTick } from '../ui/VerifiedTick';

interface ProfileEmbedSectionProps {
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string | null;
  vibeId?: string;
  isPro?: boolean;
  embedStyle?: ProfileEmbedStyle;
  onEmbedStyleChange?: (next: ProfileEmbedStyle) => void;
  embedTheme?: ProfileEmbedTheme;
  onEmbedThemeChange?: (next: ProfileEmbedTheme) => void;
  hideActions?: boolean;
}

export const ProfileEmbedSection: React.FC<ProfileEmbedSectionProps> = ({
  username,
  displayName,
  bio,
  avatarUrl,
  vibeId,
  isPro = false,
  embedStyle: controlledStyle,
  onEmbedStyleChange,
  embedTheme: controlledTheme,
  onEmbedThemeChange,
  hideActions = false,
}) => {
  const [internalStyle, setInternalStyle] = useState<ProfileEmbedStyle>('card');
  const [internalTheme, setInternalTheme] = useState<ProfileEmbedTheme>('auto');
  const [copiedCode, setCopiedCode] = useState(false);

  const embedStyle = controlledStyle ?? internalStyle;
  const setEmbedStyle = (next: ProfileEmbedStyle) => {
    if (controlledStyle === undefined) setInternalStyle(next);
    onEmbedStyleChange?.(next);
  };

  const embedTheme = controlledTheme ?? internalTheme;
  const setEmbedTheme = (next: ProfileEmbedTheme) => {
    if (controlledTheme === undefined) setInternalTheme(next);
    onEmbedThemeChange?.(next);
  };

  const cleanUsername = (username || 'creator').replace(/^@+/, '').toLowerCase().trim();
  const titleName = displayName || `@${cleanUsername}`;
  const activeVibe = VIBES.find((v) => v.id === vibeId) || VIBES[0];

  const embedSrc = buildProfileEmbedUrl(cleanUsername, {
    style: embedStyle,
    theme: embedTheme,
  });
  const iframeSnippet = buildProfileEmbedIframeCode(cleanUsername, {
    style: embedStyle,
    theme: embedTheme,
    displayName: titleName,
    origin: 'https://iveo.site',
  });
  const styleMeta = getEmbedStyleMeta(embedStyle);

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(iframeSnippet);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {}
  };

  // Compute live preview palette matching EmbedProfilePage
  const previewPalette =
    embedTheme === 'light'
      ? {
          bg: '#FFFFFF',
          text: '#0A0A0A',
          muted: '#52525B',
          btnBg: '#0A0A0A',
          btnText: '#FFFFFF',
          border: 'rgba(10,10,10,0.12)',
          isDark: false,
        }
      : embedTheme === 'dark'
        ? {
            bg: '#0B0F17',
            text: '#FAFAFA',
            muted: '#A1A1AA',
            btnBg: '#FFFFFF',
            btnText: '#0A0A0A',
            border: 'rgba(255,255,255,0.14)',
            isDark: true,
          }
        : embedTheme === 'glass'
          ? {
              bg: 'rgba(15, 23, 42, 0.78)',
              text: '#FFFFFF',
              muted: 'rgba(255,255,255,0.75)',
              btnBg: 'rgba(255,255,255,0.16)',
              btnText: '#FFFFFF',
              border: 'rgba(255,255,255,0.22)',
              isDark: true,
            }
          : {
              bg: activeVibe.tokens.bg,
              text: activeVibe.tokens.text,
              muted: activeVibe.tokens.muted,
              btnBg:
                activeVibe.tokens.buttonBg === 'transparent'
                  ? activeVibe.tokens.text
                  : activeVibe.tokens.buttonBg,
              btnText:
                activeVibe.tokens.buttonBg === 'transparent'
                  ? activeVibe.tokens.bg
                  : activeVibe.tokens.buttonText,
              border: activeVibe.tokens.buttonBorder || 'rgba(128,128,128,0.2)',
              isDark:
                activeVibe.tokens.text.toUpperCase() === '#FFFFFF' ||
                activeVibe.tokens.bg.toLowerCase().startsWith('#0') ||
                activeVibe.tokens.bg.toLowerCase().startsWith('#1'),
            };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] font-semibold text-ink">Style</span>
        <p className="text-[13px] text-muted">
          Add your iveo profile to Notion, portfolios, blogs, or any website.
        </p>
      </div>

      {/* Compact Style Selector Pills */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Embed style">
          {PROFILE_EMBED_STYLES.map((opt) => {
            const selected = embedStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setEmbedStyle(opt.id)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all cursor-pointer ${
                  selected
                    ? 'bg-ink text-surface border-ink shadow-xs'
                    : 'bg-surface border-border text-muted hover:text-ink hover:border-border-strong'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="text-[12px] text-muted leading-snug">{styleMeta.description}</p>
      </div>

      {/* Theme Selector */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted">Theme</span>
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface-2 border border-border">
          {PROFILE_EMBED_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setEmbedTheme(t.id)}
              className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                embedTheme === t.id
                  ? 'bg-ink text-surface'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Preview Canvas */}
      <div className="rounded-2xl border border-border bg-surface-2/80 p-4 flex flex-col items-center justify-center min-h-[132px]">
        {embedStyle === 'badge' ? (
          <div
            className="w-full max-w-[300px] flex items-center justify-between gap-2.5 px-3 py-2 rounded-full border"
            style={{
              backgroundColor: previewPalette.bg,
              color: previewPalette.text,
              borderColor: previewPalette.border,
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={titleName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[12px] shrink-0"
                  style={{ backgroundColor: previewPalette.btnBg, color: previewPalette.btnText }}
                >
                  {titleName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[12px] font-semibold truncate">{titleName}</span>
                  {isPro && <VerifiedTick size={12} onDark={previewPalette.isDark} />}
                </div>
                <span className="text-[10px] font-mono block truncate" style={{ color: previewPalette.muted }}>
                  iveo.site/@{cleanUsername}
                </span>
              </div>
            </div>
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-semibold inline-flex items-center gap-0.5 shrink-0"
              style={{ backgroundColor: previewPalette.btnBg, color: previewPalette.btnText }}
            >
              Open <ArrowUpRight size={10} />
            </span>
          </div>
        ) : embedStyle === 'minimal' ? (
          <div
            className="w-full rounded-xl border p-3.5 flex flex-col gap-2"
            style={{
              backgroundColor: previewPalette.bg,
              color: previewPalette.text,
              borderColor: previewPalette.border,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={titleName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px] shrink-0"
                    style={{ backgroundColor: previewPalette.btnBg, color: previewPalette.btnText }}
                  >
                    {titleName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] font-semibold truncate">{titleName}</span>
                    {isPro && <VerifiedTick size={12} onDark={previewPalette.isDark} />}
                  </div>
                  <span className="text-[11px] font-mono block truncate" style={{ color: previewPalette.muted }}>
                    @{cleanUsername}
                  </span>
                </div>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
                style={{ backgroundColor: previewPalette.btnBg, color: previewPalette.btnText }}
              >
                Visit
              </span>
            </div>
            {bio && (
              <p className="text-[11.5px] line-clamp-1" style={{ color: previewPalette.muted }}>
                {bio}
              </p>
            )}
          </div>
        ) : embedStyle === 'spotlight' ? (
          <div
            className="w-full max-w-[310px] rounded-2xl border overflow-hidden flex flex-col"
            style={{
              backgroundColor: previewPalette.bg,
              color: previewPalette.text,
              borderColor: previewPalette.border,
            }}
          >
            <div
              className="h-12 w-full relative shrink-0"
              style={{
                background: `linear-gradient(135deg, ${previewPalette.btnBg} 0%, ${previewPalette.text}44 100%)`,
                opacity: 0.9,
              }}
            />
            <div className="px-4 pb-4 -mt-6 flex flex-col items-center text-center gap-1.5 relative z-10">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={titleName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover border-2"
                  style={{ borderColor: previewPalette.bg }}
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-[15px] border-2"
                  style={{
                    backgroundColor: previewPalette.btnBg,
                    color: previewPalette.btnText,
                    borderColor: previewPalette.bg,
                  }}
                >
                  {titleName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex items-center gap-1">
                <span className="text-[14px] font-semibold">{titleName}</span>
                {isPro && <VerifiedTick size={13} onDark={previewPalette.isDark} />}
              </div>
              <span className="text-[11px] font-mono -mt-1" style={{ color: previewPalette.muted }}>
                @{cleanUsername}
              </span>
              {bio && (
                <p className="text-[11px] line-clamp-2" style={{ color: previewPalette.muted }}>
                  {bio}
                </p>
              )}
              <div className="w-full grid grid-cols-2 gap-1.5 mt-1.5">
                <div
                  className="h-8 rounded-full flex items-center justify-center text-[11px] font-semibold col-span-2"
                  style={{ backgroundColor: previewPalette.btnBg, color: previewPalette.btnText }}
                >
                  Open full page
                </div>
              </div>
            </div>
          </div>
        ) : embedStyle === 'showcase' ? (
          <div
            className="w-full max-w-[320px] rounded-2xl border p-3.5 flex flex-col gap-2.5"
            style={{
              backgroundColor: previewPalette.bg,
              color: previewPalette.text,
              borderColor: previewPalette.border,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={titleName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[13px] shrink-0"
                    style={{ backgroundColor: previewPalette.btnBg, color: previewPalette.btnText }}
                  >
                    {titleName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] font-semibold truncate">{titleName}</span>
                    {isPro && <VerifiedTick size={12} onDark={previewPalette.isDark} />}
                  </div>
                  <span className="text-[10.5px] font-mono block truncate" style={{ color: previewPalette.muted }}>
                    iveo.site/@{cleanUsername}
                  </span>
                </div>
              </div>
              <span
                className="px-2.5 py-1 rounded-lg text-[10.5px] font-semibold shrink-0"
                style={{ backgroundColor: previewPalette.btnBg, color: previewPalette.btnText }}
              >
                Visit
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div
                className="h-11 rounded-xl border px-2.5 flex items-center justify-between text-[11px] font-medium"
                style={{ borderColor: previewPalette.border }}
              >
                <span className="truncate">Top link</span>
                <ArrowUpRight size={11} style={{ color: previewPalette.muted }} />
              </div>
              <div
                className="h-11 rounded-xl border px-2.5 flex items-center justify-between text-[11px] font-medium"
                style={{ borderColor: previewPalette.border }}
              >
                <span className="truncate">Portfolio</span>
                <ArrowUpRight size={11} style={{ color: previewPalette.muted }} />
              </div>
            </div>
          </div>
        ) : (
          <div
            className="w-full max-w-[300px] rounded-xl border p-4 flex flex-col items-center text-center gap-2"
            style={{
              backgroundColor: previewPalette.bg,
              color: previewPalette.text,
              borderColor: previewPalette.border,
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={titleName}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-[15px]"
                style={{ backgroundColor: previewPalette.btnBg, color: previewPalette.btnText }}
              >
                {titleName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="text-[14px] font-semibold">{titleName}</span>
              {isPro && <VerifiedTick size={13} onDark={previewPalette.isDark} />}
            </div>
            <span className="text-[11px] font-mono -mt-1.5" style={{ color: previewPalette.muted }}>
              @{cleanUsername}
            </span>
            {bio && (
              <p className="text-[11.5px] line-clamp-2" style={{ color: previewPalette.muted }}>
                {bio}
              </p>
            )}
            <div className="w-full flex flex-col gap-1.5 mt-1">
              <div
                className="w-full h-8 rounded-lg flex items-center justify-center text-[11.5px] font-medium"
                style={{ backgroundColor: previewPalette.btnBg, color: previewPalette.btnText }}
              >
                Open page
              </div>
              {embedStyle === 'full' && (
                <div
                  className="w-full h-7 rounded-lg opacity-20"
                  style={{ backgroundColor: previewPalette.btnBg }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Embed Code Box */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-ink inline-flex items-center gap-1.5">
            <Code2 size={14} />
            <span>HTML embed code</span>
          </span>
          <span className="text-[12px] text-muted font-mono">
            {styleMeta.defaultHeight}px · max {styleMeta.maxWidth}
          </span>
        </div>
        <textarea
          readOnly
          value={iframeSnippet}
          rows={3}
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          aria-label="HTML iframe embed code"
          className="w-full p-2.5 rounded-xl border border-border bg-surface-2 font-mono text-[11px] text-ink resize-none focus-visible:outline-2 focus-visible:outline-ink"
        />
      </div>

      {!hideActions && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" size="md" onClick={handleCopySnippet} fullWidth>
            {copiedCode ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedCode ? 'Copied code' : 'Copy embed code'}</span>
          </Button>
          <Button
            as="a"
            href={embedSrc}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="md"
            fullWidth
          >
            <ExternalLink size={14} />
            <span>Live preview</span>
          </Button>
        </div>
      )}
    </div>
  );
};
