/**
 * Section 10.5 Button Surfaces (12) + Section 10.7 Compatibility Rules (C1-C11).
 */
import type {
  BgProfile,
  Background,
  ButtonSurface,
  ButtonTokens,
  LayoutTokens,
  LinkLayoutV2,
} from '../types.ts';
import { hexToOklch } from '../../color/oklch.ts';
import { cappedOklchToHex } from '../../color/gamut.ts';
import { contrastRatio, parseColorToRgba, rgbaToCssString, worstCaseContrast } from '../../color/contrast.ts';

export interface CatalogButtonSurface {
  id: ButtonSurface;
  label: string;
  description: string;
  tier: 'free' | 'pro';
}

export const CATALOG_SURFACES: readonly CatalogButtonSurface[] = [
  { id: 'solid', label: 'Solid', description: 'Crisp flat fill', tier: 'free' },
  { id: 'solid-soft', label: 'Soft shadow', description: 'Elevated soft drop', tier: 'free' },
  { id: 'soft-tint', label: 'Soft tint', description: 'Tonal wash from page', tier: 'free' },
  { id: 'outline-hairline', label: 'Outline', description: 'Clean hairline border', tier: 'free' },
  { id: 'glass', label: 'Glass', description: 'Frosted blur pane', tier: 'pro' },
  { id: 'offset-3d', label: '3D offset', description: 'Hard tactile drop', tier: 'free' },
  { id: 'gradient-flow', label: 'Gradient', description: 'Flowing dual tone', tier: 'pro' },
  { id: 'neon-glow', label: 'Neon glow', description: 'Radiant dark-mode edge', tier: 'pro' },
  { id: 'metallic', label: 'Metallic', description: 'Brushed gold & silver', tier: 'pro' },
  { id: 'neumorphic-soft', label: 'Neumorphic', description: 'Sculpted soft relief', tier: 'pro' },
  { id: 'underline-only', label: 'Underline', description: 'Minimal editorial rule', tier: 'free' },
  { id: 'sticker', label: 'Sticker', description: 'Playful tilted badge', tier: 'pro' },
] as const;

export interface CompatibilityResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Data-driven predicate checks implementing Section 10.7 rules C1-C7 for any button surface.
 */
export function checkSurfaceCompatibility(
  surface: ButtonSurface,
  bgProfile: BgProfile,
  bg: Background,
  pageAccentHex: string,
  pageTextHex: string
): CompatibilityResult {
  const isSpecialBgType =
    bg.type === 'gradient' ||
    bg.type === 'image' ||
    (bg.type === 'preset' &&
      (bgProfile.isNonFlat || bgProfile.complexity >= 0.08 || bgProfile.chromatic));

  switch (surface) {
    case 'glass': {
      // C1: glass needs a non-flat background (complexity >= 0.25, or chromatic, or type gradient/mesh/aurora/glass/image)
      if (bgProfile.complexity >= 0.25 || bgProfile.chromatic || isSpecialBgType) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Needs a patterned or colourful background',
      };
    }
    case 'neon-glow': {
      // C2: neon-glow needs tone = dark
      if (bgProfile.tone === 'dark') {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Needs a dark background',
      };
    }
    case 'neumorphic-soft': {
      // C3: neumorphic-soft needs tone = light and complexity < 0.2
      if (bgProfile.tone === 'light' && bgProfile.complexity < 0.2) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Needs a calm light background',
      };
    }
    case 'offset-3d':
    case 'sticker': {
      // C4: offset-3d and sticker need complexity < 0.35
      if (bgProfile.complexity < 0.35) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Busy background makes hard shadows muddy',
      };
    }
    case 'metallic': {
      // C5: metallic needs tone dark, or warm + mid
      if (bgProfile.tone === 'dark' || (bgProfile.warm && bgProfile.tone === 'mid')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Needs a dark or warm backdrop',
      };
    }
    case 'underline-only': {
      // C6: underline-only needs worst-case text contrast >= 7:1
      const c = worstCaseContrast(pageTextHex, [bgProfile.darkest, bgProfile.lightest]);
      if (c >= 7.0) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Needs >= 7:1 text contrast on page',
      };
    }
    case 'gradient-flow': {
      // C7: gradient-flow needs a chromatic background or an accent with chroma >= 0.08
      const accentChroma = hexToOklch(pageAccentHex).C;
      if (bgProfile.chromatic || accentChroma >= 0.08) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Needs a colourful background or accent',
      };
    }
    default:
      return { allowed: true };
  }
}

export function getFreeFallbackSurface(surface: ButtonSurface): ButtonSurface {
  switch (surface) {
    case 'glass':
      return 'soft-tint';
    case 'neon-glow':
      return 'outline-hairline';
    case 'neumorphic-soft':
      return 'solid-soft';
    case 'gradient-flow':
    case 'metallic':
      return 'solid';
    case 'sticker':
      return 'offset-3d';
    default:
      return surface;
  }
}

/**
 * C8: grid2 and chips warn when any link label > 24 characters (warn only).
 */
