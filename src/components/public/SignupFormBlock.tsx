import React, { useState } from 'react';
import { PageBlock } from '../../data/types';
import { Vibe } from '../../lib/vibes';
import { copy } from '../../content/copy';
import { submitContact } from '../../data/publicApi';
import { Check } from 'lucide-react';

interface SignupFormBlockProps {
  block: PageBlock;
  vibe: Vibe;
  ownerName: string;
  username: string;
  buttonRadiusOverride?: number;
}

export const SignupFormBlock: React.FC<SignupFormBlockProps> = ({
  block,
  vibe,
  ownerName,
  username,
  buttonRadiusOverride,
}) => {
  const cfg = block.signup;
  const collect = cfg?.collect || 'email';
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
  const effectiveRadius =
    buttonRadiusOverride !== undefined
      ? buttonRadiusOverride
      : vibe.tokens.buttonRadius;
  const cardRadius = Math.min(16, effectiveRadius);

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

  return (
    <div
      className="w-full select-none transition-all p-5 sm:p-6"
      style={{
        border: tokens.buttonBorder
          ? `1px solid ${tokens.buttonBorder}`
          : '1px solid rgba(0,0,0,0.1)',
        borderRadius: `${cardRadius}px`,
        backgroundColor: tokens.buttonBg ? `${tokens.buttonBg}0d` : 'transparent',
        color: tokens.text,
        fontFamily: vibe.fontFamily,
      }}
    >
      {isSuccess ? (
        <div className="py-4 flex flex-col items-center text-center animate-fade-in">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center mb-2.5"
            style={{
              backgroundColor: tokens.buttonBg,
              color: tokens.buttonText,
            }}
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
          </div>
          <p className="font-medium text-sm" style={{ color: tokens.text }}>
            {copy.signup.visitor.success}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="text-center mb-1">
            <h3
              className="text-base font-semibold tracking-tight"
              style={{ color: tokens.text }}
            >
              {heading}
            </h3>
            {description && (
              <p
                className="text-xs opacity-75 mt-1 max-w-sm mx-auto"
                style={{ color: tokens.text }}
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

          {/* Email field */}
          {(collect === 'email' || collect === 'both') && (
            <div>
              <label
                htmlFor={`email-${block.id}`}
                className="block text-xs font-medium mb-1 opacity-80"
                style={{ color: tokens.text }}
              >
                {copy.signup.visitor.emailLabel}
              </label>
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
                className="w-full h-10 px-3 text-sm bg-transparent rounded-lg focus:outline-none transition-colors"
                style={{
                  color: tokens.text,
                  border: tokens.buttonBorder
                    ? `1px solid ${tokens.buttonBorder}`
                    : '1px solid rgba(0,0,0,0.2)',
                }}
              />
            </div>
          )}

          {/* Phone field */}
          {(collect === 'phone' || collect === 'both') && (
            <div>
              <label
                htmlFor={`phone-${block.id}`}
                className="block text-xs font-medium mb-1 opacity-80"
                style={{ color: tokens.text }}
              >
                {copy.signup.visitor.phoneLabel}
              </label>
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
                className="w-full h-10 px-3 text-sm bg-transparent rounded-lg focus:outline-none transition-colors"
                style={{
                  color: tokens.text,
                  border: tokens.buttonBorder
                    ? `1px solid ${tokens.buttonBorder}`
                    : '1px solid rgba(0,0,0,0.2)',
                }}
              />
            </div>
          )}

          {/* Consent Checkbox */}
          <div className="pt-1">
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
              <span className="opacity-80 leading-snug" style={{ color: tokens.text }}>
                {consentSentence}
              </span>
            </label>
          </div>

          {errorMessage && (
            <p className="text-xs text-red-500 font-medium text-center">
              {errorMessage}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-10 px-4 mt-1 font-medium text-sm transition-transform duration-120 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center cursor-pointer shadow-sm"
            style={{
              backgroundColor: tokens.buttonBg,
              color: tokens.buttonText,
              borderRadius: `${Math.min(12, effectiveRadius)}px`,
              border: tokens.buttonBorder
                ? `1px solid ${tokens.buttonBorder}`
                : 'none',
            }}
          >
            {isSubmitting ? (
              <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              buttonLabel
            )}
          </button>

          {/* Privacy line */}
          <div className="text-center pt-1 text-[11px] opacity-60">
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
