import QRCode from 'qrcode';
import { buildVCardString, sanitizeVCardFilename } from './vcard';
import {
  BusinessCardConfig,
  CARD_BASE_HEIGHT,
  CARD_BASE_WIDTH,
  CARD_EXPORT_SCALE,
  DEFAULT_BUSINESS_CARD_CONFIG,
  parseBusinessCardConfig,
  resolveBusinessCardAppearance,
} from './businessCardConfig';
import { ensureCanvasFontLoaded } from './fonts';
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
  const effectiveUrl = cfg?.websiteUrl
    ? (cfg.websiteUrl.startsWith('http') ? cfg.websiteUrl : `https://${cfg.websiteUrl}`)
    : data.pageUrl;

  const vcfContent = buildVCardString({
    fullName: data.displayName || data.username,
    url: effectiveUrl,
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

export function isLightColor(color?: string): boolean {
  return isLightHexColor(color);
}

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

  if (src.startsWith('data:') || src.startsWith('/')) {
    return tryLoad(src, false);
  }

  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(src)}`;
  const proxiedImg = await tryLoad(proxyUrl, false);
  if (proxiedImg) return proxiedImg;

  return tryLoad(src, true);
}

function drawVectorIcon(
  ctx: CanvasRenderingContext2D,
  kind: 'pin' | 'mail' | 'phone',
  x: number,
  y: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  const s = size / 24;
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (kind === 'pin') {
    ctx.beginPath();
    ctx.moveTo(20, 10);
    ctx.bezierCurveTo(20, 16, 12, 22, 12, 22);
    ctx.bezierCurveTo(12, 22, 4, 16, 4, 10);
    ctx.arc(12, 10, 8, Math.PI, 0, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(12, 10, 3, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 'mail') {
    ctx.beginPath();
    ctx.roundRect(2, 4, 20, 16, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, 7);
    ctx.lineTo(13.03, 12.7);
    ctx.quadraticCurveTo(12, 13.3, 10.97, 12.7);
    ctx.lineTo(2, 7);
    ctx.stroke();
  } else if (kind === 'phone') {
    ctx.beginPath();
    ctx.moveTo(22, 16.92);
    ctx.lineTo(22, 19.92);
    ctx.quadraticCurveTo(22, 21.8, 19.98, 22);
    ctx.bezierCurveTo(12, 21.2, 2.8, 12, 2, 4.02);
    ctx.quadraticCurveTo(2.2, 2, 4.08, 2);
    ctx.lineTo(7.08, 2);
    ctx.quadraticCurveTo(8.5, 2, 8.9, 3.4);
    ctx.lineTo(9.8, 6.2);
    ctx.quadraticCurveTo(10, 7.2, 9.2, 8);
    ctx.lineTo(7.8, 9.4);
    ctx.bezierCurveTo(9.1, 12.2, 11.8, 14.9, 14.6, 16.2);
    ctx.lineTo(16, 14.8);
    ctx.quadraticCurveTo(16.8, 14, 17.8, 14.2);
    ctx.lineTo(20.6, 15.1);
    ctx.quadraticCurveTo(22, 15.5, 22, 16.92);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Generates an ultra-high-resolution PNG (2040x1200, 1.7:1) pixel-identical to BusinessCardPreview
 * by drawing in the exact 600x353 canonical layout coordinate space scaled 3.4x.
 */
export async function generateBusinessCardPng(data: BusinessCardData): Promise<string> {
  const canvasWidth = 2040;
  const canvasHeight = 1200;
  const W = CARD_BASE_WIDTH;
  const H = CARD_BASE_HEIGHT;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas 2D context not available');

  const cfg: BusinessCardConfig = {
    ...DEFAULT_BUSINESS_CARD_CONFIG,
    ...(parseBusinessCardConfig(data.cardConfig) || {}),
  };

  // Preload Google Font weights 400/500/600/700 for Canvas
  const fontPrimary = await ensureCanvasFontLoaded(cfg.fontId, 'Inter, system-ui, sans-serif');
  const monoFont = 'ui-monospace, "SF Mono", Menlo, monospace';
  const app = resolveBusinessCardAppearance(cfg, data.theme);

  let qrDataUrl = data.qrDataUrl;
  try {
    qrDataUrl = await QRCode.toDataURL(
      data.pageUrl.includes('src=qr') ? data.pageUrl : `${data.pageUrl}?src=qr`,
      {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: app.qrFg, light: app.qrBg },
      }
    );
  } catch {}
  const qrImg = qrDataUrl ? await loadCanvasSafeAvatar(qrDataUrl) : null;

  const avatarImg =
    cfg.showAvatar !== false && data.avatarUrl
      ? await loadCanvasSafeAvatar(data.avatarUrl)
      : null;

  const cleanUsername = (data.username || 'creator').toLowerCase().trim();
  const initials = (data.displayName || cleanUsername).slice(0, 2).toUpperCase();

  const renderCard = (includeAvatarImage: boolean) => {
    ctx.save();
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.scale(CARD_EXPORT_SCALE, CARD_EXPORT_SCALE);

    // Clip card shape
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, app.cornerRadius);
    ctx.clip();

    // Base fill & template gradients
    ctx.fillStyle = app.bgColor;
    ctx.fillRect(0, 0, W, H);

    if (cfg.bgColor && app.bgColor2) {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, cfg.bgColor);
      grad.addColorStop(1, app.bgColor2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (app.template === 'gradient') {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, app.bgColor);
      grad.addColorStop(1, app.bgColor2 || `${app.accentColor}44`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (app.template === 'midnight') {
      const rad = ctx.createRadialGradient(W * 0.85, H * 0.15, 3, W * 0.85, H * 0.15, W * 0.56);
      rad.addColorStop(0, `${app.accentColor}3D`);
      rad.addColorStop(1, 'transparent');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, W, H);
    } else if (app.template === 'classic' && !app.bgColor2) {
      ctx.save();
      ctx.fillStyle = app.accentColor;
      ctx.globalAlpha = app.isLight ? 0.09 : 0.17;
      ctx.beginPath();
      if (app.isLight) {
        ctx.arc(48, H - 34, 110, 0, Math.PI * 2);
      } else {
        ctx.arc(W - 58, 42, 110, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    } else if (app.template === 'executive') {
      ctx.fillStyle = app.accentColor;
      ctx.fillRect(0, 0, 8, H);
    } else if (app.template === 'editorial') {
      ctx.strokeStyle = `${app.accentColor}4D`;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.roundRect(13, 13, W - 26, H - 26, app.innerCornerRadius);
      ctx.stroke();
    }

    // Card outer hairline border matching DOM
    ctx.strokeStyle = app.borderColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(0.75, 0.75, W - 1.5, H - 1.5, app.cornerRadius);
    ctx.stroke();

    const padX = 34 + (app.template === 'executive' ? 4 : 0);
    const padRight = 34;
    const padY = 30;
    let textStartX = padX;

    // Avatar
    if (cfg.showAvatar !== false) {
      const avatarSize = 62;
      const cx = padX + avatarSize / 2;
      const cy = padY + avatarSize / 2;

      if (includeAvatarImage && avatarImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();
        const scale = Math.max(avatarSize / avatarImg.width, avatarSize / avatarImg.height);
        const dw = avatarImg.width * scale;
        const dh = avatarImg.height * scale;
        ctx.drawImage(avatarImg, cx - dw / 2, cy - dh / 2, dw, dh);
        ctx.restore();

        ctx.strokeStyle = app.accentColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = app.accentColor;
        ctx.beginPath();
        ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = app.borderColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = isLightColor(app.accentColor) ? '#0A0A0A' : '#FFFFFF';
        ctx.font = `700 23px ${fontPrimary}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, cx, cy + 1);
      }

      textStartX = padX + avatarSize + 15;
    }

    // QR Code Top-Right
    const qrBoxSize = 72;
    const qrBoxX = W - padRight - qrBoxSize;
    const qrBoxY = padY;
    const maxIdentityRight = cfg.showQr !== false ? qrBoxX - 16 : W - padRight;

    if (cfg.showQr !== false && qrImg) {
      ctx.save();
      ctx.fillStyle = app.qrBg;
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.drawImage(qrImg, qrBoxX + 5, qrBoxY + 5, qrBoxSize - 10, qrBoxSize - 10);
      ctx.restore();
    }

    // Identity Text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let curY = cfg.badgeText ? padY : padY + 6;
    const maxNameWidth = Math.max(120, maxIdentityRight - textStartX);

    if (cfg.badgeText) {
      ctx.font = `700 9.5px ${fontPrimary}`;
      const badgeLabel = cfg.badgeText.toUpperCase();
      const textW = ctx.measureText(badgeLabel).width;
      const badgeW = Math.min(textW + 18, maxNameWidth);
      const badgeH = 18;
      ctx.save();
      ctx.fillStyle = `${app.accentColor}24`;
      ctx.beginPath();
      ctx.roundRect(textStartX, curY, badgeW, badgeH, 999);
      ctx.fill();
      ctx.strokeStyle = `${app.accentColor}4D`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = app.accentColor;
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeLabel, textStartX + 9, curY + badgeH / 2 + 0.5, badgeW - 18);
      ctx.restore();
      curY += badgeH + 6;
    }

    ctx.textBaseline = 'top';
    ctx.fillStyle = app.textColor;
    ctx.font = `700 22px ${fontPrimary}`;
    let fittedName = data.displayName || cleanUsername;
    while (fittedName.length > 3 && ctx.measureText(fittedName).width > maxNameWidth) {
      fittedName = `${fittedName.slice(0, -2)}…`;
    }
    ctx.fillText(fittedName, textStartX, curY);
    curY += 29;

    // Subtitle Row (Role · @handle · Location)
    let subX = textStartX;
    let subY = curY;
    const drawInlineSubPart = (
      text: string,
      color: string,
      fontSpec: string,
      pinIcon = false
    ) => {
      ctx.font = fontSpec;
      const w = ctx.measureText(text).width + (pinIcon ? 14 : 0);
      if (subX > textStartX && subX + w > textStartX + maxNameWidth) {
        subX = textStartX;
        subY += 16;
      }
      if (pinIcon) {
        drawVectorIcon(ctx, 'pin', subX, subY + 1.5, 11, color);
        subX += 14;
      }
      ctx.fillStyle = color;
      ctx.fillText(text, subX, subY, maxNameWidth - (subX - textStartX));
      subX += Math.min(ctx.measureText(text).width, maxNameWidth) + 6;
    };

    const showRole = Boolean(cfg.role);
    const showHandle = cfg.showHandle !== false;
    const showLoc = Boolean(cfg.companyOrLocation);

    if (showRole && cfg.role) {
      drawInlineSubPart(cfg.role, app.accentColor, `600 12px ${fontPrimary}`);
    }
    if (showRole && showHandle) {
      drawInlineSubPart('·', app.mutedColor, `500 12px ${fontPrimary}`);
    }
    if (showHandle) {
      drawInlineSubPart(`@${cleanUsername}`, app.mutedColor, `400 12px ${monoFont}`);
    }
    if ((showRole || showHandle) && showLoc) {
      drawInlineSubPart('·', app.mutedColor, `500 12px ${fontPrimary}`);
    }
    if (showLoc && cfg.companyOrLocation) {
      drawInlineSubPart(cfg.companyOrLocation, app.mutedColor, `400 12px ${fontPrimary}`, true);
    }

    // Middle Row: Bio & Contact (centered vertically in space above footer)
    const footerTopY = H - padY - 30; // ~293
    const middleAreaTop = Math.max(padY + (cfg.showAvatar !== false ? 70 : 62), subY + 22);
    const hasBio = cfg.showBio !== false && Boolean(data.bio?.trim());
    const hasContact = Boolean(cfg.contactEmail || cfg.contactPhone);

    const bioLines: string[] = [];
    if (hasBio && data.bio) {
      ctx.font = `400 13px ${fontPrimary}`;
      const maxBioWidth = W - padX - padRight;
      const words = data.bio.trim().split(/\s+/);
      let line = '';
      for (let i = 0; i < words.length; i++) {
        const testLine = `${line}${words[i]} `;
        if (ctx.measureText(testLine.trim()).width > maxBioWidth && line.length > 0) {
          if (bioLines.length === 1) {
            let trimmed = line.trim();
            while (trimmed.length > 3 && ctx.measureText(`${trimmed}…`).width > maxBioWidth) {
              trimmed = trimmed.slice(0, -1);
            }
            bioLines.push(`${trimmed}…`);
            line = '';
            break;
          }
          bioLines.push(line.trim());
          line = `${words[i]} `;
        } else {
          line = testLine;
        }
      }
      if (line.trim() && bioLines.length < 2) {
        bioLines.push(line.trim());
      }
    }

    const bioHeight = bioLines.length * 19;
    const contactHeight = hasContact ? 18 : 0;
    const gapBetween = bioLines.length > 0 && hasContact ? 8 : 0;
    const totalMidHeight = bioHeight + gapBetween + contactHeight;
    let midY = middleAreaTop + Math.max(0, (footerTopY - middleAreaTop - totalMidHeight) / 2);

    if (bioLines.length > 0) {
      ctx.fillStyle = app.mutedColor;
      ctx.font = `400 13px ${fontPrimary}`;
      ctx.textBaseline = 'top';
      for (const l of bioLines) {
        ctx.fillText(l, padX, midY);
        midY += 19;
      }
      if (hasContact) midY += 8;
    }

    if (hasContact) {
      let cx = padX;
      ctx.font = `400 11.5px ${fontPrimary}`;
      ctx.textBaseline = 'top';
      if (cfg.contactEmail) {
        drawVectorIcon(ctx, 'mail', cx, midY + 1.5, 11.5, app.accentColor);
        cx += 16.5;
        ctx.fillStyle = app.textColor;
        ctx.fillText(cfg.contactEmail, cx, midY);
        cx += ctx.measureText(cfg.contactEmail).width + 14;
      }
      if (cfg.contactPhone) {
        drawVectorIcon(ctx, 'phone', cx, midY + 1.5, 11.5, app.accentColor);
        cx += 16.5;
        ctx.fillStyle = app.textColor;
        ctx.fillText(cfg.contactPhone, cx, midY);
      }
    }

    // Bottom Footer Bar
    ctx.strokeStyle = app.borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, footerTopY);
    ctx.lineTo(W - padRight, footerTopY);
    ctx.stroke();

    const footerTextY = footerTopY + 18;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = app.textColor;
    ctx.font = `700 13.5px ${fontPrimary}`;
    ctx.fillText('iveo', padX, footerTextY);

    ctx.textAlign = 'right';
    ctx.fillStyle = app.mutedColor;
    ctx.font = `400 11.5px ${monoFont}`;
    ctx.fillText(
      cfg.websiteUrl || `iveo.site/${cleanUsername}`,
      W - padRight,
      footerTextY,
      420
    );

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
