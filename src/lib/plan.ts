export const PRO_FEATURES = [
  'embeds',
  'scheduling',
  'hide_footer',
  'analytics_detail',
  'password_links',
  'contact_forms',
  'backgrounds',
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

export const PRO_FEATURE_NAMES: Record<ProFeature, string> = {
  embeds: 'Embeds',
  scheduling: 'Scheduling',
  hide_footer: 'Removing the iveo mark',
  analytics_detail: 'Advanced analytics',
  password_links: 'Password-protected links',
  contact_forms: 'Email and phone collection',
  backgrounds: 'Custom backgrounds & mesh styles',
};

export function getProFeatureName(feature: ProFeature): string {
  return PRO_FEATURE_NAMES[feature] || 'Pro feature';
}

/**
 * Designated owner emails who automatically have full Pro privileges for free
 */
export const OWNER_EMAILS = [
  'help@iveo.site',
  'arjunjareda2007@gmail.com',
  'help@fanq.me',
  'arjunjared1355@gmail.com',
] as const;

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  return OWNER_EMAILS.some((owner) => owner.toLowerCase() === clean);
}
