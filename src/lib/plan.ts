export const PRO_FEATURES = ['embeds', 'scheduling', 'hide_footer'] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

export const PRO_FEATURE_NAMES: Record<ProFeature, string> = {
  embeds: 'Embeds',
  scheduling: 'Scheduling',
  hide_footer: 'Removing the iveo mark',
};

export function getProFeatureName(feature: ProFeature): string {
  return PRO_FEATURE_NAMES[feature] || 'Pro feature';
}
