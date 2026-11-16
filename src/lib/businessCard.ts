import QRCode from 'qrcode';
import { buildVCardString, sanitizeVCardFilename } from './vcard';
import {
  BusinessCardConfig,
  CARD_BASE_HEIGHT,
  CARD_BASE_WIDTH,
  CARD_EXPORT_SCALE,
  DEFAULT_BUSINESS_CARD_CONFIG,
  ResolvedCardAppearance,
  buildBackSocialLinks,
  parseBusinessCardConfig,
  resolveBackCardAppearance,
  resolveFrontCardAppearance,
} from './businessCardConfig';
import { ensureCanvasFontLoaded } from './fonts';
import { isLightHexColor } from './colors';
import { VERIFIED_TICK_IMAGE_URL } from '../components/ui/VerifiedTick';

export interface BusinessCardData {
  displayName: string;
  username: string;
  bio?: string;
  pageUrl: string;
  avatarUrl?: string | null;
  socials?: Record<string, string> | null;
  isPro?: boolean;
  qrDataUrl?: string | null;
  side?: 'front' | 'back' | 'both';
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

function drawSocialGlyph(
  ctx: CanvasRenderingContext2D,
  platform: string,
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
  ctx.fillStyle = color;
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const p = platform.toLowerCase();
  if (p === 'instagram') {
    ctx.beginPath();
    ctx.roundRect(3, 3, 18, 18, 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(12, 12, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(17.5, 6.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p === 'youtube') {
    ctx.beginPath();
    ctx.roundRect(2, 5, 20, 14, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 9);
    ctx.lineTo(16, 12);
    ctx.lineTo(10, 15);
    ctx.closePath();
    ctx.fill();
  } else if (p === 'x' || p === 'twitter') {
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(20, 20);
    ctx.moveTo(20, 4);
    ctx.lineTo(4, 20);
    ctx.stroke();
  } else if (p === 'mail' || p === 'email') {
    ctx.beginPath();
    ctx.roundRect(2, 4, 20, 16, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, 7);
    ctx.lineTo(12, 13);
    ctx.lineTo(2, 7);
    ctx.stroke();
  } else {
    // Crisp Globe / Link icon
    ctx.beginPath();
    ctx.arc(12, 12, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, 12);
    ctx.lineTo(21, 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(12, 12, 4.2, 9, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVerifiedTickCanvas(
  ctx: CanvasRenderingContext2D,
  verifiedImg: HTMLImageElement | null,
  tickX: number,
  tickY: number,
  tickSize: number,
  onDark: boolean
) {
  ctx.save();
  if (onDark) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(tickX + tickSize / 2, tickY + tickSize / 2, tickSize / 2 + 1, 0, Math.PI * 2);
    ctx.fill();
  }
  if (verifiedImg) {
    ctx.drawImage(
      verifiedImg,
      tickX + (onDark ? 1 : 0),
      tickY + (onDark ? 1 : 0),
      tickSize - (onDark ? 2 : 0),
      tickSize - (onDark ? 2 : 0)
    );
  } else {
    ctx.fillStyle = '#0A0A0A';
    ctx.beginPath();
    ctx.arc(tickX + tickSize / 2, tickY + tickSize / 2, tickSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(tickX + tickSize * 0.28, tickY + tickSize * 0.52);
    ctx.lineTo(tickX + tickSize * 0.44, tickY + tickSize * 0.68);
    ctx.lineTo(tickX + tickSize * 0.74, tickY + tickSize * 0.34);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCardBaseBackground(
  ctx: CanvasRenderingContext2D,
  app: ResolvedCardAppearance,
  W: number,
  H: number
) {
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, app.cornerRadius);
  ctx.clip();

  // Base fill & dual-tone gradient
  ctx.fillStyle = app.bgColor;
  ctx.fillRect(0, 0, W, H);

  if (app.bgColor2) {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, app.bgColor);
    grad.addColorStop(1, app.bgColor2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else if (app.template === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, app.bgColor);
    grad.addColorStop(1, `${app.accentColor}44`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Brushed metallic sheen & radial highlight
  if (app.metallicFinish) {
    const rad = ctx.createRadialGradient(W * 0.85, H * 0.14, 4, W * 0.85, H * 0.14, W * 0.58);
    rad.addColorStop(0, app.isLight ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.12)');
    rad.addColorStop(1, 'transparent');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, W, H);

    const sheen = ctx.createLinearGradient(0, 0, W, H * 0.8);
    if (app.isLight) {
      sheen.addColorStop(0, 'rgba(255,255,255,0.52)');
      sheen.addColorStop(0.45, 'rgba(255,255,255,0.08)');
      sheen.addColorStop(1, 'rgba(15,23,42,0.04)');
    } else {
      sheen.addColorStop(0, 'rgba(255,255,255,0.09)');
      sheen.addColorStop(0.42, 'rgba(255,255,255,0.0)');
      sheen.addColorStop(1, 'rgba(0,0,0,0.22)');
    }
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, H);
  }

  if (app.template === 'executive') {
    ctx.fillStyle = app.accentColor;
    ctx.fillRect(0, 0, 8, H);
  } else if (app.template === 'editorial') {
    ctx.strokeStyle = `${app.accentColor}4D`;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.roundRect(13, 13, W - 26, H - 26, app.innerCornerRadius);
    ctx.stroke();
  }

  // Outer crisp metallic bezel stroke
  ctx.strokeStyle = app.borderColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(0.75, 0.75, W - 1.5, H - 1.5, app.cornerRadius);
  ctx.stroke();
}

function drawFrontCardFace(
  ctx: CanvasRenderingContext2D,
  params: {
    data: BusinessCardData;
    cfg: BusinessCardConfig;
    app: ResolvedCardAppearance;
    fontPrimary: string;
    monoFont: string;
    avatarImg: HTMLImageElement | null;
    verifiedImg: HTMLImageElement | null;
    includeAvatarImage: boolean;
  }
) {
  const { data, cfg, app, fontPrimary, monoFont, avatarImg, verifiedImg, includeAvatarImage } = params;
  const W = CARD_BASE_WIDTH;
  const H = CARD_BASE_HEIGHT;
  const cleanUsername = (data.username || 'creator').toLowerCase().trim();
  const initials = (data.displayName || cleanUsername).slice(0, 2).toUpperCase();

  ctx.save();
  drawCardBaseBackground(ctx, app, W, H);

  const padX = 36 + (app.template === 'executive' ? 6 : 0);
  const padRight = 36;
  const padY = 28;

  // Top Header Row: Rounded-square Logo / Avatar + optional badge + top-right 'iveo'
  let topBadgeX = padX;
  if (cfg.showAvatar !== false) {
    const logoSize = 54;
    if (includeAvatarImage && avatarImg) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(padX, padY, logoSize, logoSize, 14);
      ctx.clip();
      const sc = Math.max(logoSize / avatarImg.width, logoSize / avatarImg.height);
      const dw = avatarImg.width * sc;
      const dh = avatarImg.height * sc;
      ctx.drawImage(avatarImg, padX + (logoSize - dw) / 2, padY + (logoSize - dh) / 2, dw, dh);
      ctx.restore();

      ctx.strokeStyle = app.borderColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(padX, padY, logoSize, logoSize, 14);
      ctx.stroke();
    } else {
      ctx.fillStyle = app.isLight ? '#0A0A0A' : '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(padX, padY, logoSize, logoSize, 14);
      ctx.fill();

      ctx.fillStyle = app.isLight ? '#FFFFFF' : '#0A0A0A';
      ctx.font = `800 21px ${fontPrimary}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, padX + logoSize / 2, padY + logoSize / 2 + 1);
    }
    topBadgeX = padX + logoSize + 12;
  }

  if (cfg.badgeText) {
    ctx.font = `700 10px ${fontPrimary}`;
    const badgeLabel = cfg.badgeText.toUpperCase();
    const bw = Math.min(ctx.measureText(badgeLabel).width + 20, 240);
    const bh = 21;
    const by = padY + 16;
    ctx.save();
    ctx.fillStyle = `${app.accentColor}22`;
    ctx.beginPath();
    ctx.roundRect(topBadgeX, by, bw, bh, 999);
    ctx.fill();
    ctx.strokeStyle = `${app.accentColor}4D`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = app.accentColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeLabel, topBadgeX + 10, by + bh / 2 + 0.5, bw - 20);
    ctx.restore();
  }

  // Top-right 'iveo' mark
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = app.mutedColor;
  ctx.font = `700 14px ${monoFont}`;
  ctx.fillText('iveo', W - padRight, padY + 2);

  // Center/Lower Identity Block
  const maxContentW = W - padX - padRight;
  let curY = 114;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = app.textColor;
  ctx.font = `700 28px ${fontPrimary}`;
  const tickGap = 8;
  const tickSize = 17;
  const maxNameW = data.isPro ? maxContentW - tickGap - tickSize : maxContentW;
  let fittedName = data.displayName || cleanUsername;
  while (fittedName.length > 3 && ctx.measureText(fittedName).width > maxNameW) {
    fittedName = `${fittedName.slice(0, -2)}…`;
  }
  ctx.fillText(fittedName, padX, curY);
  if (data.isPro) {
    const nw = ctx.measureText(fittedName).width;
    drawVerifiedTickCanvas(ctx, verifiedImg, padX + nw + tickGap, curY + 6, tickSize, !app.isLight);
  }
  curY += 36;

  // Subtitle: Role · Location · @username
  const subParts: { text: string; color: string; font: string; pin?: boolean }[] = [];
  if (cfg.role) {
    subParts.push({ text: cfg.role, color: app.textColor, font: `500 14px ${fontPrimary}` });
  }
  if (cfg.companyOrLocation) {
    if (subParts.length > 0) {
      subParts.push({ text: '·', color: app.mutedColor, font: `400 14px ${fontPrimary}` });
    }
    subParts.push({ text: cfg.companyOrLocation, color: app.mutedColor, font: `400 14px ${fontPrimary}`, pin: true });
  }
  if (cfg.showHandle !== false) {
    if (subParts.length > 0) {
      subParts.push({ text: '·', color: app.mutedColor, font: `400 14px ${fontPrimary}` });
    }
    subParts.push({ text: `@${cleanUsername}`, color: app.mutedColor, font: `400 12.5px ${monoFont}` });
  }

  if (subParts.length > 0) {
    let sx = padX;
    for (const part of subParts) {
      ctx.font = part.font;
      const w = ctx.measureText(part.text).width + (part.pin ? 15 : 0);
      if (sx + w > W - padRight) break;
      if (part.pin) {
        drawVectorIcon(ctx, 'pin', sx, curY + 2, 12, app.accentColor);
        sx += 15;
      }
      ctx.fillStyle = part.color;
      ctx.fillText(part.text, sx, curY + (part.font.includes(monoFont) ? 1.5 : 0));
      sx += ctx.measureText(part.text).width + 7;
    }
    curY += 24;
  }

  // Bio (up to 2 lines)
  if (cfg.showBio !== false && data.bio?.trim()) {
    ctx.font = `400 12.5px ${fontPrimary}`;
    ctx.fillStyle = app.mutedColor;
    const words = data.bio.trim().split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const test = `${line}${words[i]} `;
      if (ctx.measureText(test.trim()).width > maxContentW && line.length > 0) {
        if (lines.length === 1) {
          let trimmed = line.trim();
          while (trimmed.length > 3 && ctx.measureText(`${trimmed}…`).width > maxContentW) {
            trimmed = trimmed.slice(0, -1);
          }
          lines.push(`${trimmed}…`);
          line = '';
          break;
        }
        lines.push(line.trim());
        line = `${words[i]} `;
      } else {
        line = test;
      }
    }
    if (line.trim() && lines.length < 2) lines.push(line.trim());
    for (const l of lines) {
      ctx.fillText(l, padX, curY);
      curY += 18;
    }
    curY += 6;
  }

  // Contact Email & Phone
  if (cfg.contactEmail || cfg.contactPhone) {
    let cx = padX;
    ctx.font = `400 12px ${fontPrimary}`;
    if (cfg.contactEmail) {
      drawVectorIcon(ctx, 'mail', cx, curY + 1.5, 12, app.accentColor);
      cx += 17;
      ctx.fillStyle = app.textColor;
      ctx.fillText(cfg.contactEmail, cx, curY);
      cx += ctx.measureText(cfg.contactEmail).width + 16;
    }
    if (cfg.contactPhone) {
      drawVectorIcon(ctx, 'phone', cx, curY + 1.5, 12, app.accentColor);
      cx += 17;
      ctx.fillStyle = app.textColor;
      ctx.fillText(cfg.contactPhone, cx, curY);
    }
  }

  // Bottom Footer Bar
  const footerTopY = H - padY - 26;
  ctx.strokeStyle = app.borderColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, footerTopY);
  ctx.lineTo(W - padRight, footerTopY);
  ctx.stroke();

  const footerTextY = footerTopY + 16;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = app.textColor;
  ctx.font = `500 13.5px ${monoFont}`;
  ctx.fillText(cfg.websiteUrl || `iveo.site/@${cleanUsername}`, padX, footerTextY, 410);

  ctx.textAlign = 'right';
  ctx.fillStyle = app.mutedColor;
  ctx.font = `600 10px ${fontPrimary}`;
  ctx.fillText('FRONT', W - padRight, footerTextY);

  ctx.restore();
}

function drawBackCardFace(
  ctx: CanvasRenderingContext2D,
  params: {
    data: BusinessCardData;
    cfg: BusinessCardConfig;
    app: ResolvedCardAppearance;
    fontPrimary: string;
    editorialFont: string;
    monoFont: string;
    qrImg: HTMLImageElement | null;
    verifiedImg: HTMLImageElement | null;
  }
) {
  const { data, cfg, app, fontPrimary, editorialFont, monoFont, qrImg, verifiedImg } = params;
  const W = CARD_BASE_WIDTH;
  const H = CARD_BASE_HEIGHT;
  const cleanUsername = (data.username || 'creator').toLowerCase().trim();
  const initials = (data.displayName || cleanUsername).slice(0, 2).toUpperCase();

  ctx.save();
  drawCardBaseBackground(ctx, app, W, H);

  const padX = 34 + (app.template === 'executive' ? 4 : 0);
  const padRight = 34;

  // Left Side: Large QR Card
  const qrBoxSize = 188;
  const qrBoxX = padX;
  const qrBoxY = Math.round((H - qrBoxSize) / 2);

  if (cfg.showQr !== false && qrImg) {
    ctx.save();
    ctx.fillStyle = app.qrBg;
    ctx.beginPath();
    ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 16);
    ctx.fill();
    ctx.strokeStyle = app.borderColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.drawImage(qrImg, qrBoxX + 8, qrBoxY + 8, qrBoxSize - 16, qrBoxSize - 16);
    ctx.restore();
  } else {
    ctx.fillStyle = app.accentColor;
    ctx.beginPath();
    ctx.roundRect(qrBoxX + 12, qrBoxY + 12, 164, 164, 18);
    ctx.fill();
    ctx.fillStyle = isLightHexColor(app.accentColor) ? '#0A0A0A' : '#FFFFFF';
    ctx.font = `700 42px ${fontPrimary}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, qrBoxX + 94, qrBoxY + 94);
  }

  // Right Side: Headline + Handle + Social Chips
  const rightX = qrBoxX + qrBoxSize + 28;
  const rightW = W - padRight - rightX;

  const backLinks =
    cfg.showSocialsOnBack !== false
      ? buildBackSocialLinks(data.socials, cfg.websiteUrl, cleanUsername)
      : [];

  const rowsCount = Math.ceil(backLinks.length / 2);
  const blockH = 74 + 28 + (backLinks.length > 0 ? 12 + rowsCount * 33 : 0);
  let curY = Math.max(30, Math.round((H - blockH) / 2));

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = app.textColor;
  ctx.font = `600 26px ${fontPrimary}`;
  ctx.fillText(cfg.backHeadline || 'Scan to', rightX, curY, rightW);
  curY += 30;

  ctx.font = `italic 400 31px ${editorialFont}`;
  ctx.fillStyle = app.textColor;
  ctx.fillText(cfg.backSubheadline || 'open my page.', rightX, curY, rightW);
  curY += 42;

  const urlLabel = `iveo.site/@${cleanUsername}`;
  ctx.font = `500 13.5px ${monoFont}`;
  ctx.fillStyle = app.mutedColor;
  const maxUrlW = data.isPro ? rightW - 22 : rightW;
  ctx.fillText(urlLabel, rightX, curY, maxUrlW);
  if (data.isPro) {
    const uw = Math.min(ctx.measureText(urlLabel).width, maxUrlW);
    drawVerifiedTickCanvas(ctx, verifiedImg, rightX + uw + 6, curY + 0.5, 14, !app.isLight);
  }
  curY += 28;

  // Social links 2-col grid on Back
  if (backLinks.length > 0) {
    ctx.strokeStyle = app.borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rightX, curY);
    ctx.lineTo(W - padRight, curY);
    ctx.stroke();
    curY += 10;

    const colGap = 7;
    const chipW = Math.floor((rightW - colGap) / 2);
    const chipH = 26;

    backLinks.forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cx = rightX + col * (chipW + colGap);
      const cy = curY + row * (chipH + colGap);

      ctx.save();
      ctx.fillStyle = app.isLight ? 'rgba(15, 23, 42, 0.05)' : 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(cx, cy, chipW, chipH, 8);
      ctx.fill();
      ctx.strokeStyle = app.borderColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      drawSocialGlyph(ctx, item.platform, cx + 8, cy + 6.5, 13, app.accentColor);

      ctx.fillStyle = app.textColor;
      ctx.font = `500 11px ${fontPrimary}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(item.valueLabel || item.label, cx + 26, cy + chipH / 2 + 0.5, chipW - 34);
      ctx.restore();
    });
  }

  ctx.restore();
}

/**
 * Generates an ultra-high-resolution PNG (2040x1200 for Front or Back, or 2200x2600 for Both Sides sheet)
 * pixel-identical to BusinessCardPreview by drawing in the exact 600x353 canonical layout coordinate space.
 */
export async function generateBusinessCardPng(data: BusinessCardData): Promise<string> {
  const side = data.side || 'front';
  const cfg: BusinessCardConfig = {
    ...DEFAULT_BUSINESS_CARD_CONFIG,
    ...(parseBusinessCardConfig(data.cardConfig) || {}),
  };

  const [fontPrimary, editorialFont] = await Promise.all([
    ensureCanvasFontLoaded(cfg.fontId, 'Inter, system-ui, sans-serif'),
    ensureCanvasFontLoaded('instrument-serif', "'Instrument Serif', Georgia, serif"),
  ]);
  const monoFont = 'ui-monospace, "SF Mono", Menlo, monospace';
  const frontApp = resolveFrontCardAppearance(cfg, data.theme);
  const backApp = resolveBackCardAppearance(cfg, data.theme);

  let qrDataUrl = data.qrDataUrl;
  try {
    qrDataUrl = await QRCode.toDataURL(
      data.pageUrl.includes('src=qr') ? data.pageUrl : `${data.pageUrl}?src=qr`,
      {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: backApp.qrFg, light: backApp.qrBg },
      }
    );
  } catch {}

  const [qrImg, avatarImg, verifiedImg] = await Promise.all([
    qrDataUrl ? loadCanvasSafeAvatar(qrDataUrl) : Promise.resolve(null),
    cfg.showAvatar !== false && data.avatarUrl ? loadCanvasSafeAvatar(data.avatarUrl) : Promise.resolve(null),
    data.isPro ? loadCanvasSafeAvatar(VERIFIED_TICK_IMAGE_URL) : Promise.resolve(null),
  ]);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas 2D context not available');

  if (side === 'both') {
    const sheetW = 2280;
    const sheetH = 2680;
    canvas.width = sheetW;
    canvas.height = sheetH;

    const renderBoth = (includeAvatarImage: boolean) => {
      ctx.save();
      ctx.fillStyle = '#F4F4F5';
      ctx.fillRect(0, 0, sheetW, sheetH);

      const cardPxW = 2040;
      const cardPxH = 1200;
      const cardX = (sheetW - cardPxW) / 2;

      // FRONT Label + Card
      ctx.fillStyle = '#52525B';
      ctx.font = `600 28px ${monoFont}`;
      ctx.textAlign = 'left';
      ctx.fillText('FRONT SIDE', cardX, 78);

      ctx.save();
      ctx.translate(cardX, 110);
      ctx.scale(CARD_EXPORT_SCALE, CARD_EXPORT_SCALE);
      drawFrontCardFace(ctx, {
        data,
        cfg,
        app: frontApp,
        fontPrimary,
        monoFont,
        avatarImg,
        verifiedImg,
        includeAvatarImage,
      });
      ctx.restore();

      // BACK Label + Card
      ctx.fillStyle = '#52525B';
      ctx.font = `600 28px ${monoFont}`;
      ctx.fillText('BACK SIDE', cardX, 1388);

      ctx.save();
      ctx.translate(cardX, 1420);
      ctx.scale(CARD_EXPORT_SCALE, CARD_EXPORT_SCALE);
      drawBackCardFace(ctx, {
        data,
        cfg,
        app: backApp,
        fontPrimary,
        editorialFont,
        monoFont,
        qrImg,
        verifiedImg,
      });
      ctx.restore();
      ctx.restore();
    };

    try {
      renderBoth(true);
      return canvas.toDataURL('image/png', 1.0);
    } catch {
      renderBoth(false);
      return canvas.toDataURL('image/png', 1.0);
    }
  }

  const canvasWidth = 2040;
  const canvasHeight = 1200;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const renderSingle = (includeAvatarImage: boolean) => {
    ctx.save();
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.scale(CARD_EXPORT_SCALE, CARD_EXPORT_SCALE);
    if (side === 'back') {
      drawBackCardFace(ctx, {
        data,
        cfg,
        app: backApp,
        fontPrimary,
        editorialFont,
        monoFont,
        qrImg,
        verifiedImg,
      });
    } else {
      drawFrontCardFace(ctx, {
        data,
        cfg,
        app: frontApp,
        fontPrimary,
        monoFont,
        avatarImg,
        verifiedImg,
        includeAvatarImage,
      });
    }
    ctx.restore();
  };

  try {
    renderSingle(true);
    return canvas.toDataURL('image/png', 1.0);
  } catch {
    renderSingle(false);
    return canvas.toDataURL('image/png', 1.0);
  }
}

export async function downloadBusinessCardPng(
  data: BusinessCardData
): Promise<{ dataUrl: string; blob: Blob }> {
  const dataUrl = await generateBusinessCardPng(data);
  const blob = dataUrlToBlob(dataUrl);
  const objectUrl = URL.createObjectURL(blob);
  const sideSuffix = data.side ? `-${data.side}` : '';

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `iveo-card-${(data.username || 'creator').replace(/[^a-z0-9-_]/gi, '')}${sideSuffix}.png`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 2000);

  return { dataUrl, blob };
}