export function checkLinkLayoutLabelWarning(
  linkLayout: LinkLayoutV2,
  linkLabels: readonly string[]
): string | null {
  if (linkLayout !== 'grid2' && linkLayout !== 'chips') return null;
  const hasLong = linkLabels.some((lbl) => (lbl || '').trim().length > 24);
  if (!hasLong) return null;
  return linkLayout === 'grid2'
    ? '2-column works best with short labels (<= 24 chars).'
    : 'Chips work best with short labels (<= 24 chars).';
}

/**
 * C9: hero header needs avatar size l or xl (auto-bump).
 */
export function enforceLayoutInvariants(layout: LayoutTokens): LayoutTokens {
  if (layout.header === 'hero' && (layout.avatar.size === 's' || layout.avatar.size === 'm')) {
    return {
      ...layout,
      avatar: { ...layout.avatar, size: 'l' },
    };
  }
  return layout;
}

/**
 * C10: animated background + glass buttons -> blur reduced to 12px.
 */
export function getGlassBlurPx(bg: Background, hasAnimatedPreset: boolean): number {
  const isAnim = hasAnimatedPreset || (bg.type === 'preset' && Boolean(bg.animate));
  return isAnim ? 12 : 16;
}

/**
 * Computes CSS presentation values for a resolved button surface (Section 10.5).
 */
