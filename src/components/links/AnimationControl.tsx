import React from 'react';
import { Sparkles } from 'lucide-react';
import { LinkAnimation } from '../../data/types';

interface AnimationControlProps {
  animation?: LinkAnimation | null;
  badge?: string | null;
  onAnimationChange: (animation: LinkAnimation) => void;
  onBadgeChange: (badge: string) => void;
}

const BADGE_SUGGESTIONS = ['NEW', 'HOT', 'FEATURED', 'MUST READ', '50% OFF', 'LISTEN', 'FREE'];

export const AnimationControl: React.FC<AnimationControlProps> = ({
  animation = 'none',
  badge = '',
  onAnimationChange,
  onBadgeChange,
}) => {
  return (
    <div className="flex flex-col gap-3 p-3.5 bg-surface/50 border border-border/80 rounded-xl">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
        <Sparkles size={14} className="text-amber-500" />
        <span>Highlight & Priority Badge</span>
      </div>

      {/* Animation Selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-ink/80 font-medium">Link Animation Effect</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {(
            [
              { id: 'none', label: 'None' },
              { id: 'pulse', label: 'Pulse' },
              { id: 'glow', label: 'Glow' },
              { id: 'bounce', label: 'Bounce' },
            ] as const
          ).map((item) => {
            const isSelected = (animation || 'none') === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onAnimationChange(item.id)}
                className={`py-1.5 px-2.5 text-xs rounded-lg border font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-ink text-surface border-ink shadow-xs'
                    : 'bg-surface hover:bg-neutral-100 dark:hover:bg-neutral-800 text-ink/80 border-border'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Priority Badge Input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-ink/80 font-medium">Badge Tag (Optional)</label>
        <input
          type="text"
          value={badge || ''}
          onChange={(e) => onBadgeChange(e.target.value.toUpperCase())}
          placeholder="e.g. HOT, NEW, SALE"
          maxLength={14}
          className="w-full text-xs px-3 py-2 bg-surface border border-border rounded-lg text-ink focus:outline-none focus:ring-1 focus:ring-ink"
        />

        {/* Quick Suggestions */}
        <div className="flex flex-wrap gap-1 mt-1">
          {BADGE_SUGGESTIONS.map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => onBadgeChange(badge === sug ? '' : sug)}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                badge === sug
                  ? 'bg-ink text-surface border-ink'
                  : 'bg-surface hover:bg-neutral-100 text-muted border-border/80'
              }`}
            >
              {sug}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
