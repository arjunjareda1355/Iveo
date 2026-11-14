import QRCode from 'qrcode';
import { normalizeHexColor, parseHexRgb } from './colors.ts';

const svgCache = new Map<string, string>();
const pngCache = new Map<string, string>();

export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrOptions {
  darkColor?: string;
  lightColor?: string;
  errorCorrectionLevel?: QrErrorCorrectionLevel;
  margin?: number;
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Computes WCAG 2.1 contrast ratio between two hex colors (1.0 .. 21.0).
 * QR scanners reliably need >= 3.0 between module foreground and background.
 */
export function getHexContrastRatio(hexA: string, hexB: string): number {
  const rgbA = parseHexRgb(hexA);
  const rgbB = parseHexRgb(hexB);
  if (!rgbA || !rgbB) return 21;
  const l1 = relativeLuminance(rgbA);
  const l2 = relativeLuminance(rgbB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

export async function makeQrSvg(url: string, options?: QrOptions): Promise<string> {
  const dark = normalizeHexColor(options?.darkColor) || '#0A0A0A';
  const light = normalizeHexColor(options?.lightColor) || '#FFFFFF';
  const ecc: QrErrorCorrectionLevel = options?.errorCorrectionLevel || 'M';
  const margin = typeof options?.margin === 'number' ? options.margin : 4;
  const cacheKey = `${url}::${dark}::${light}::${ecc}::${margin}`;

  const cached = svgCache.get(cacheKey);
  if (cached) return cached;

  const result = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: ecc,
    margin,
    color: {
      dark,
      light,
    },
  });

  svgCache.set(cacheKey, result);
  return result;
}

export async function makeQrPngDataUrl(url: string, options?: QrOptions): Promise<string> {
  const dark = normalizeHexColor(options?.darkColor) || '#0A0A0A';
  const light = normalizeHexColor(options?.lightColor) || '#FFFFFF';
  const ecc: QrErrorCorrectionLevel = options?.errorCorrectionLevel || 'M';
  const margin = typeof options?.margin === 'number' ? options.margin : 4;
  const cacheKey = `${url}::${dark}::${light}::${ecc}::${margin}`;

  const cached = pngCache.get(cacheKey);
  if (cached) return cached;

  const result = await QRCode.toDataURL(url, {
    type: 'image/png',
    width: 1024,
    errorCorrectionLevel: ecc,
    margin,
    color: {
      dark,
      light,
    },
  });

  pngCache.set(cacheKey, result);
  return result;
}

export function downloadPng(pngDataUrl: string, username: string): void {
  const link = document.createElement('a');
  link.download = `iveo-${username}-qr.png`;
  link.href = pngDataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadSvg(svgString: string, username: string): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `iveo-${username}-qr.svg`;
  link.href = objectUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 100);
}
