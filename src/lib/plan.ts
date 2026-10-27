export const PRO_FEATURES = [
  'embeds',
  'scheduling',
  'hide_footer',
  'analytics_detail',
  'password_links',
  'contact_forms',
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

export const PRO_FEATURE_NAMES: Record<ProFeature, string> = {
  embeds: 'Embeds',
  scheduling: 'Scheduling',
  hide_footer: 'Removing the iveo mark',
  analytics_detail: 'Advanced analytics',
  password_links: 'Password-protected links',
  contact_forms: 'Email and phone collection',
};

export function getProFeatureName(feature: ProFeature): string {
  return PRO_FEATURE_NAMES[feature] || 'Pro feature';
}
