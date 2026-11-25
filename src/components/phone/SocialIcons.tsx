import React from 'react';
import {
  Instagram,
  Youtube,
  Github,
  Linkedin,
  Mail,
  Globe,
  Music2,
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
  { id: 'instagram', name: 'Instagram', placeholder: 'URL, @username, or username' },
  { id: 'youtube', name: 'YouTube', placeholder: 'URL, @channel, or username' },
  { id: 'x', name: 'X / Twitter', placeholder: 'URL, @username, or username' },
  { id: 'tiktok', name: 'TikTok', placeholder: 'URL, @username, or username' },
  { id: 'whatsapp', name: 'WhatsApp', placeholder: 'wa.me/phone or phone number' },
  { id: 'telegram', name: 'Telegram', placeholder: 'URL, @username, or username' },
  { id: 'discord', name: 'Discord', placeholder: 'discord.gg/invite or invite code' },
  { id: 'threads', name: 'Threads', placeholder: 'URL, @username, or username' },
  { id: 'bluesky', name: 'Bluesky', placeholder: 'bsky.app link or @handle.bsky.social' },
  { id: 'linktree', name: 'Linktree', placeholder: 'linktr.ee/name or username' },
  { id: 'facebook', name: 'Facebook', placeholder: 'URL, @username, or username' },
  { id: 'pinterest', name: 'Pinterest', placeholder: 'URL, @username, or username' },
  { id: 'github', name: 'GitHub', placeholder: 'URL, @username, or username' },
  { id: 'linkedin', name: 'LinkedIn', placeholder: 'linkedin.com/in/... or username' },
  { id: 'spotify', name: 'Spotify', placeholder: 'open.spotify.com/... or artist ID' },
  { id: 'patreon', name: 'Patreon', placeholder: 'URL, @username, or username' },
  { id: 'substack', name: 'Substack', placeholder: 'username.substack.com or @username' },
  { id: 'twitch', name: 'Twitch', placeholder: 'twitch.tv/channel or username' },
  { id: 'snapchat', name: 'Snapchat', placeholder: 'snapchat.com/add/username or username' },
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
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} className={className} aria-hidden="true">
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
  </svg>
);

export const SnapchatIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 3c-3.1 0-5.2 2.2-5.2 5.4 0 .7.1 1.4.2 2.1-.6.1-1.3.3-1.4.8-.1.6.6 1 .9 1.2-.4 1.5-1.6 2.8-3.4 3.4-.3.1-.5.4-.4.7.1.3.6.7 1.8 1 .3.1.4.3.5.7.1.4.3.6.7.6.4 0 .9-.2 1.7-.2.9 0 1.6.4 2.4 1 .7.5 1.4.9 2.2.9s1.5-.4 2.2-.9c.8-.6 1.5-1 2.4-1 .8 0 1.3.2 1.7.2.4 0 .6-.2.7-.6.1-.4.2-.6.5-.7 1.2-.3 1.7-.7 1.8-1 .1-.3-.1-.6-.4-.7-1.8-.6-3-1.9-3.4-3.4.3-.2 1-.6.9-1.2-.1-.5-.8-.7-1.4-.8.1-.7.2-1.4.2-2.1C17.2 5.2 15.1 3 12 3z" />
  </svg>
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

export const ThreadsSocialIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.781 3.631 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32l-1.757-1.182c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221Z" />
  </svg>
);

export const LinktreeSocialIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M13.51 5.853 17.53 1.72l1.644 1.663-3.93 3.854h5.724v2.302h-5.756l3.962 3.92-1.644 1.63-5.53-5.573-5.53 5.573-1.644-1.63 3.962-3.92H3.032V7.237h5.724l-3.93-3.854L6.47 1.72l4.02 4.133V0h3.02v5.853Zm-3.02 10.02h3.02V24h-3.02v-8.127Z" />
  </svg>
);

export const BlueskySocialIcon: React.FC<SocialIconProps> = ({ size = 18, color = 'currentColor', className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" />
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
    case 'threads':
      return <ThreadsSocialIcon size={size} color={color} className={className} />;
    case 'linktree':
      return <LinktreeSocialIcon size={size} color={color} className={className} />;
    case 'bluesky':
      return <BlueskySocialIcon size={size} color={color} className={className} />;
    case 'github':
      return <GithubIcon size={size} color={color} className={className} />;
    case 'linkedin':
      return <LinkedinIcon size={size} color={color} className={className} />;
    case 'spotify':
    case 'soundcloud':
    case 'music':
      return <SpotifyIcon size={size} color={color} className={className} />;
    case 'mail':
    case 'email':
      return <MailIcon size={size} color={color} className={className} />;
    case 'twitch':
      return <TwitchIcon size={size} color={color} className={className} />;
    case 'snapchat':
      return <SnapchatIcon size={size} color={color} className={className} />;
    case 'website':
    case 'globe':
    case 'web':
    case 'generic':
    default:
      return <GlobeIcon size={size} color={color} className={className} />;
  }
};
