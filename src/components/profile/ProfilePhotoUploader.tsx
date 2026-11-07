import React from 'react';
import { AvatarSelector } from './AvatarSelector';

export interface ProfilePhotoUploaderProps {
  currentAvatarUrl?: string | null;
  avatarType?: 'default' | 'uploaded';
  avatarId?: string | null;
  initials?: string;
  username?: string | null;
  onAvatarChange: (newUrl: string | null) => Promise<void> | void;
  onAvatarPayloadChange?: (payload: {
    avatarUrl: string | null;
    avatarType: 'default' | 'uploaded';
    avatarId: string | null;
  }) => Promise<void> | void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProfilePhotoUploader: React.FC<ProfilePhotoUploaderProps> = ({
  currentAvatarUrl,
  avatarType,
  avatarId,
  initials = 'ME',
  username,
  onAvatarChange,
  onAvatarPayloadChange,
  className = '',
}) => {
  return (
    <AvatarSelector
      currentAvatarUrl={currentAvatarUrl}
      avatarType={avatarType}
      avatarId={avatarId}
      initials={initials}
      username={username}
      className={className}
      onAvatarChange={async (payload) => {
        if (onAvatarPayloadChange) {
          await onAvatarPayloadChange(payload);
        } else {
          await onAvatarChange(payload.avatarUrl);
        }
      }}
    />
  );
};
