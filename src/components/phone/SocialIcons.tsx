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
  { id: 'whatsapp', name: 'WhatsApp', placeholder: 'https://wa.me/phone' },
  { id: 'telegram', name: 'Telegram', placeholder: 'https://t.me/username' },
  { id: 'discord', name: 'Discord', placeholder: 'https://discord.gg/invite' },
  { id: 'threads', name: 'Threads', placeholder: 'https://threads.net/@username' },
  { id: 'facebook', name: 'Facebook', placeholder: 'https://facebook.com/username' },
  { id: 'pinterest', name: 'Pinterest', placeholder: 'https://pinterest.com/username' },
  { id: 'github', name: 'GitHub', placeholder: 'https://github.com/username' },
  { id: 'linkedin', name: 'LinkedIn', placeholder: 'https://linkedin.com/in/username' },
  { id: 'spotify', name: 'Spotify', placeholder: 'https://open.spotify.com/artist/...' },
  { id: 'patreon', name: 'Patreon', placeholder: 'https://patreon.com/creator' },
  { id: 'substack', name: 'Substack', placeholder: 'https://username.substack.com' },
  { id: 'twitch', name: 'Twitch', placeholder: 'https://twitch.tv/username' },
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

export const WhatsAppIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
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
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

export const TelegramIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
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
    <path d="M21.5 2 2 9.5l7 3 2.5 7.5L15 15l6.5 6.5L21.5 2z" />
  </svg>
);

export const DiscordIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
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

export const FacebookSocialIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} aria-hidden="true">
    <path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z" />
  </svg>
);

export const PinterestSocialIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} aria-hidden="true">
    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.367 18.62 0 12.017 0z" />
  </svg>
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
    case 'whatsapp':
      return <WhatsAppIcon size={size} color={color} className={className} />;
    case 'telegram':
      return <TelegramIcon size={size} color={color} className={className} />;
    case 'discord':
      return <DiscordIcon size={size} color={color} className={className} />;
    case 'facebook':
      return <FacebookSocialIcon size={size} color={color} className={className} />;
    case 'pinterest':
      return <PinterestSocialIcon size={size} color={color} className={className} />;
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
