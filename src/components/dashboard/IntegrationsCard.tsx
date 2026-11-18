import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Activity,
  MessageCircle,
  ChevronDown,
  Check,
  Loader2,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useIveoSession } from '../../auth/useIvioSession';
import { useToast } from '../ui/Toast';
import {
  normalizeGoogleAnalyticsId,
  normalizeMetaPixelId,
  normalizeWhatsAppNumber,
} from '../../lib/integrations';

type IntegrationKey = 'ga4' | 'pixel' | 'whatsapp';

const COUNTRY_CODES = [
  { code: '+91', label: '+91 (IN)' },
  { code: '+1', label: '+1 (US/CA)' },
  { code: '+44', label: '+44 (UK)' },
  { code: '+61', label: '+61 (AU)' },
  { code: '+971', label: '+971 (AE)' },
  { code: '+65', label: '+65 (SG)' },
  { code: '+49', label: '+49 (DE)' },
  { code: '+33', label: '+33 (FR)' },
  { code: '+81', label: '+81 (JP)' },
  { code: '+55', label: '+55 (BR)' },
];

function splitCountryAndPhone(rawSaved: string | null | undefined): {
  countryCode: string;
  localNumber: string;
} {
  const clean = (rawSaved || '').trim();
  if (!clean) {
    return { countryCode: '+91', localNumber: '' };
  }
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const item of sorted) {
    if (clean.startsWith(item.code)) {
      return {
        countryCode: item.code,
        localNumber: clean.slice(item.code.length).trim(),
      };
    }
  }
  return { countryCode: '+91', localNumber: clean.replace(/^\+/, '') };
}

