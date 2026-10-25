import React from 'react';
import {
  Instagram,
  Youtube,
  Github,
  Linkedin,
  Mail,
  Globe,
  Music2,
  Tv,
} from 'lucide-react';

export interface SocialIconProps {
  color?: string;
  size?: number;
  className?: string;
}

export interface SocialPlatformConfig {
  id: string;
  name: string;
  placeholder: string;
  prefix?: string;
}

export const SUPPORTED_SOCIAL_PLATFORMS: SocialPlatformConfig[] = [
  { id: 'instagram', name: 'Instagram', placeholder: 'https://instagram.com/username' },
  { id: 'youtube', name: 'YouTube', placeholder: 'https://youtube.com/@channel' },
  { id: 'x', name: 'X / Twitter', placeholder: 'https://x.com/username' },
  { id: 'tiktok', name: 'TikTok', placeholder: 'https://tiktok.com/@username' },
  { id: 'github', name: 'GitHub', placeholder: 'https://github.com/username' },
  { id: 'linkedin', name: 'LinkedIn', placeholder: 'https://linkedin.com/in/username' },
  { id: 'spotify', name: 'Spotify', placeholder: 'https://open.spotify.com/artist/...' },
  { id: 'mail', name: 'Email', placeholder: 'you@example.com' },
  { id: 'website', name: 'Website', placeholder: 'https://yoursite.com' },
];

export const InstagramIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <Instagram size={size} color={color} strokeWidth={1.5} className={className} />
);

export const PlayIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <Youtube size={size} color={color} strokeWidth={1.5} className={className} />
);

export const YoutubeIcon: React.FC<SocialIconProps> = PlayIcon;

export const XIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const TikTokIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

export const GithubIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <Github size={size} color={color} strokeWidth={1.5} className={className} />
);

export const LinkedinIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <Linkedin size={size} color={color} strokeWidth={1.5} className={className} />
);

export const SpotifyIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <Music2 size={size} color={color} strokeWidth={1.5} className={className} />
);

export const MusicIcon: React.FC<SocialIconProps> = SpotifyIcon;

export const MailIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <Mail size={size} color={color} strokeWidth={1.5} className={className} />
);

export const GlobeIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <Globe size={size} color={color} strokeWidth={1.5} className={className} />
);

export const TwitchIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <Tv size={size} color={color} strokeWidth={1.5} className={className} />
);

export const SocialIcon: React.FC<SocialIconProps & { platform: string }> = ({
  platform,
  size = 18,
  color = 'currentColor',
  className,
}) => {
  const p = (platform || '').trim().toLowerCase();
  switch (p) {
    case 'instagram':
      return <InstagramIcon size={size} color={color} className={className} />;
    case 'youtube':
    case 'play':
      return <YoutubeIcon size={size} color={color} className={className} />;
    case 'x':
    case 'twitter':
      return <XIcon size={size} color={color} className={className} />;
    case 'tiktok':
      return <TikTokIcon size={size} color={color} className={className} />;
    case 'github':
      return <GithubIcon size={size} color={color} className={className} />;
    case 'linkedin':
      return <LinkedinIcon size={size} color={color} className={className} />;
    case 'spotify':
    case 'music':
      return <SpotifyIcon size={size} color={color} className={className} />;
    case 'mail':
    case 'email':
      return <MailIcon size={size} color={color} className={className} />;
    case 'twitch':
      return <TwitchIcon size={size} color={color} className={className} />;
    case 'website':
    case 'globe':
    case 'web':
    default:
      return <GlobeIcon size={size} color={color} className={className} />;
  }
};
