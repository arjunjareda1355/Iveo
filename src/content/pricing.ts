import { FREE_PLAN_HIGHLIGHTS, PRO_PLAN_HIGHLIGHTS } from '../lib/plan';

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
    description: 'Everything you need for a clean, customizable creator page.',
    monthlyPrice: '$0',
    yearlyPrice: '$0',
    inrMonthlyPrice: '₹0',
    inrYearlyPrice: '₹0',
    monthlyPeriod: 'forever',
    yearlyPeriod: 'forever',
    buttonLabel: 'Claim your name',
    buttonHref: '/signup',
    features: FREE_PLAN_HIGHLIGHTS,
  },
  {
    id: 'pro',
    name: 'Pro',
    badge: 'Recommended',
    description: 'For verified creators who want premium design, embeds, scheduling, and full analytics.',
    monthlyPrice: '$6',
    yearlyPrice: '$5',
    inrMonthlyPrice: '₹499',
    inrYearlyPrice: '₹416',
    monthlyPeriod: 'per month',
    yearlyPeriod: 'per month, billed $60 yearly (or ₹4,999)',
    buttonLabel: 'Upgrade to Pro',
    buttonHref: '/signup?plan=pro',
    features: PRO_PLAN_HIGHLIGHTS,
  },
] as const;
