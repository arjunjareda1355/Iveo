import React, { useRef } from 'react';
import { Check, Lock } from 'lucide-react';
import { VIBES, Vibe, VibeId } from '../../lib/vibes';
import { cn } from '../../lib/cn';

interface VibeTileGroupProps {
  selectedVibeId: VibeId;
  onSelect: (vibeId: VibeId) => void;
  isPro?: boolean;
  onProBlocked?: (vibe: Vibe) => void;
  className?: string;
}

export const VibeTileGroup: React.FC<VibeTileGroupProps> = ({
  selectedVibeId,
  onSelect,
  isPro = false,
  onProBlocked,
  className,
}) => {
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleSelectAttempt = (vibe: Vibe) => {
    if (vibe.isPro && !isPro) {
      onProBlocked?.(vibe);
      return;
    }
    onSelect(vibe.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelectAttempt(VIBES[index]);
      return;
    }

    let nextIndex = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % VIBES.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + VIBES.length) % VIBES.length;
    }

    if (nextIndex !== index) {
      tileRefs.current[nextIndex]?.focus();
      const target = VIBES[nextIndex];
      if (!target.isPro || isPro) {
        onSelect(target.id);
      }
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Pick a vibe"
      className={cn(
        'grid grid-cols-2 md:grid-cols-3 gap-3 w-full select-none',
        className
      )}
    >
      {VIBES.map((vibe, idx) => {
        const isSelected = vibe.id === selectedVibeId;
        const isLocked = Boolean(vibe.isPro && !isPro);
        const tokens = vibe.tokens;

        return (
          <div
            key={vibe.id}
            ref={(el) => {
              tileRefs.current[idx] = el;
            }}
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isLocked ? true : undefined}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => handleSelectAttempt(vibe)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              'relative rounded-[14px] p-3 flex flex-col justify-between cursor-pointer bg-surface transition-all duration-120 focus-visible:outline-none',
              isSelected
                ? 'border border-ink outline-2 outline-ink outline-offset-2 shadow-xs'
                : isLocked
                  ? 'border border-border/80 opacity-85 hover:opacity-100 hover:border-border-strong'
                  : 'border border-border hover:border-border-strong'
            )}
          >
            {/* Top mini preview well (80px tall) */}
            <div
              className="w-full h-20 rounded-[8px] flex flex-col items-center justify-center p-2 gap-1.5 relative overflow-hidden"
              style={{ backgroundColor: tokens.bg }}
              aria-hidden="true"
            >
              {/* Mini avatar */}
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold"
                style={{
                  backgroundColor: tokens.avatarBg,
                  color: tokens.avatarText,
                }}
              >
                {vibe.persona.initials}
              </div>

              {/* Two button bars in vibe style */}
              <div
                className="w-16 h-2"
                style={{
                  backgroundColor: tokens.buttonBg,
                  borderRadius: `${Math.min(tokens.buttonRadius, 8)}px`,
                  border: tokens.buttonBorder
                    ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
                    : 'none',
                  boxShadow: tokens.buttonShadow || 'none',
                }}
              />
              <div
                className="w-16 h-2"
                style={{
                  backgroundColor: tokens.buttonBg,
                  borderRadius: `${Math.min(tokens.buttonRadius, 8)}px`,
                  border: tokens.buttonBorder
                    ? `${tokens.buttonBorderWidth || '1px'} solid ${tokens.buttonBorder}`
                    : 'none',
                  boxShadow: tokens.buttonShadow || 'none',
                }}
              />

              {/* Top-left Pro / Free indicator */}
              {vibe.isPro && (
                <div className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] bg-[#0A0A0A]/85 text-[#FAFAFA] text-[9px] font-semibold uppercase tracking-wider backdrop-blur-xs">
                  {isLocked && <Lock size={9} strokeWidth={2.5} />}
                  <span>Pro</span>
                </div>
              )}

              {/* Corner Check icon if selected */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-ink text-white flex items-center justify-center shadow-xs">
                  <Check size={12} strokeWidth={2.5} />
                </div>
              )}
            </div>

            {/* Title and description */}
            <div className="mt-2.5 flex flex-col text-left">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[14px] font-medium text-ink leading-tight">
                  {vibe.name}
                </span>
                <span className="text-[10px] font-medium text-muted shrink-0">
                  {vibe.isPro ? (isLocked ? 'Pro' : 'Pro') : 'Free'}
                </span>
              </div>
              <span className="text-[12px] text-muted leading-snug line-clamp-2 mt-0.5">
                {vibe.description}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
