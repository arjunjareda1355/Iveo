import React from 'react';
import { Vibe } from '../../lib/vibes';
import { PageBlock } from '../../data/types';
import { PageRenderer } from '../page/PageRenderer';

export interface PhoneProfile {
  name: string;
  handle: string;
  bio?: string;
  avatarUrl?: string | null;
  initials?: string;
  links?: readonly string[];
  socials?: Record<string, string>;
}

interface PhonePageProps {
  vibe: Vibe;
  profile?: PhoneProfile;
  blocks?: PageBlock[];
  buttonRadiusOverride?: number;
  hideFooterMark?: boolean;
  embedMode?: 'placeholder' | 'live';
  scale?: number; // relative to 300px base
  protectedIds?: ReadonlySet<string>;
}

export const PhonePage: React.FC<PhonePageProps> = React.memo(
  ({
    vibe,
    profile,
    blocks,
    buttonRadiusOverride,
    hideFooterMark = false,
    embedMode = 'placeholder',
    scale = 1,
    protectedIds,
  }) => {
    return (
      <PageRenderer
        vibe={vibe}
        profile={profile}
        blocks={blocks}
        buttonRadiusOverride={buttonRadiusOverride}
        hideFooterMark={hideFooterMark}
        embedMode={embedMode}
        isPublicPage={false}
        scale={scale}
        protectedIds={protectedIds}
      />
    );
  }
);

PhonePage.displayName = 'PhonePage';