export function buildButtonSurfaceCss(params: {
  surface: ButtonSurface;
  fill: string;
  text: string;
  border: string;
  borderWidth: number;
  shadow: ButtonTokens['shadow'];
  gradient?: { to: string; angle: number };
  bgProfile: BgProfile;
  glassBlurPx?: number;
  index?: number;
}): {
  background: string;
  backgroundColor: string;
  backgroundImage?: string;
  backgroundSize?: string;
  color: string;
  border: string;
  borderBottom?: string;
  boxShadow: string;
  textShadow?: string;
  backdropFilter?: string;
  transform?: string;
  fallbackBgCss?: string;
} {
  const { surface, fill, text, border, borderWidth, shadow, gradient, bgProfile, glassBlurPx = 16, index = 0 } = params;
  const baseShadow =
    shadow === 'deep'
      ? '0 10px 28px -8px rgba(0,0,0,0.36), 0 2px 6px rgba(0,0,0,0.14)'
      : shadow === 'soft'
        ? '0 1px 2px rgba(0,0,0,0.08), 0 8px 24px -12px rgba(0,0,0,0.28)'
        : 'none';

  switch (surface) {
    case 'solid-soft':
      return {
        background: fill,
        backgroundColor: fill,
        color: text,
        border: borderWidth > 0 ? `${borderWidth}px solid ${border}` : 'none',
        boxShadow:
          shadow === 'none'
            ? '0 1px 2px rgba(0,0,0,0.08), 0 8px 24px -12px rgba(0,0,0,0.28)'
            : baseShadow,
      };
    case 'soft-tint': {
      const meanOklch = hexToOklch(bgProfile.meanHex);
      const isDark = bgProfile.tone === 'dark';
      const fillHex =
        fill !== 'transparent' && parseColorToRgba(fill)?.a === 1
          ? fill
          : cappedOklchToHex({
              L: isDark ? Math.min(0.92, meanOklch.L + 0.07) : Math.max(0.08, meanOklch.L - 0.07),
              C: Math.max(meanOklch.C, 0.02) * 1.1,
              h: meanOklch.h,
            });
      const brdOklch = hexToOklch(fillHex);
      const borderHex =
        border !== 'transparent'
          ? border
          : cappedOklchToHex({
              L: isDark ? Math.min(0.96, brdOklch.L + 0.06) : Math.max(0.05, brdOklch.L - 0.06),
              C: brdOklch.C,
              h: brdOklch.h,
            });
      return {
        background: fillHex,
        backgroundColor: fillHex,
        color: text,
        border: `${Math.max(1, borderWidth)}px solid ${borderHex}`,
        boxShadow: baseShadow,
      };
    }
    case 'outline-hairline':
      return {
        background: 'transparent',
        backgroundColor: 'transparent',
        color: text,
        border: `${Math.max(1, borderWidth || 1)}px solid ${border === 'transparent' ? text : border}`,
        boxShadow: 'none',
      };
    case 'glass': {
      const parsed = parseColorToRgba(fill);
      const isDark = bgProfile.tone === 'dark';
      const defaultGlass = isDark
        ? 'rgba(255,255,255,0.12)'
        : 'rgba(255,255,255,0.55)';
      const bgVal =
        parsed && parsed.a < 0.99
          ? fill
          : isDark
            ? 'rgba(255,255,255,0.14)'
            : 'rgba(255,255,255,0.56)';
      const pGlass = parseColorToRgba(bgVal) || { r: 255, g: 255, b: 255, a: 0.55 };
      const fallbackSolid = rgbaToCssString({
        ...pGlass,
        a: Math.min(0.95, pGlass.a + 0.15),
      });
      return {
        background: bgVal || defaultGlass,
        backgroundColor: bgVal || defaultGlass,
        fallbackBgCss: fallbackSolid,
        color: text,
        border: '1px solid rgba(255,255,255,0.28)',
        backdropFilter: `blur(${glassBlurPx}px) saturate(140%)`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 10px 30px -14px rgba(0,0,0,0.35)',
      };
    }
    case 'offset-3d': {
      const edge = border === 'transparent' ? text : border;
      const bw = Math.max(1.5, borderWidth || 2);
      return {
        background: fill === 'transparent' ? bgProfile.meanHex : fill,
        backgroundColor: fill === 'transparent' ? bgProfile.meanHex : fill,
        color: text,
        border: `${bw}px solid ${edge}`,
        boxShadow: `5px 5px 0 ${edge}`,
      };
    }
    case 'gradient-flow': {
      const fillOklch = hexToOklch(fill === 'transparent' ? '#6366F1' : fill);
      const toColor =
        gradient?.to ||
        cappedOklchToHex({
          L: fillOklch.L > 0.5 ? fillOklch.L - 0.06 : fillOklch.L + 0.06,
          C: Math.max(0.1, fillOklch.C),
          h: (fillOklch.h + 25) % 360,
        });
      const angle = gradient?.angle ?? 135;
      const gradCss = `linear-gradient(${angle}deg, ${fill === 'transparent' ? '#4F46E5' : fill}, ${toColor})`;
      return {
        background: gradCss,
        backgroundColor: fill === 'transparent' ? '#4F46E5' : fill,
        backgroundImage: gradCss,
        backgroundSize: '200% 200%',
        color: text,
        border: borderWidth > 0 ? `${borderWidth}px solid ${border}` : 'none',
        boxShadow: baseShadow,
      };
    }
    case 'neon-glow': {
      const meanOklch = hexToOklch(bgProfile.meanHex);
      const neonBg = cappedOklchToHex({
        L: Math.min(0.35, meanOklch.L + 0.03),
        C: Math.min(0.06, meanOklch.C),
        h: meanOklch.h,
      });
      const edge = border === 'transparent' ? '#00F5D4' : border;
      const edgeRgba = parseColorToRgba(edge) || { r: 0, g: 245, b: 212, a: 1 };
      const textRgba = parseColorToRgba(text) || edgeRgba;
      return {
        background: neonBg,
        backgroundColor: neonBg,
        color: text,
        border: `1.5px solid ${edge}`,
        boxShadow: `0 0 0 1px rgba(${edgeRgba.r},${edgeRgba.g},${edgeRgba.b},0.40), 0 0 18px rgba(${edgeRgba.r},${edgeRgba.g},${edgeRgba.b},0.55), inset 0 0 12px rgba(${edgeRgba.r},${edgeRgba.g},${edgeRgba.b},0.20)`,
        textShadow: `0 0 8px rgba(${textRgba.r},${textRgba.g},${textRgba.b},0.50)`,
      };
    }
    case 'metallic': {
      const useGold = bgProfile.tone === 'dark' || bgProfile.warm;
      const grad = useGold
        ? 'linear-gradient(135deg,#F6E3A1 0%,#D4AF37 35%,#8A6A22 65%,#E7C873 100%)'
        : 'linear-gradient(135deg,#FFFFFF 0%,#C8CEDA 40%,#8E98AD 70%,#EEF1F8 100%)';
      const inkColor =
        contrastRatio('#0E1220', useGold ? '#D4AF37' : '#C8CEDA') >= 4.5 ? '#0E1220' : '#0A0A09';
      return {
        background: grad,
        backgroundColor: useGold ? '#D4AF37' : '#C8CEDA',
        backgroundImage: grad,
        color: inkColor,
        border: `1px solid ${useGold ? '#E7C873' : '#94A3B8'}`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), ${baseShadow !== 'none' ? baseShadow : '0 4px 14px rgba(0,0,0,0.18)'}`,
      };
    }
    case 'neumorphic-soft': {
      const base = bgProfile.meanHex;
      return {
        background: base,
        backgroundColor: base,
        color: text,
        border: '1px solid rgba(255,255,255,0.45)',
        boxShadow: '6px 6px 14px rgba(0,0,0,0.12), -6px -6px 14px rgba(255,255,255,0.90)',
      };
    }
    case 'underline-only': {
      const line = border === 'transparent' ? text : border;
      return {
        background: 'transparent',
        backgroundColor: 'transparent',
        color: text,
        border: 'none',
        borderBottom: `1.5px solid ${line}`,
        boxShadow: 'none',
      };
    }
    case 'sticker': {
      const tilt = index % 2 === 0 ? '-0.8deg' : '0.8deg';
      const ink = border === 'transparent' ? '#0A0A0B' : border;
      return {
        background: fill === 'transparent' ? '#FFFFFF' : fill,
        backgroundColor: fill === 'transparent' ? '#FFFFFF' : fill,
        color: text,
        border: `3px solid ${ink}`,
        boxShadow: `4px 4px 0 ${ink}`,
        transform: `rotate(${tilt})`,
      };
    }
    case 'solid':
    default:
      return {
        background: fill,
        backgroundColor: fill,
        color: text,
        border: borderWidth > 0 ? `${borderWidth}px solid ${border}` : 'none',
        boxShadow: shadow === 'none' ? 'none' : baseShadow,
      };
  }
}
