import React from 'react';
import { Vibe } from '../../lib/vibes';
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
  protectedIds?: ReadonlySet<string>;
  disableScroll?: boolean;
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
    protectedIds,
    disableScroll = false,
  }) => {
    const scale = width / 300;

    return (
      <PhoneFrame
        width={width}
        vibe={currentVibe}
        ariaLabel={ariaLabel}
        className={className}
        disableScroll={disableScroll}
      >
        <div className="relative w-full min-h-full flex flex-col">
          <PhonePage
            key={currentVibe.id}
            vibe={currentVibe}
            profile={profile}
            blocks={blocks}
            hideFooterMark={hideFooterMark}
            embedMode={embedMode}
            buttonRadiusOverride={buttonRadiusOverride}
            scale={scale}
            protectedIds={protectedIds}
          />
        </div>
      </PhoneFrame>
    );
  }
);

VibePhone.displayName = 'VibePhone';
