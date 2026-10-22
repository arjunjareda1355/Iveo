/**
 * Chart math utilities and scale calculations.
 *
 * Examples for niceMax:
 *   niceMax(0)   => 4
 *   niceMax(3)   => 4
 *   niceMax(7)   => 10
 *   niceMax(13)  => 20
 *   niceMax(48)  => 50
 *   niceMax(130) => 200
 */
export function niceMax(value: number): number {
  if (value <= 4) {
    return 4;
  }

  const exponent = Math.floor(Math.log10(value));
  const fraction = value / Math.pow(10, exponent);

  let niceFraction: number;
  if (fraction <= 1) {
    niceFraction = 1;
  } else if (fraction <= 2) {
    niceFraction = 2;
  } else if (fraction <= 5) {
    niceFraction = 5;
  } else {
    niceFraction = 10;
  }

  return niceFraction * Math.pow(10, exponent);
}

/**
 * Returns three tick values for the chart Y-axis: [0, max / 2, max].
 */
export function yTicks(max: number): number[] {
  return [0, Math.round(max / 2), max];
}

/**
 * Formats Click-Through Rate (CTR).
 * Returns "–" when views is 0; otherwise formatted percentage with 1 decimal place, capped at "100%".
 */
export function formatCtr(clicks: number, views: number): string {
  if (!views || views <= 0) {
    return '–';
  }

  const rawRate = (clicks / views) * 100;
  if (rawRate >= 100) {
    return '100%';
  }

  return `${rawRate.toFixed(1)}%`;
}
