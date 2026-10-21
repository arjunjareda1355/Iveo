// Placeholder prices. Replace before launch.

export interface PricingPlan {
  id: 'free' | 'pro';
  name: string;
  badge?: string;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
  monthlyPeriod: string;
  yearlyPeriod: string;
  buttonLabel: string;
  buttonHref: string;
  features: readonly string[];
}

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Everything you need for a clean, professional page.',
    monthlyPrice: '$0',
    yearlyPrice: '$0',
    monthlyPeriod: 'forever',
    yearlyPeriod: 'forever',
    buttonLabel: 'Claim your name',
    buttonHref: '/signup',
    features: [
      '1 page',
      'Unlimited links',
      'All six vibes',
      'Header and divider blocks',
      'Live preview',
      'Basic analytics: views and clicks',
      'QR code download',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    badge: 'Recommended',
    description: 'For people who share their work and want to know what is working.',
    monthlyPrice: '$6',
    yearlyPrice: '$5',
    monthlyPeriod: 'per month',
    yearlyPeriod: 'per month, billed $60 yearly',
    buttonLabel: 'Start with Pro',
    buttonHref: '/signup?plan=pro',
    features: [
      'Everything in Free',
      'Link scheduling',
      'Password-protected links',
      'Advanced analytics',
      'Email and phone collection with CSV export',
      'YouTube, Spotify and SoundCloud embeds',
      'Remove the iveo footer mark',
      'Priority support by email',
    ],
  },
] as const;
