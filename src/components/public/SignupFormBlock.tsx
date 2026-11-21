import React, { useState } from 'react';
import { PageBlock } from '../../data/types';
import { Vibe } from '../../lib/vibes';
import { copy } from '../../content/copy';
import { submitContact } from '../../data/publicApi';
import { Check } from 'lucide-react';
import {
  resolveCardBorderRadius,
  resolveButtonControlRadius,
} from '../../lib/preferences';
import { getBlockContrastPalette } from '../../lib/blockTheme';
import { Loader } from '../ui/Loader';

interface SignupFormBlockProps {
  block: PageBlock;
  vibe: Vibe;
  ownerName: string;
  username: string;
  buttonRadiusOverride?: number;
  buttonFontFamily?: string;
  surfaceStyle?: React.CSSProperties;
}

export const SignupFormBlock: React.FC<SignupFormBlockProps> = ({
  block,
  vibe,
  ownerName,
  username,
  buttonRadiusOverride,
  buttonFontFamily,
  surfaceStyle,
}) => {
  const cfg = block.signup;
  const collect = cfg?.collect || 'email';
  const formStyle = cfg?.style || 'classic';
  const heading = cfg?.heading || block.title || copy.signup.dashboard.defaultHeading;
  const description = cfg?.description;
  const buttonLabel = cfg?.button || copy.signup.dashboard.defaultButton;

  const defaultConsentSentence = copy.signup.dashboard.defaultConsent.replace(
    '{name}',
    ownerName || username || 'the creator'
  );
  const consentSentence = cfg?.consent || defaultConsentSentence;

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [hpNote, setHpNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const tokens = vibe.tokens;
  const palette = getBlockContrastPalette(surfaceStyle, tokens);
  const resolvedSurface: React.CSSProperties = surfaceStyle || {
    backgroundColor: tokens.buttonBg,
    borderColor: tokens.buttonBorder,
    borderWidth: tokens.buttonBorderWidth || 1,
    borderStyle: 'solid',
    color: palette.fg,
  };
  const effectiveRadius =
    buttonRadiusOverride !== undefined
      ? buttonRadiusOverride
      : vibe.tokens.buttonRadius;
  const cardRadius = resolveCardBorderRadius(effectiveRadius, 1, 'card');
  const innerRadius = resolveCardBorderRadius(effectiveRadius, 1, 'inner');
  const controlRadius = resolveButtonControlRadius(effectiveRadius, 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!consent) {
      setErrorMessage(copy.signup.visitor.consentRequired);
      return;
    }

    if (collect === 'email' || collect === 'both') {
      if (!email.trim() || !email.includes('@')) {
        setErrorMessage(copy.signup.visitor.invalidEmail);
        return;
      }
    }

    if (collect === 'phone' || collect === 'both') {
      const cleanPhone = phone.trim();
      if (!cleanPhone || cleanPhone.length < 5) {
        setErrorMessage(copy.signup.visitor.invalidPhone);
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await submitContact({
        username,
        linkId: block.id,
        formTitle: heading,
        email: (collect === 'email' || collect === 'both') ? email.trim() : null,
        phone: (collect === 'phone' || collect === 'both') ? phone.trim() : null,
        consent,
        hp: hpNote,
      });

      if (res.ok) {
        setIsSuccess(true);
        setEmail('');
        setPhone('');
        setConsent(false);
      } else {
        if (res.reason === 'consent_required') {
          setErrorMessage(copy.signup.visitor.consentRequired);
        } else if (res.reason === 'invalid_email') {
          setErrorMessage(copy.signup.visitor.invalidEmail);
        } else if (res.reason === 'invalid_phone') {
          setErrorMessage(copy.signup.visitor.invalidPhone);
        } else if (res.reason === 'rate_limited') {
          setErrorMessage(copy.signup.visitor.rateLimited);
        } else if (res.reason === 'unavailable') {
          setErrorMessage(copy.signup.visitor.unavailable);
        } else {
          setErrorMessage(copy.signup.visitor.network);
        }
      }
    } catch {
      setErrorMessage(copy.signup.visitor.network);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMinimal = formStyle === 'minimal';
  const isCompact = formStyle === 'compact';
  const isSpotlight = formStyle === 'spotlight';

  const containerStyle: React.CSSProperties = isMinimal
    ? {
        backgroundColor: 'transparent',
        border: `1.5px solid ${tokens.buttonBorder || palette.inputBorder}`,
        borderRadius: `${cardRadius}px`,
        color: tokens.text,
        fontFamily: buttonFontFamily || vibe.fontFamily,
      }
    : isSpotlight
      ? {
          ...resolvedSurface,
          borderRadius: `${cardRadius}px`,
          borderWidth: tokens.buttonBorderWidth || '1.5px',
          boxShadow: `0 10px 28px -8px rgba(0,0,0,0.22)`,
          color: palette.fg,
          fontFamily: buttonFontFamily || vibe.fontFamily,
        }
      : {
          ...resolvedSurface,
          borderRadius: `${cardRadius}px`,
          color: palette.fg,
          fontFamily: buttonFontFamily || vibe.fontFamily,
        };

  const titleColor = isMinimal ? tokens.text : palette.fg;
  const mutedColor = isMinimal ? tokens.muted : palette.muted;
  const btnBgColor = isMinimal ? (tokens.buttonBg === 'transparent' ? tokens.text : tokens.buttonBg) : palette.btnBg;
  const btnTextColor = isMinimal ? (tokens.buttonBg === 'transparent' ? tokens.bg : tokens.buttonText) : palette.btnText;

  return (
    <div
      className={`w-full select-none transition-all ${
        isCompact ? 'p-3.5 sm:p-4' : 'p-5 sm:p-6'
      }`}
      style={containerStyle}
    >
      {isSuccess ? (
        <div className="py-4 flex flex-col items-center text-center animate-fade-in">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-2.5"
            style={{
              backgroundColor: btnBgColor,
              color: btnTextColor,
            }}
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
          </div>
          <p className="font-medium text-sm" style={{ color: titleColor }}>
            {copy.signup.visitor.success}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={`flex flex-col ${isCompact ? 'gap-2.5' : 'gap-3'}`}>
          <div className={isCompact || isMinimal ? 'text-left' : 'text-center mb-1'}>
            {isSpotlight && (
              <span
                className="inline-flex items-center px-2.5 py-0.5 mb-2 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor: `${palette.btnBg}1F`,
                  color: palette.fg,
                  border: `1px solid ${palette.inputBorder}`,
                }}
              >
                Stay updated
              </span>
            )}
            <h3
              className={`${isSpotlight ? 'text-[17px]' : isCompact ? 'text-[14px]' : 'text-base'} font-semibold tracking-tight`}
              style={{ color: titleColor }}
            >
              {heading}
            </h3>
            {description && (
              <p
                className={`text-xs mt-1 ${isCompact || isMinimal ? '' : 'max-w-sm mx-auto'}`}
                style={{ color: mutedColor }}
              >
                {description}
              </p>
            )}
          </div>

          {/* Off-screen honeypot field */}
          <div
            style={{
              position: 'absolute',
              left: '-10000px',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
            }}
            aria-hidden="true"
          >
            <label htmlFor={`hp-${block.id}`}>Leave blank</label>
            <input
              id={`hp-${block.id}`}
              name="hp_note"
              type="text"
              value={hpNote}
              onChange={(e) => setHpNote(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {/* Email & Phone fields (Compact inline row when compact + single field, else stacked/minimal) */}
          <div className={isCompact && collect !== 'both' ? 'flex flex-col sm:flex-row gap-2' : 'flex flex-col gap-2.5'}>
            {(collect === 'email' || collect === 'both') && (
              <div className="flex-1 min-w-0">
                {!isCompact && (
                  <label
                    htmlFor={`email-${block.id}`}
                    className="block text-xs font-medium mb-1"
                    style={{ color: mutedColor }}
                  >
                    {copy.signup.visitor.emailLabel}
                  </label>
                )}
                <input
                  id={`email-${block.id}`}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  disabled={isSubmitting}
                  autoComplete="email"
                  placeholder={copy.signup.visitor.emailPlaceholder}
                  className={`w-full px-3 text-sm focus:outline-none transition-colors ${isCompact ? 'h-9' : 'h-10'}`}
                  style={{
                    color: titleColor,
                    backgroundColor: isMinimal ? 'transparent' : palette.inputBg,
                    borderRadius: isMinimal ? '0px' : `${innerRadius}px`,
                    border: isMinimal ? 'none' : `1px solid ${palette.inputBorder}`,
                    borderBottom: isMinimal ? `1.5px solid ${palette.inputBorder}` : `1px solid ${palette.inputBorder}`,
                  }}
                />
              </div>
            )}

            {(collect === 'phone' || collect === 'both') && (
              <div className="flex-1 min-w-0">
                {!isCompact && (
                  <label
                    htmlFor={`phone-${block.id}`}
                    className="block text-xs font-medium mb-1"
                    style={{ color: mutedColor }}
                  >
                    {copy.signup.visitor.phoneLabel}
                  </label>
                )}
                <input
                  id={`phone-${block.id}`}
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  disabled={isSubmitting}
                  autoComplete="tel"
                  placeholder={copy.signup.visitor.phonePlaceholder}
                  className={`w-full px-3 text-sm focus:outline-none transition-colors ${isCompact ? 'h-9' : 'h-10'}`}
                  style={{
                    color: titleColor,
                    backgroundColor: isMinimal ? 'transparent' : palette.inputBg,
                    borderRadius: isMinimal ? '0px' : `${innerRadius}px`,
                    border: isMinimal ? 'none' : `1px solid ${palette.inputBorder}`,
                    borderBottom: isMinimal ? `1.5px solid ${palette.inputBorder}` : `1px solid ${palette.inputBorder}`,
                  }}
                />
              </div>
            )}

            {isCompact && collect !== 'both' && (
              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting || undefined}
                className="relative h-9 px-4 shrink-0 font-medium text-xs sm:text-sm transition-transform duration-120 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center cursor-pointer shadow-sm"
                style={{
                  backgroundColor: btnBgColor,
                  color: btnTextColor,
                  borderRadius: `${controlRadius}px`,
                }}
              >
                <span className={isSubmitting ? 'opacity-0' : undefined}>
                  {buttonLabel}
                </span>
                {isSubmitting && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Loader size="xs" />
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Consent Checkbox */}
          <div className="pt-0.5">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isSubmitting}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-ink focus:ring-ink"
              />
              <span className="leading-snug" style={{ color: mutedColor }}>
                {consentSentence}
              </span>
            </label>
          </div>

          {errorMessage && (
            <p className="text-xs text-red-500 font-medium text-center">
              {errorMessage}
            </p>
          )}

          {/* Full-width Submit Button for non-compact or 'both' collect */}
          {(!isCompact || collect === 'both') && (
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting || undefined}
              className={`relative w-full px-4 mt-1 font-medium text-sm transition-transform duration-120 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center cursor-pointer shadow-sm ${
                isSpotlight ? 'h-11 font-semibold' : 'h-10'
              }`}
              style={{
                backgroundColor: btnBgColor,
                color: btnTextColor,
                borderRadius: `${controlRadius}px`,
              }}
            >
              <span className={isSubmitting ? 'opacity-0' : undefined}>
                {buttonLabel}
              </span>
              {isSubmitting && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader size="xs" />
                </span>
              )}
            </button>
          )}

          {/* Privacy line */}
          <div
            className={`${isCompact || isMinimal ? 'text-left' : 'text-center'} pt-0.5 text-[11px] opacity-65`}
            style={{ color: mutedColor }}
          >
            <span>
              {copy.signup.visitor.privacyPrefix.replace(
                '{name}',
                ownerName || username || 'creator'
              )}
            </span>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-100"
            >
              Privacy Policy
            </a>
            .
          </div>
        </form>
      )}
    </div>
  );
};
