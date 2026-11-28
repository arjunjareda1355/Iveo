import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useIveoSession } from '../../auth/useIvioSession';
import { useToast } from '../ui/Toast';
import { sanitizeSeoField } from '../../lib/integrations';
import { buildProfileSeoDescription, buildProfileSeoTitle } from '../../lib/seoMeta';

export const SearchSeoCard: React.FC = () => {
  const session = useIveoSession();
  const { showToast } = useToast();

  const [seoTitle, setSeoTitle] = useState(session.customSeoTitle || '');
  const [seoDesc, setSeoDesc] = useState(session.customSeoDescription || '');
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSeoTitle(session.customSeoTitle || '');
    setSeoDesc(session.customSeoDescription || '');
  }, [session.customSeoTitle, session.customSeoDescription]);

  const hasChanges =
    seoTitle.trim() !== (session.customSeoTitle || '') ||
    seoDesc.trim() !== (session.customSeoDescription || '');

  const fallbackTitle = buildProfileSeoTitle({
    username: session.username,
    displayName: session.displayName,
  });
  const fallbackDesc = buildProfileSeoDescription({
    username: session.username,
    displayName: session.displayName,
    bio: session.bio,
  });

  const previewTitle = seoTitle.trim() || fallbackTitle;
  const previewDesc = seoDesc.trim() || fallbackDesc;
  const previewUrl = `https://iveo.site/@${session.username || 'yourname'}`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanTitle = sanitizeSeoField(seoTitle, 60);
    const cleanDesc = sanitizeSeoField(seoDesc, 160);

    setIsSaving(true);
    try {
      await session.updatePreferences({
        customSeoTitle: cleanTitle,
        customSeoDescription: cleanDesc,
      });
      setSeoTitle(cleanTitle || '');
      setSeoDesc(cleanDesc || '');
      setJustSaved(true);
      showToast('Saved');
      setTimeout(() => setJustSaved(false), 1800);
    } catch {
      setError('Could not save SEO metadata. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await session.updatePreferences({
        customSeoTitle: null,
        customSeoDescription: null,
      });
      setSeoTitle('');
      setSeoDesc('');
      showToast('SEO metadata reset to default');
    } catch {
      setError('Could not reset SEO metadata.');
    } finally {
      setIsSaving(false);
    }
  };

  const showSeoConsole = Boolean(session.isSignedIn);

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <h3 className="text-[16px] font-semibold text-ink leading-tight">
          SEO &amp; search
        </h3>
        <p className="mt-1 text-[13px] text-muted">
          Control how your page appears on Google and social search previews.
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="seo-page-title" className="text-[13px] font-medium text-ink">
              Page title
            </label>
            <span className="text-[11px] text-muted tabular-nums">
              {seoTitle.length}/60
            </span>
          </div>
          <input
            id="seo-page-title"
            type="text"
            maxLength={60}
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            placeholder={fallbackTitle}
            className="h-11 px-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="seo-meta-desc" className="text-[13px] font-medium text-ink">
              Meta description
            </label>
            <span className="text-[11px] text-muted tabular-nums">
              {seoDesc.length}/160
            </span>
          </div>
          <textarea
            id="seo-meta-desc"
            rows={2}
            maxLength={160}
            value={seoDesc}
            onChange={(e) => setSeoDesc(e.target.value)}
            placeholder="A short summary shown on search results and link previews."
            className="p-3 bg-surface border border-border rounded-[10px] text-[14px] text-ink placeholder:text-muted/60 resize-none focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        {/* Live Google Search Preview */}
        <div className="p-3.5 rounded-[12px] bg-surface-2/60 border border-border flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted">
            Search preview
          </span>
          <span className="text-[12px] text-muted truncate font-mono">
            {previewUrl}
          </span>
          <span className="text-[15px] font-medium text-[#1a0dab] leading-snug truncate">
            {previewTitle}
          </span>
          <p className="text-[12px] text-muted line-clamp-2 leading-relaxed">
            {previewDesc}
          </p>
        </div>

        {error && (
          <p className="text-[13px] text-[color:var(--error,#B3261E)] font-medium" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          {(session.customSeoTitle || session.customSeoDescription || seoTitle || seoDesc) ? (
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              className="text-[13px] font-medium text-muted hover:text-ink underline underline-offset-2 cursor-pointer min-h-[44px]"
            >
              Reset to default
            </button>
          ) : (
            <span />
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSaving || (!hasChanges && !justSaved)}
          >
            {isSaving ? (
              <>
                <Loader2 size={15} className="animate-spin mr-1.5" />
                <span>Saving...</span>
              </>
            ) : justSaved ? (
              <>
                <Check size={15} className="mr-1.5" />
                <span>Saved</span>
              </>
            ) : (
              <span>Save</span>
            )}
          </Button>
        </div>
      </form>

      {showSeoConsole && (
        <div className="pt-4 border-t border-divider flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-[14px] font-semibold text-ink leading-tight">
              Search console
            </h4>
            <p className="mt-0.5 text-[12px] text-muted">
              Inspect your profile indexability, check live Google preview, and submit updates to search engines.
            </p>
          </div>
          <Button
            as={Link}
            to="/admin/seo"
            variant="secondary"
            size="sm"
            className="shrink-0 !h-7 !min-h-0 !px-2.5 !text-[11.5px] !rounded-[7px]"
          >
            Open SEO console
          </Button>
        </div>
      )}
    </Card>
  );
};
