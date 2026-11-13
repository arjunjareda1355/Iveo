import QRCode from 'qrcode';
import { buildVCardString, sanitizeVCardFilename } from './vcard';
import {
  BusinessCardConfig,
  DEFAULT_BUSINESS_CARD_CONFIG,
  parseBusinessCardConfig,
} from './businessCardConfig';
import { getCanvasFontName, loadGoogleFonts } from './fonts';
import { isLightHexColor } from './colors';

export interface BusinessCardData {
  displayName: string;
  username: string;
  bio?: string;
  pageUrl: string;
  avatarUrl?: string | null;
  qrDataUrl?: string | null;
  cardConfig?: BusinessCardConfig | null;
  theme?: {
    bg?: string;
    text?: string;
    muted?: string;
    accent?: string;
    buttonBg?: string;
  };
}

/**
 * Downloads a standard RFC 6350 vCard (.vcf) for instant contact import on mobile & desktop.
 */
export function downloadVCard(data: BusinessCardData): void {
  const cfg = parseBusinessCardConfig(data.cardConfig);
  const vcfContent = buildVCardString({
    fullName: data.displayName || data.username,
    url: data.pageUrl,
    email: cfg?.contactEmail || undefined,
    phone: cfg?.contactPhone || undefined,
    organization: cfg?.companyOrLocation || undefined,
    title: cfg?.role || 'Creator',
    note: data.bio ? `${data.bio}\n\nPage: ${data.pageUrl}` : `Page: ${data.pageUrl}`,
  });

  const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = sanitizeVCardFilename(data.displayName || data.username);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

/**
 * Determines whether a CSS hex color is perceptually light (for high-contrast borders/overlays).
 */
export function isLightColor(color?: string): boolean {
  return isLightHexColor(color);
}

/**
 * Converts a base64 Data URL into a binary Blob for reliable browser & mobile file downloads.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(parts[1] || '');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Loads an image safely with timeout and CORS, routing external URLs through /api/proxy-image
 * so external avatars (Clerk, postimg, Google, etc.) draw onto HTML5 Canvas without tainting it.
 */
async function loadCanvasSafeAvatar(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;

  const tryLoad = (url: string, withCrossOrigin: boolean): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const img = new Image();
      let isDone = false;
      const timer = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          resolve(null);
        }
      }, 4500);

      if (withCrossOrigin && !url.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);
          resolve(img);
        }
      };
      img.onerror = () => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);
          resolve(null);
        }
      };
      img.src = url;
    });

  // Relative or data URLs can load directly from same origin
  if (src.startsWith('data:') || src.startsWith('/')) {
    return tryLoad(src, false);
  }

  // External HTTP/HTTPS URL -> try same-origin CORS proxy first, then direct CORS fallback
  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(src)}`;
  const proxiedImg = await tryLoad(proxyUrl, false);
  if (proxiedImg) return proxiedImg;

  return tryLoad(src, true);
}

/**
 * Generates an ultra-high-resolution PNG (2040x1200, exact 1.7:1 ratio matching the card preview!)
 * pixel-identical to BusinessCardPreview.
 */
export async function generateBusinessCardPng(data: BusinessCardData): Promise<string> {
  const width = 2040;
  const height = 1200;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas 2D context not available');

  const cfg: BusinessCardConfig = {
    ...DEFAULT_BUSINESS_CARD_CONFIG,
    ...(parseBusinessCardConfig(data.cardConfig) || {}),
  };

  // Ensure card Google Font is loaded & ready before Canvas text draw calls
  if (cfg.fontId) {
    loadGoogleFonts([cfg.fontId]);
    try {
      if (typeof document !== 'undefined' && document.fonts) {
        await Promise.race([
          document.fonts.ready,
          new Promise((r) => setTimeout(r, 1500)),
        ]);
      }
    } catch {}
  }

  const fontPrimary = getCanvasFontName(cfg.fontId, 'Inter, system-ui, sans-serif');
  const template = cfg.template || 'classic';

  // Resolve template palette identically to BusinessCardPreview
  let bgColor = cfg.bgColor || data.theme?.bg || '#0F172A';
  let accentColor = cfg.accentColor || data.theme?.accent || data.theme?.buttonBg || '#4F46E5';
  let textColor = cfg.textColor || data.theme?.text || '#FFFFFF';

  if (template === 'gradient' && !cfg.bgColor) {
    bgColor = '#0F172A';
    accentColor = cfg.accentColor || '#38BDF8';
    textColor = cfg.textColor || '#FFFFFF';
  } else if (template === 'midnight') {
    bgColor = cfg.bgColor || '#09090B';
    textColor = cfg.textColor || '#FAFAFA';
    accentColor = cfg.accentColor || '#A855F7';
  } else if (template === 'executive' && !cfg.bgColor) {
    bgColor = '#111827';
    textColor = cfg.textColor || '#F9FAFB';
    accentColor = cfg.accentColor || '#38BDF8';
  } else if (template === 'editorial' && !cfg.bgColor) {
    bgColor = '#FAF8F5';
    textColor = cfg.textColor || '#1C1917';
    accentColor = cfg.accentColor || '#B45309';
  }

  const bgIsLight = isLightColor(bgColor);
  if (!cfg.textColor && (template === 'classic' || !data.theme?.text)) {
    textColor = data.theme?.text || (bgIsLight ? '#0A0A0A' : '#FFFFFF');
  }
  const mutedColor = bgIsLight ? 'rgba(15, 23, 42, 0.68)' : 'rgba(255, 255, 255, 0.72)';
  const borderStroke = bgIsLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.18)';

  // 1. Crisp 1024px QR code locally
  let qrDataUrl = data.qrDataUrl;
  try {
    qrDataUrl = await QRCode.toDataURL(data.pageUrl, {
      width: 1024,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#0A0A0A', light: '#FFFFFF' },
    });
  } catch {}
  const qrImg = qrDataUrl ? await loadCanvasSafeAvatar(qrDataUrl) : null;

  // 2. Load avatar via same-origin proxy when external
  const avatarImg =
    cfg.showAvatar !== false && data.avatarUrl
      ? await loadCanvasSafeAvatar(data.avatarUrl)
      : null;

  const cleanUsername = (data.username || 'creator').toLowerCase().trim();
  const initials = (data.displayName || cleanUsername).slice(0, 2).toUpperCase();

  const cardRadius =
    cfg.cornerStyle === 'sharp' ? 16 : cfg.cornerStyle === 'pill' ? 112 : 72;

  const renderCard = (includeAvatarImage: boolean) => {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Clip to card outer radius before filling so outer corners stay transparent
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, cardRadius);
    ctx.clip();

    // Base fill
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Template-specific backdrop layer matching BusinessCardPreview
    if (template === 'gradient') {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, bgColor);
      grad.addColorStop(1, `${accentColor}44`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else if (template === 'midnight') {
      const rad = ctx.createRadialGradient(width * 0.85, height * 0.15, 10, width * 0.85, height * 0.15, width * 0.6);
      rad.addColorStop(0, `${accentColor}45`);
      rad.addColorStop(1, 'transparent');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, width, height);
    } else if (template === 'classic') {
      ctx.save();
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = bgIsLight ? 0.09 : 0.18;
      ctx.beginPath();
      if (bgIsLight) {
        ctx.arc(160, height - 120, 420, 0, Math.PI * 2);
      } else {
        ctx.arc(width - 200, 140, 400, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    } else if (template === 'executive') {
      ctx.fillStyle = accentColor;
      ctx.fillRect(0, 0, 24, height);
    } else if (template === 'editorial') {
      ctx.strokeStyle = `${accentColor}55`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(42, 42, width - 84, height - 84, Math.max(8, cardRadius - 24));
      ctx.stroke();
    }

    // Subtle outer border
    ctx.strokeStyle = borderStroke;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(2, 2, width - 4, height - 4, cardRadius);
    ctx.stroke();

    const padX = 110;
    const topY = 104;
    let textStartX = padX;

    // 3. Avatar or Initials Monogram (when showAvatar !== false)
    if (cfg.showAvatar !== false) {
      const avatarSize = 200;
      const cx = padX + avatarSize / 2;
      const cy = topY + avatarSize / 2;

      if (includeAvatarImage && avatarImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();
        // Cover fit
        const scale = Math.max(avatarSize / avatarImg.width, avatarSize / avatarImg.height);
        const dw = avatarImg.width * scale;
        const dh = avatarImg.height * scale;
        ctx.drawImage(avatarImg, cx - dw / 2, cy - dh / 2, dw, dh);
        ctx.restore();

        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = borderStroke;
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.fillStyle = isLightColor(accentColor) ? '#0A0A0A' : '#FFFFFF';
        ctx.font = `700 78px ${fontPrimary}, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, cx, cy + 4);
      }

      textStartX = padX + avatarSize + 48;
    }

    // 4. Right QR box (when showQr !== false)
    const qrBoxSize = 240;
    const qrBoxX = width - padX - qrBoxSize;
    const qrBoxY = topY;
    const maxIdentityRight = cfg.showQr !== false ? qrBoxX - 48 : width - padX;

    if (cfg.showQr !== false && qrImg) {
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 28);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.drawImage(qrImg, qrBoxX + 18, qrBoxY + 18, qrBoxSize - 36, qrBoxSize - 36);
      ctx.restore();
    }

    // 5. Badge pill + Display Name + Role/Handle/Location
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let curY = topY + 4;

    if (cfg.badgeText) {
      ctx.font = `700 30px ${fontPrimary}, system-ui, sans-serif`;
      const badgeLabel = cfg.badgeText.toUpperCase();
      const badgeW = Math.min(ctx.measureText(badgeLabel).width + 52, maxIdentityRight - textStartX);
      ctx.save();
      ctx.fillStyle = `${accentColor}26`;
      ctx.beginPath();
      ctx.roundRect(textStartX, curY, badgeW, 54, 999);
      ctx.fill();
      ctx.strokeStyle = `${accentColor}55`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeLabel, textStartX + 26, curY + 28, badgeW - 52);
      ctx.restore();
      curY += 72;
    }

    ctx.textBaseline = 'top';
    ctx.fillStyle = textColor;
    ctx.font = `700 72px ${fontPrimary}, system-ui, sans-serif`;
    let fittedName = data.displayName || cleanUsername;
    const maxNameWidth = maxIdentityRight - textStartX;
    while (fittedName.length > 3 && ctx.measureText(fittedName).width > maxNameWidth) {
      fittedName = `${fittedName.slice(0, -2)}…`;
    }
    ctx.fillText(fittedName, textStartX, curY);
    curY += 86;

    const subLine = cfg.role
      ? [cfg.role, cfg.companyOrLocation].filter(Boolean).join(' · ')
      : `@${cleanUsername}${cfg.companyOrLocation ? ` · ${cfg.companyOrLocation}` : ''}`;
    ctx.font = `500 40px ${fontPrimary}, system-ui, sans-serif`;
    ctx.fillStyle = cfg.role ? accentColor : mutedColor;
    ctx.fillText(subLine, textStartX, curY, maxNameWidth);

    // 6. Middle Section: Bio + Contact Line
    let midY = Math.max(curY + 95, 450);
    if (data.bio) {
      ctx.fillStyle = mutedColor;
      ctx.font = `400 42px ${fontPrimary}, system-ui, sans-serif`;
      const maxBioWidth = width - padX * 2;
      const words = data.bio.trim().split(/\s+/);
      let line = '';
      let linesDrawn = 0;

      for (let i = 0; i < words.length && linesDrawn < 3; i++) {
        const testLine = `${line}${words[i]} `;
        if (ctx.measureText(testLine).width > maxBioWidth && i > 0) {
          ctx.fillText(line.trim(), padX, midY);
          line = `${words[i]} `;
          midY += 62;
          linesDrawn++;
        } else {
          line = testLine;
        }
      }
      if (line.trim() && linesDrawn < 3) {
        ctx.fillText(line.trim(), padX, midY);
        midY += 76;
      }
    }

    if (cfg.contactEmail || cfg.contactPhone) {
      const contactParts = [cfg.contactEmail, cfg.contactPhone].filter(Boolean).join('   ·   ');
      ctx.font = `500 36px ${fontPrimary}, system-ui, sans-serif`;
      ctx.fillStyle = textColor;
      ctx.fillText(contactParts, padX, Math.min(midY + 12, height - 290), width - padX * 2);
    }

    // 7. Bottom Footer Bar matching preview
    const footerY = height - 180;
    ctx.strokeStyle = borderStroke;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(padX, footerY);
    ctx.lineTo(width - padX, footerY);
    ctx.stroke();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = textColor;
    ctx.font = `700 44px ${fontPrimary}, system-ui, sans-serif`;
    ctx.fillText('iveo', padX, footerY + 82);

    ctx.textAlign = 'right';
    ctx.fillStyle = mutedColor;
    ctx.font = '500 38px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.fillText(`iveo.site/${cleanUsername}`, width - padX, footerY + 82);

    ctx.restore();
  };

  try {
    renderCard(true);
    return canvas.toDataURL('image/png', 1.0);
  } catch {
    renderCard(false);
    return canvas.toDataURL('image/png', 1.0);
  }
}

/**
 * Generates an ultra-crisp 2040x1200 (1.7:1) business card PNG matching the preview
 * and triggers browser download via Blob URL.
 */
export async function downloadBusinessCardPng(
  data: BusinessCardData
): Promise<{ dataUrl: string; blob: Blob }> {
  const dataUrl = await generateBusinessCardPng(data);
  const blob = dataUrlToBlob(dataUrl);
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `iveo-card-${(data.username || 'creator').replace(/[^a-z0-9-_]/gi, '')}.png`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 2000);

  return { dataUrl, blob };
}
