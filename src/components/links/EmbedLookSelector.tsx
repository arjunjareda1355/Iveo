import React from 'react';
import { Check, Sparkles } from 'lucide-react';
import type { EmbedLookStyle, EmbedProvider } from '../../data/types';
import {
  getDefaultEmbedCtaLabel,
  getEmbedLookOptions,
  isSocialEmbedProvider,
  normalizeEmbedLookStyle,
} from '../../lib/embedLooks';

interface EmbedLookSelectorProps {
  provider: EmbedProvider;
  subtype?: string | null;
  lookStyle?: EmbedLookStyle | null;
  showStats?: boolean;
  showDescription?: boolean;
  ctaLabel?: string | null;
  onChange: (patch: {
    lookStyle?: EmbedLookStyle;
    showStats?: boolean;
    showDescription?: boolean;
    ctaLabel?: string | null;
  }) => void;
}

export const EmbedLookSelector: React.FC<EmbedLookSelectorProps> = ({
  provider,
  subtype,
  lookStyle,
  showStats = true,
  showDescription = true,
  ctaLabel,
  onChange,
}) => {
  const activeLook = normalizeEmbedLookStyle(lookStyle, 'signature');
  const options = getEmbedLookOptions(provider);
  const isSocial = isSocialEmbedProvider(provider);
  const defaultCta = getDefaultEmbedCtaLabel(provider, subtype);

  return (
    <div className="flex flex-col gap-3 p-3.5 rounded-[12px] bg-surface-2/60 border border-border">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-ink shrink-0" />
          <span className="text-[13px] font-semibold text-ink">
            Card look &amp; style
          </span>
        </div>
        <span className="text-[11px] font-medium text-muted">
          {provider === 'x'
            ? 'X'
            : provider === 'github'
              ? 'GitHub'
              : provider === 'linkedin'
                ? 'LinkedIn'
                : provider === 'youtube'
                  ? 'YouTube'
                  : provider === 'soundcloud'
                    ? 'SoundCloud'
                    : provider.charAt(0).toUpperCase() + provider.slice(1)}{' '}
          preset
        </span>
      </div>

      {/* Distinct look cards per provider */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {options.map((opt) => {
          const selected = activeLook === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange({ lookStyle: opt.id })}
              aria-pressed={selected}
              className={`flex items-start gap-2.5 p-2.5 rounded-[10px] border text-left transition-all cursor-pointer ${
                selected
                  ? 'border-ink bg-surface ring-1 ring-ink'
                  : 'border-border bg-surface hover:border-border-strong'
              }`}
            >
              {/* Mini swatch visual */}
              <div
                className="w-8 h-8 rounded-[8px] border border-black/10 shrink-0 flex items-center justify-center relative overflow-hidden"
                style={{ backgroundColor: opt.swatchBg }}
                aria-hidden="true"
              >
                <span
                  className="w-3.5 h-1.5 rounded-full"
                  style={{ backgroundColor: opt.swatchAccent }}
                />
                {selected && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-bl-[6px] bg-ink text-surface flex items-center justify-center">
                    <Check size={9} strokeWidth={3} />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-ink leading-tight truncate">
                  {opt.label}
                </div>
                <p className="text-[11px] text-muted leading-snug mt-0.5 line-clamp-2">
                  {opt.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Fine-grained display options */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5 pt-1 border-t border-divider">
        <div className="flex flex-wrap items-center gap-3">
          {isSocial && (
            <>
              <label className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showDescription !== false}
                  onChange={(e) => onChange({ showDescription: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-border accent-ink cursor-pointer"
                />
                <span>Show bio / summary</span>
              </label>

              <label className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showStats !== false}
                  onChange={(e) => onChange({ showStats: e.target.checked })}
                  className="w-3.5 h-3.5 rounded border-border accent-ink cursor-pointer"
                />
                <span>Show stats</span>
              </label>
            </>
          )}
        </div>

        <div className="flex flex-col gap-1 sm:w-48">
          <label
            htmlFor={`embed-cta-${provider}`}
            className="text-[11px] font-medium text-muted"
          >
            Button text
          </label>
          <input
            id={`embed-cta-${provider}`}
            type="text"
            maxLength={28}
            value={ctaLabel ?? ''}
            onChange={(e) => onChange({ ctaLabel: e.target.value })}
            placeholder={defaultCta}
            className="h-8 px-2.5 bg-surface border border-border rounded-[8px] text-[12px] text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>
      </div>
    </div>
  );
};