export const IntegrationsCard: React.FC = () => {
  const session = useIveoSession();
  const { showToast } = useToast();

  const [expanded, setExpanded] = useState<IntegrationKey | null>(null);

  // GA4 state
  const [gaId, setGaId] = useState(session.googleAnalyticsId || '');
  const [gaError, setGaError] = useState<string | null>(null);
  const [gaSaving, setGaSaving] = useState(false);
  const [gaSaved, setGaSaved] = useState(false);

  // Meta Pixel state
  const [pixelId, setPixelId] = useState(session.metaPixelId || '');
  const [pixelError, setPixelError] = useState<string | null>(null);
  const [pixelSaving, setPixelSaving] = useState(false);
  const [pixelSaved, setPixelSaved] = useState(false);

  // WhatsApp state
  const initialWa = splitCountryAndPhone(session.whatsappNumber);
  const [waCountry, setWaCountry] = useState(initialWa.countryCode);
  const [waLocal, setWaLocal] = useState(initialWa.localNumber);
  const [waError, setWaError] = useState<string | null>(null);
  const [waSaving, setWaSaving] = useState(false);
  const [waSaved, setWaSaved] = useState(false);

  useEffect(() => {
    setGaId(session.googleAnalyticsId || '');
  }, [session.googleAnalyticsId]);

  useEffect(() => {
    setPixelId(session.metaPixelId || '');
  }, [session.metaPixelId]);

  useEffect(() => {
    const parsed = splitCountryAndPhone(session.whatsappNumber);
    setWaCountry(parsed.countryCode);
    setWaLocal(parsed.localNumber);
  }, [session.whatsappNumber]);

  const gaDirty = gaId.trim().toUpperCase() !== (session.googleAnalyticsId || '');
  const pixelDirty = pixelId.trim() !== (session.metaPixelId || '');
  const composedWa = waLocal.trim()
    ? `${waCountry}${waLocal.replace(/[^\d]/g, '')}`
    : '';
  const waDirty = composedWa !== (session.whatsappNumber || '');

  const handleSaveGa = async (e: React.FormEvent) => {
    e.preventDefault();
    setGaError(null);
    const check = normalizeGoogleAnalyticsId(gaId);
    if (!check.valid) {
      setGaError(check.error || 'Invalid Google Analytics ID.');
      return;
    }
    setGaSaving(true);
    try {
      await session.updatePreferences({ googleAnalyticsId: check.value });
      setGaId(check.value || '');
      setGaSaved(true);
      showToast('Saved');
      setTimeout(() => setGaSaved(false), 1800);
    } catch {
      setGaError('Could not save Google Analytics ID. Try again.');
    } finally {
      setGaSaving(false);
    }
  };

  const handleDisconnectGa = async () => {
    setGaError(null);
    setGaSaving(true);
    try {
      await session.updatePreferences({ googleAnalyticsId: null });
      setGaId('');
      showToast('Google Analytics disconnected');
    } catch {
      setGaError('Could not disconnect. Try again.');
    } finally {
      setGaSaving(false);
    }
  };

  const handleSavePixel = async (e: React.FormEvent) => {
    e.preventDefault();
    setPixelError(null);
    const check = normalizeMetaPixelId(pixelId);
    if (!check.valid) {
      setPixelError(check.error || 'Invalid Meta Pixel ID.');
      return;
    }
    setPixelSaving(true);
    try {
      await session.updatePreferences({ metaPixelId: check.value });
      setPixelId(check.value || '');
      setPixelSaved(true);
      showToast('Saved');
      setTimeout(() => setPixelSaved(false), 1800);
    } catch {
      setPixelError('Could not save Meta Pixel ID. Try again.');
    } finally {
      setPixelSaving(false);
    }
  };

  const handleDisconnectPixel = async () => {
    setPixelError(null);
    setPixelSaving(true);
    try {
      await session.updatePreferences({ metaPixelId: null });
      setPixelId('');
      showToast('Meta Pixel disconnected');
    } catch {
      setPixelError('Could not disconnect. Try again.');
    } finally {
      setPixelSaving(false);
    }
  };

  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaError(null);
    const rawCandidate = waLocal.trim() ? `${waCountry} ${waLocal.trim()}` : '';
    const check = normalizeWhatsAppNumber(rawCandidate);
    if (!check.valid) {
      setWaError(check.error || 'Invalid WhatsApp phone number.');
      return;
    }
    setWaSaving(true);
    try {
      await session.updatePreferences({ whatsappNumber: check.value });
      const parsed = splitCountryAndPhone(check.value);
      setWaCountry(parsed.countryCode);
      setWaLocal(parsed.localNumber);
      setWaSaved(true);
      showToast('Saved');
      setTimeout(() => setWaSaved(false), 1800);
    } catch {
      setWaError('Could not save WhatsApp number. Try again.');
    } finally {
      setWaSaving(false);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    setWaError(null);
    setWaSaving(true);
    try {
      await session.updatePreferences({ whatsappNumber: null });
      setWaLocal('');
      showToast('WhatsApp Quick-Chat disconnected');
    } catch {
      setWaError('Could not disconnect. Try again.');
    } finally {
      setWaSaving(false);
    }
  };

  const renderStatusChip = (connected: boolean) => (
    <span
      className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${
        connected
          ? 'bg-emerald-50 text-[color:var(--success,#047857)] border border-emerald-200'
          : 'bg-surface-2 text-muted border border-border'
      }`}
    >
      {connected ? 'Connected' : 'Not connected'}
    </span>
  );

  return (
    <Card className="p-0 sm:p-0 overflow-hidden flex flex-col">
      <div className="px-4 py-4 sm:px-5 border-b border-divider">
        <h3 className="text-[16px] font-semibold text-ink leading-tight">
          Integrations
        </h3>
        <p className="mt-1 text-[13px] text-muted">
          Connect visitor analytics and direct chat to your live page.
        </p>
      </div>

      <div className="divide-y divide-divider">
        {/* 1. Google Analytics 4 */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setExpanded((prev) => (prev === 'ga4' ? null : 'ga4'))}
            aria-expanded={expanded === 'ga4'}
            className="w-full min-h-[64px] px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-surface-2/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-[10px] bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                <BarChart3 size={18} strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <span className="text-[14px] font-semibold text-ink block truncate">
                  Google Analytics 4
                </span>
                <span className="text-[12px] text-muted block truncate">
                  {session.googleAnalyticsId || 'Stream page views and outbound clicks'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {renderStatusChip(Boolean(session.googleAnalyticsId))}
              <ChevronDown
                size={16}
                className={`text-muted transition-transform ${
                  expanded === 'ga4' ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {expanded === 'ga4' && (
            <form
              onSubmit={handleSaveGa}
              className="px-4 sm:px-5 pb-4 pt-1 flex flex-col gap-2.5 bg-surface-2/30"
            >
              <label htmlFor="integration-ga4" className="text-[12px] font-medium text-ink">
                Measurement ID
              </label>
              <input
                id="integration-ga4"
                type="text"
                value={gaId}
                onChange={(e) => {
                  setGaId(e.target.value);
                  if (gaError) setGaError(null);
                }}
                placeholder="e.g. G-XXXXXXXXXX"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="h-11 px-3 bg-surface border border-border rounded-[10px] font-mono text-[13px] text-ink placeholder:text-muted/50 focus-visible:outline-2 focus-visible:outline-ink"
              />
              <p className="text-[12px] text-muted">
                Starts with G-. Events appear in your GA4 Realtime view.
              </p>
              {gaError && (
                <p className="text-[12px] text-[color:var(--error,#B3261E)] font-medium" role="alert">
                  {gaError}
                </p>
              )}
              <div className="flex items-center justify-between gap-2 pt-1">
                {session.googleAnalyticsId ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnectGa}
                    disabled={gaSaving}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={gaSaving || (!gaDirty && !gaSaved)}
                >
                  {gaSaving ? (
                    <Loader2 size={14} className="animate-spin mr-1" />
                  ) : gaSaved ? (
                    <Check size={14} className="mr-1" />
                  ) : null}
                  <span>{gaSaved ? 'Saved' : 'Save'}</span>
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* 2. Meta Pixel */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setExpanded((prev) => (prev === 'pixel' ? null : 'pixel'))}
            aria-expanded={expanded === 'pixel'}
            className="w-full min-h-[64px] px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-surface-2/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-[10px] bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0">
                <Activity size={18} strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <span className="text-[14px] font-semibold text-ink block truncate">
                  Meta Pixel
                </span>
                <span className="text-[12px] text-muted block truncate">
                  {session.metaPixelId || 'Track conversions in Meta Ads Manager'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {renderStatusChip(Boolean(session.metaPixelId))}
              <ChevronDown
                size={16}
                className={`text-muted transition-transform ${
                  expanded === 'pixel' ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {expanded === 'pixel' && (
            <form
              onSubmit={handleSavePixel}
              className="px-4 sm:px-5 pb-4 pt-1 flex flex-col gap-2.5 bg-surface-2/30"
            >
              <label htmlFor="integration-pixel" className="text-[12px] font-medium text-ink">
                Pixel ID
              </label>
              <input
                id="integration-pixel"
                type="text"
                inputMode="numeric"
                value={pixelId}
                onChange={(e) => {
                  setPixelId(e.target.value);
                  if (pixelError) setPixelError(null);
                }}
                placeholder="e.g. 123456789012345"
                className="h-11 px-3 bg-surface border border-border rounded-[10px] font-mono text-[13px] text-ink placeholder:text-muted/50 focus-visible:outline-2 focus-visible:outline-ink"
              />
              <p className="text-[12px] text-muted">
                Numeric 10–20 digit Pixel ID from Meta Events Manager.
              </p>
              {pixelError && (
                <p className="text-[12px] text-[color:var(--error,#B3261E)] font-medium" role="alert">
                  {pixelError}
                </p>
              )}
              <div className="flex items-center justify-between gap-2 pt-1">
                {session.metaPixelId ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnectPixel}
                    disabled={pixelSaving}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={pixelSaving || (!pixelDirty && !pixelSaved)}
                >
                  {pixelSaving ? (
                    <Loader2 size={14} className="animate-spin mr-1" />
                  ) : pixelSaved ? (
                    <Check size={14} className="mr-1" />
                  ) : null}
                  <span>{pixelSaved ? 'Saved' : 'Save'}</span>
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* 3. WhatsApp Quick-Chat */}
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => setExpanded((prev) => (prev === 'whatsapp' ? null : 'whatsapp'))}
            aria-expanded={expanded === 'whatsapp'}
            className="w-full min-h-[64px] px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-surface-2/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-[10px] bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                <MessageCircle size={18} strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <span className="text-[14px] font-semibold text-ink block truncate">
                  WhatsApp Quick-Chat
                </span>
                <span className="text-[12px] text-muted block truncate">
                  {session.whatsappNumber || 'Add a floating chat button to your page'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {renderStatusChip(Boolean(session.whatsappNumber))}
              <ChevronDown
                size={16}
                className={`text-muted transition-transform ${
                  expanded === 'whatsapp' ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {expanded === 'whatsapp' && (
            <form
              onSubmit={handleSaveWhatsApp}
              className="px-4 sm:px-5 pb-4 pt-1 flex flex-col gap-2.5 bg-surface-2/30"
            >
              <label htmlFor="integration-whatsapp" className="text-[12px] font-medium text-ink">
                Phone number
              </label>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Country code"
                  value={waCountry}
                  onChange={(e) => {
                    setWaCountry(e.target.value);
                    if (waError) setWaError(null);
                  }}
                  className="h-11 px-2.5 bg-surface border border-border rounded-[10px] text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-ink cursor-pointer shrink-0"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  id="integration-whatsapp"
                  type="tel"
                  value={waLocal}
                  onChange={(e) => {
                    setWaLocal(e.target.value);
                    if (waError) setWaError(null);
                  }}
                  placeholder="e.g. 98765 43210"
                  className="flex-1 min-w-0 h-11 px-3 bg-surface border border-border rounded-[10px] font-mono text-[13px] text-ink placeholder:text-muted/45 focus-visible:outline-2 focus-visible:outline-ink"
                />
              </div>
              <p className="text-[12px] text-muted">
                Visitors can start a direct WhatsApp chat from a floating button on your page.
              </p>
              {waError && (
                <p className="text-[12px] text-[color:var(--error,#B3261E)] font-medium" role="alert">
                  {waError}
                </p>
              )}
              <div className="flex items-center justify-between gap-2 pt-1">
                {session.whatsappNumber ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnectWhatsApp}
                    disabled={waSaving}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={waSaving || (!waDirty && !waSaved)}
                >
                  {waSaving ? (
                    <Loader2 size={14} className="animate-spin mr-1" />
                  ) : waSaved ? (
                    <Check size={14} className="mr-1" />
                  ) : null}
                  <span>{waSaved ? 'Saved' : 'Save'}</span>
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Card>
  );
};
