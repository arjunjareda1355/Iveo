export const PRO_FEATURES = [
  'embeds',
  'scheduling',
  'hide_footer',
  'analytics_detail',
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

export const PRO_FEATURE_NAMES: Record<ProFeature, string> = {
  embeds: 'Embeds',
  scheduling: 'Scheduling',
  hide_footer: 'Removing the iveo mark',
  analytics_detail: 'Advanced analytics',
};

export function getProFeatureName(feature: ProFeature): string {
  return PRO_FEATURE_NAMES[feature] || 'Pro feature';
}
