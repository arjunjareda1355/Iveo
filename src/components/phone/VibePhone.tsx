import React from 'react';
import { Vibe, VIBES } from '../../lib/vibes';
import { PhoneFrame } from './PhoneFrame';
import { PhonePage, PhoneProfile } from './PhonePage';
import { PageBlock } from '../../data/types';

interface VibePhoneProps {
  currentVibe: Vibe;
  profile?: PhoneProfile;
  blocks?: PageBlock[];
  hideFooterMark?: boolean;
  embedMode?: 'placeholder' | 'live';
  width?: number;
  buttonRadiusOverride?: number;
  className?: string;
  ariaLabel?: string;
}

export const VibePhone: React.FC<VibePhoneProps> = React.memo(
  ({
    currentVibe,
    profile,
    blocks,
    hideFooterMark = false,
    embedMode = 'placeholder',
    width = 300,
    buttonRadiusOverride,
    className,
    ariaLabel,
  }) => {
    const scale = width / 300;

    return (
      <PhoneFrame
        width={width}
        vibe={currentVibe}
        ariaLabel={ariaLabel}
        className={className}
      >
        <div className="relative w-full h-full">
          {VIBES.map((vibe) => {
            const isActive = vibe.id === currentVibe.id;
            return (
              <div
                key={vibe.id}
                className="absolute inset-0 transition-opacity duration-[450ms] ease-out will-change-[opacity]"
                style={{
                  opacity: isActive ? 1 : 0,
                  pointerEvents: isActive ? 'auto' : 'none',
                  zIndex: isActive ? 10 : 1,
                }}
              >
                <PhonePage
                  vibe={vibe}
                  profile={profile}
                  blocks={blocks}
                  hideFooterMark={hideFooterMark}
                  embedMode={embedMode}
                  buttonRadiusOverride={isActive ? buttonRadiusOverride : undefined}
                  scale={scale}
                />
              </div>
            );
          })}
        </div>
      </PhoneFrame>
    );
  }
);

VibePhone.displayName = 'VibePhone';
