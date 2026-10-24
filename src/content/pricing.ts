export interface PricingPlan {
  id: 'free' | 'pro';
  name: string;
  badge?: string;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
  inrMonthlyPrice: string;
  inrYearlyPrice: string;
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
    inrMonthlyPrice: '₹0',
    inrYearlyPrice: '₹0',
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
    inrMonthlyPrice: '₹499',
    inrYearlyPrice: '₹416',
    monthlyPeriod: 'per month',
    yearlyPeriod: 'per month, billed $60 yearly (or ₹4,999)',
    buttonLabel: 'Upgrade to Pro',
    buttonHref: '/signup?plan=pro',
    features: [
      'Everything in Free',
      'Link scheduling and expiration dates',
      'Password-protected links',
      'Advanced analytics: sources and devices',
      'Full 90-day and 12-month analytics ranges',
      'YouTube, Spotify and SoundCloud embeds',
      'Option to remove the iveo mark',
      'Priority support by email',
    ],
  },
] as const;
