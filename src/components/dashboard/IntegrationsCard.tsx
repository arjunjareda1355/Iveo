import React, { useState, useEffect } from 'react';
import { BarChart3, Activity, MessageCircle, Globe, Check, Loader2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useIveoSession } from '../../auth/useIvioSession';
import { useToast } from '../ui/Toast';
import {
  normalizeGoogleAnalyticsId,
  normalizeMetaPixelId,
  normalizeWhatsAppNumber,
  sanitizeSeoField,
} from '../../lib/integrations';

export const IntegrationsCard: React.FC = () => {
  const session = useIveoSession();
  const { showToast } = useToast();

  const [gaId, setGaId] = useState(session.googleAnalyticsId || '');
  const [pixelId, setPixelId] = useState(session.metaPixelId || '');
  const [whatsapp, setWhatsapp] = useState(session.whatsappNumber || '');
  const [seoTitle, setSeoTitle] = useState(session.customSeoTitle || '');
  const [seoDesc, setSeoDesc] = useState(session.customSeoDescription || '');

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Sync local form fields when server profile loads asynchronously
  useEffect(() => {
    setGaId(session.googleAnalyticsId || '');
    setPixelId(session.metaPixelId || '');
    setWhatsapp(session.whatsappNumber || '');
    setSeoTitle(session.customSeoTitle || '');
    setSeoDesc(session.customSeoDescription || '');
  }, [
    session.googleAnalyticsId,
    session.metaPixelId,
    session.whatsappNumber,
    session.customSeoTitle,
    session.customSeoDescription,
  ]);

  const hasChanges =
    gaId.trim().toUpperCase() !== (session.googleAnalyticsId || '') ||
    pixelId.trim() !== (session.metaPixelId || '') ||
    whatsapp.trim() !== (session.whatsappNumber || '') ||
    seoTitle.trim() !== (session.customSeoTitle || '') ||
    seoDesc.trim() !== (session.customSeoDescription || '');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const gaCheck = normalizeGoogleAnalyticsId(gaId);
    if (!gaCheck.valid) {
      setError(gaCheck.error || 'Invalid Google Analytics ID.');
      return;
    }

    const pixelCheck = normalizeMetaPixelId(pixelId);
    if (!pixelCheck.valid) {
      setError(pixelCheck.error || 'Invalid Meta Pixel ID.');
      return;
    }

    const waCheck = normalizeWhatsAppNumber(whatsapp);
    if (!waCheck.valid) {
      setError(waCheck.error || 'Invalid WhatsApp number.');
      return;
    }

    const cleanSeoTitle = sanitizeSeoField(seoTitle, 70);
    const cleanSeoDesc = sanitizeSeoField(seoDesc, 160);

    setIsSaving(true);
    try {
      await session.updatePreferences({
        googleAnalyticsId: gaCheck.value,
        metaPixelId: pixelCheck.value,
        whatsappNumber: waCheck.value,
        customSeoTitle: cleanSeoTitle,
        customSeoDescription: cleanSeoDesc,
      });

      setGaId(gaCheck.value || '');
      setPixelId(pixelCheck.value || '');
      setWhatsapp(waCheck.value || '');
      setSeoTitle(cleanSeoTitle || '');
      setSeoDesc(cleanSeoDesc || '');

      setJustSaved(true);
      showToast('Integrations saved to your page');
      setTimeout(() => setJustSaved(false), 2000);
    } catch {
      setError('Could not save integration settings. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async (field: 'googleAnalyticsId' | 'metaPixelId' | 'whatsappNumber' | 'seo') => {
    setError(null);
    setIsSaving(true);
    try {
      if (field === 'googleAnalyticsId') {
        await session.updatePreferences({ googleAnalyticsId: null });
        setGaId('');
      } else if (field === 'metaPixelId') {
        await session.updatePreferences({ metaPixelId: null });
        setPixelId('');
      } else if (field === 'whatsappNumber') {
        await session.updatePreferences({ whatsappNumber: null });
        setWhatsapp('');
      } else if (field === 'seo') {
        await session.updatePreferences({ customSeoTitle: null, customSeoDescription: null });
        setSeoTitle('');
        setSeoDesc('');
      }
      showToast('Integration removed from your page');
    } catch {
      setError('Could not remove integration. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h3 className="text-[20px] font-semibold text-ink leading-tight">
          Apps &amp; Integrations
        </h3>
        <p className="mt-1 text-[13px] text-muted max-w-[56ch]">
          Connect analytics, visitor chat, and search engine metadata directly to your live page.
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {/* 1. Google Analytics 4 */}
        <div className="p-3.5 rounded-[12px] bg-surface-2/60 border border-border/80 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="integration-ga4" className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <span className="w-7 h-7 rounded-[8px] bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                <BarChart3 size={15} strokeWidth={2} />
              </span>
              <span>Google Analytics 4</span>
            </label>
            {session.googleAnalyticsId && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-emerald-700">Connected</span>
                <button
                  type="button"
                  onClick={() => handleDisconnect('googleAnalyticsId')}
                  disabled={isSaving}
                  className="text-[11px] font-medium text-red-600 hover:underline cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
          <input
            id="integration-ga4"
            type="text"
            value={gaId}
            onChange={(e) => {
              setGaId(e.target.value);
              if (error) setError(null);
            }}
            placeholder="G-XXXXXXXXXX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="h-10 px-3 bg-surface border border-border rounded-[8px] font-mono text-[13px] text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-ink"
          />
          <p className="text-[11px] text-muted">
            Paste your GA4 Measurement ID to stream page views and outbound link clicks to Google Analytics.
          </p>
        </div>

        {/* 2. Meta / Facebook Pixel */}
        <div className="p-3.5 rounded-[12px] bg-surface-2/60 border border-border/80 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="integration-pixel" className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <span className="w-7 h-7 rounded-[8px] bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0">
                <Activity size={15} strokeWidth={2} />
              </span>
              <span>Meta Pixel</span>
            </label>
            {session.metaPixelId && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-emerald-700">Connected</span>
                <button
                  type="button"
                  onClick={() => handleDisconnect('metaPixelId')}
                  disabled={isSaving}
                  className="text-[11px] font-medium text-red-600 hover:underline cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
          <input
            id="integration-pixel"
            type="text"
            inputMode="numeric"
            value={pixelId}
            onChange={(e) => {
              setPixelId(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. 123456789012345"
            className="h-10 px-3 bg-surface border border-border rounded-[8px] font-mono text-[13px] text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-ink"
          />
          <p className="text-[11px] text-muted">
            Track visitor conversions and build custom audiences in Meta Ads Manager.
          </p>
        </div>

        {/* 3. WhatsApp Direct Chat Button */}
        <div className="p-3.5 rounded-[12px] bg-surface-2/60 border border-border/80 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="integration-whatsapp" className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <span className="w-7 h-7 rounded-[8px] bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                <MessageCircle size={15} strokeWidth={2} />
              </span>
              <span>WhatsApp Quick-Chat</span>
            </label>
            {session.whatsappNumber && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-emerald-700">Active on page</span>
                <button
                  type="button"
                  onClick={() => handleDisconnect('whatsappNumber')}
                  disabled={isSaving}
                  className="text-[11px] font-medium text-red-600 hover:underline cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
          <input
            id="integration-whatsapp"
            type="tel"
            value={whatsapp}
            onChange={(e) => {
              setWhatsapp(e.target.value);
              if (error) setError(null);
            }}
            placeholder="+14155550199"
            className="h-10 px-3 bg-surface border border-border rounded-[8px] font-mono text-[13px] text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-ink"
          />
          <p className="text-[11px] text-muted">
            Include country code. Adds a floating WhatsApp chat button to the bottom corner of your public page.
          </p>
        </div>

        {/* 4. Custom SEO & Search Metadata */}
        <div className="p-3.5 rounded-[12px] bg-surface-2/60 border border-border/80 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <span className="w-7 h-7 rounded-[8px] bg-ink/10 text-ink flex items-center justify-center shrink-0">
                <Globe size={15} strokeWidth={2} />
              </span>
              <span>Custom SEO &amp; Search Preview</span>
            </span>
            {(session.customSeoTitle || session.customSeoDescription) && (
              <button
                type="button"
                onClick={() => handleDisconnect('seo')}
                disabled={isSaving}
                className="text-[11px] font-medium text-red-600 hover:underline cursor-pointer"
              >
                Reset to default
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="integration-seo-title" className="text-[12px] font-medium text-muted">
              Page Title
            </label>
            <input
              id="integration-seo-title"
              type="text"
              maxLength={70}
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder={`${session.displayName || 'Your Name'} | Official Links`}
              className="h-9 px-3 bg-surface border border-border rounded-[8px] text-[13px] text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="integration-seo-desc" className="text-[12px] font-medium text-muted">
              Meta Description
            </label>
            <textarea
              id="integration-seo-desc"
              rows={2}
              maxLength={160}
              value={seoDesc}
              onChange={(e) => setSeoDesc(e.target.value)}
              placeholder="A short summary shown on Google search results and social previews."
              className="p-2.5 bg-surface border border-border rounded-[8px] text-[13px] text-ink placeholder:text-muted/60 resize-none focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        {error && (
          <p className="text-[13px] text-red-600 font-medium" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSaving || (!hasChanges && !justSaved)}
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : justSaved ? (
              <>
                <Check size={14} />
                <span>Saved</span>
              </>
            ) : (
              <span>Save integrations</span>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
};
