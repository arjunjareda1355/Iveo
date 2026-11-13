import React, { useState, useEffect, useRef } from 'react';
import { Coffee, RefreshCw, CheckCircle2, Users, Sparkles, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CoffeeData } from '../../data/types';

interface CoffeeComposerProps {
  onAdd: (data: {
    title: string;
    url: string;
    badge?: string;
    coffee?: CoffeeData | null;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialValues?: {
    title?: string;
    url?: string;
    badge?: string;
    coffee?: CoffeeData | null;
  };
  isEditing?: boolean;
}

function extractBmcSlugPreview(input: string): string | null {
  const clean = input.trim();
  if (!clean) return null;
  const match = clean.match(/(?:buymeacoffee\.com\/|coff\.ee\/)([a-zA-Z0-9._-]+)/i);
  if (match && match[1]) return match[1].replace(/\/+$/, '');
  if (/^[a-zA-Z0-9._-]{2,40}$/.test(clean) && !clean.includes('.')) {
    return clean;
  }
  return null;
}

export const CoffeeComposer: React.FC<CoffeeComposerProps> = ({
  onAdd,
  onCancel,
  isSubmitting = false,
  initialValues,
  isEditing = false,
}) => {
  const [url, setUrl] = useState(initialValues?.url || '');
  const [title, setTitle] = useState(initialValues?.title || 'Buy Me a Coffee');
  const [caption, setCaption] = useState(initialValues?.badge || 'Support my work · $3, $5, $10');
  const [buttonLabel, setButtonLabel] = useState(
    initialValues?.coffee?.buttonLabel || 'Support with a Coffee'
  );
  const [coffeeData, setCoffeeData] = useState<CoffeeData | null>(initialValues?.coffee || null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedUrlRef = useRef<string>('');

  const handleSyncBmc = async (targetUrl?: string) => {
    const raw = (targetUrl ?? url).trim();
    if (!raw) {
      setError('Enter your Buy Me a Coffee username or page URL first.');
      return;
    }

    setError(null);
    setSyncMessage(null);
    setIsSyncing(true);

    try {
      const normalizedInput =
        /^[a-zA-Z0-9._-]{2,40}$/.test(raw) && !raw.includes('.')
          ? `https://www.buymeacoffee.com/${raw}`
          : raw.startsWith('http')
            ? raw
            : `https://${raw}`;

      const res = await fetch(
        `/api/integrations/buymeacoffee?url=${encodeURIComponent(normalizedInput)}`
      );
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok || !data?.profile) {
        setSyncMessage(
          data?.message ||
            'Could not load live Buy Me a Coffee metrics for this handle — your link card will still work smoothly.'
        );
        return;
      }

      const p = data.profile;
      lastFetchedUrlRef.current = normalizedInput;

      const creatorTitle = p.displayName || p.creatorName || p.slug || title;
      const mappedSupporters = Array.isArray(p.recentSupporters)
        ? p.recentSupporters.map((s: any, idx: number) => ({
            id: String(s.id || idx),
            supporterName: String(s.supporterName || s.name || 'Supporter'),
            coffees: Number(s.coffees || 1),
            note: s.note ?? s.message ?? null,
            createdAt: s.createdAt ?? null,
          }))
        : [];

      const countNum =
        typeof p.supporterCount === 'number'
          ? p.supporterCount
          : typeof p.supportersCount === 'number'
            ? p.supportersCount
            : undefined;

      const merged: CoffeeData = {
        slug: p.slug,
        creatorName: creatorTitle,
        bio: p.bio || undefined,
        avatarUrl: p.avatarUrl || undefined,
        coverUrl: p.coverUrl || undefined,
        coffeePrice: p.coffeePrice || undefined,
        supportersCount: countNum,
        supportersLabel: p.supportersLabel || undefined,
        extrasCount: typeof p.extrasCount === 'number' ? p.extrasCount : undefined,
        recentSupporters: mappedSupporters,
        extras: Array.isArray(p.extras) ? p.extras : [],
        buttonLabel: buttonLabel.trim() || 'Support with a Coffee',
        fetchedAt: p.fetchedAt || new Date().toISOString(),
      };

      setCoffeeData(merged);

      if (!url.includes('://')) {
        setUrl(`https://www.buymeacoffee.com/${p.slug}`);
      }
      if (creatorTitle && (!title || title === 'Buy Me a Coffee')) {
        setTitle(`Support ${creatorTitle}`);
      }
      if (p.bio && (!caption || caption === 'Support my work · $3, $5, $10')) {
        setCaption(String(p.bio).slice(0, 68));
      }

      setSyncMessage(
        p.supportersLabel
          ? `Connected to ${creatorTitle} (${p.supportersLabel})`
          : typeof countNum === 'number'
            ? `Connected to ${creatorTitle} (${countNum} supporters)`
            : `Connected to ${creatorTitle}`
      );
    } catch {
      setSyncMessage('Unable to reach Buy Me a Coffee sync right now — link will still save.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync once when user enters a valid buymeacoffee.com/<slug> URL
  useEffect(() => {
    const slug = extractBmcSlugPreview(url);
    if (!slug) return;
    if (!url.toLowerCase().includes('buymeacoffee.com') && !url.toLowerCase().includes('coff.ee')) {
      return;
    }
    const candidate = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
    if (lastFetchedUrlRef.current === candidate || coffeeData?.slug === slug) return;

    const timer = setTimeout(() => {
      handleSyncBmc(candidate);
    }, 650);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const raw = url.trim();
    if (!raw) {
      setError('Please enter your Buy Me a Coffee username or URL.');
      return;
    }

    const formattedUrl =
      /^[a-zA-Z0-9._-]{2,40}$/.test(raw) && !raw.includes('.')
        ? `https://www.buymeacoffee.com/${raw}`
        : raw.startsWith('http')
          ? raw
          : `https://${raw}`;

    const slug = extractBmcSlugPreview(formattedUrl);
    const nextCoffee: CoffeeData | null = coffeeData
      ? {
          ...coffeeData,
          buttonLabel: buttonLabel.trim() || 'Support with a Coffee',
        }
      : slug
        ? {
            slug,
            buttonLabel: buttonLabel.trim() || 'Support with a Coffee',
          }
        : {
            buttonLabel: buttonLabel.trim() || 'Support with a Coffee',
          };

    try {
      await onAdd({
        title: title.trim() || 'Buy Me a Coffee',
        url: formattedUrl,
        badge: caption.trim() || undefined,
        coffee: nextCoffee,
      });
    } catch (err: any) {
      setError(err?.message || "Couldn't save coffee block. Try again.");
    }
  };

  return (
    <Card className="p-4 sm:p-5 border-ink/20 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
            <Coffee size={18} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-ink leading-tight">
              {isEditing ? 'Edit Buy Me a Coffee Block' : 'Add Buy Me a Coffee Block'}
            </h3>
            <p className="text-[12px] text-muted">
              Connect your Buy Me a Coffee profile to showcase supporters, extras &amp; tipping buttons
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-[12px] text-red-600 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="coffee-url" className="text-[13px] font-medium text-ink">
            Buy Me a Coffee URL or Username
          </label>
          <div className="flex items-center gap-2">
            <input
              id="coffee-url"
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="buymeacoffee.com/yourname or yourname"
              className="flex-1 h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
              autoFocus
            />
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => handleSyncBmc()}
              disabled={isSyncing || !url.trim()}
              className="shrink-0"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Profile'}</span>
            </Button>
          </div>
          {syncMessage && (
            <div className="flex items-center gap-1.5 text-[12px] text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>{syncMessage}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="coffee-title" className="text-[13px] font-medium text-ink">
              Block Title
            </label>
            <input
              id="coffee-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Buy Me a Coffee"
              maxLength={60}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="coffee-cta" className="text-[13px] font-medium text-ink">
              Button Label
            </label>
            <input
              id="coffee-cta"
              type="text"
              value={buttonLabel}
              onChange={(e) => setButtonLabel(e.target.value)}
              placeholder="Support with a Coffee"
              maxLength={32}
              className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="coffee-caption" className="text-[13px] font-medium text-ink">
            Subtitle / Note (Optional)
          </label>
          <input
            id="coffee-caption"
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. Every coffee keeps these projects free & open!"
            maxLength={70}
            className="h-10 px-3 bg-surface border border-border rounded-lg text-[14px] text-ink focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>

        {/* Rich Live Preview */}
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-medium text-muted">Live Profile Preview</span>
            {coffeeData?.slug && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full">
                <Sparkles size={10} />@{coffeeData.slug}
              </span>
            )}
          </div>
          <div className="w-full p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {coffeeData?.avatarUrl ? (
                  <img
                    src={coffeeData.avatarUrl}
                    alt={coffeeData.creatorName || title}
                    className="w-10 h-10 rounded-xl object-cover border border-amber-500/30 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Coffee size={20} strokeWidth={2} />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[14px] text-ink truncate leading-tight">
                      {title || coffeeData?.creatorName || 'Buy Me a Coffee'}
                    </span>
                    {typeof coffeeData?.supportersCount === 'number' &&
                      coffeeData.supportersCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px] font-semibold shrink-0">
                          <Users size={10} />
                          {coffeeData.supportersCount}
                        </span>
                      )}
                  </div>
                  <span className="text-[12px] text-muted truncate">
                    {caption || coffeeData?.bio || 'Support with a coffee'}
                  </span>
                </div>
              </div>

              <span className="px-3.5 py-1.5 rounded-full text-[12px] font-semibold bg-amber-500 text-white shrink-0 inline-flex items-center gap-1">
                <span>{buttonLabel || 'Support ☕'}</span>
                <ExternalLink size={11} />
              </span>
            </div>

            {coffeeData?.recentSupporters && coffeeData.recentSupporters.length > 0 && (
              <div className="pt-2 border-t border-amber-500/15 flex flex-wrap gap-1.5">
                {coffeeData.recentSupporters.slice(0, 2).map((sup, i) => (
                  <span
                    key={`${sup.supporterName}-${i}`}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-surface/80 border border-amber-500/20 text-ink/80 truncate max-w-full"
                  >
                    ☕ {sup.supporterName} ({sup.coffees}×)
                    {sup.note ? ` — "${sup.note.slice(0, 32)}"` : ''}
                  </span>
                ))}
              </div>
            )}

            {coffeeData?.extras && coffeeData.extras.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {coffeeData.extras.slice(0, 2).map((ext, i) => (
                  <span
                    key={`${ext.title}-${i}`}
                    className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-300 font-medium"
                  >
                    ★ {ext.title}
                    {ext.price ? ` · ${ext.price}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting || !url.trim()}
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Coffee Block'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
