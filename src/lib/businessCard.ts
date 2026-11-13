import QRCode from 'qrcode';
import { buildVCardString, sanitizeVCardFilename } from './vcard';

export interface BusinessCardData {
  displayName: string;
  username: string;
  bio?: string;
  pageUrl: string;
  avatarUrl?: string | null;
  qrDataUrl?: string | null;
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
  const vcfContent = buildVCardString({
    fullName: data.displayName || data.username,
    url: data.pageUrl,
    note: data.bio ? `${data.bio}\n\nPage: ${data.pageUrl}` : `Page: ${data.pageUrl}`,
    title: 'Creator',
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
  if (!color || typeof color !== 'string') return false;
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        return lum > 165;
      }
    }
  }
  return false;
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
 * Loads an image safely with timeout and CORS.
 * Returns null if the image fails to load or cannot be drawn.
 */
async function loadSafeImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    let isDone = false;

    const timer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        resolve(null);
      }
    }, 3500);

    if (!src.startsWith('data:')) {
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
    img.src = src;
  });
}

/**
 * Generates an ultra-high-resolution, vector-sharp PNG image of the digital business card
 * using HTML5 Canvas with luminance-aware contrast and fallback protection against tainted canvases.
 */
export async function generateBusinessCardPng(data: BusinessCardData): Promise<string> {
  // Ultra-crisp 16:9 canvas dimensions (Full HD 1920x1080)
  const width = 1920;
  const height = 1080;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D context not available');

  const bgColor = data.theme?.bg || '#0F172A';
  const bgIsLight = isLightColor(bgColor);
  const textColor = data.theme?.text || (bgIsLight ? '#0A0A0A' : '#FFFFFF');
  const mutedColor =
    data.theme?.muted || (bgIsLight ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.72)');

  const rawAccent = data.theme?.accent || data.theme?.buttonBg || '#4F46E5';
  // Ensure accent isn't invisible against a matching light/dark background
  const accentColor =
    bgIsLight && isLightColor(rawAccent)
      ? '#4F46E5'
      : !bgIsLight && !isLightColor(rawAccent) && rawAccent.toLowerCase() === bgColor.toLowerCase()
        ? '#818CF8'
        : rawAccent;

  // 1. Generate crisp 1024px QR code locally (never taints canvas and never fails over network)
  let qrDataUrl = data.qrDataUrl;
  try {
    qrDataUrl = await QRCode.toDataURL(data.pageUrl, {
      width: 1024,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0A0A0A',
        light: '#FFFFFF',
      },
    });
  } catch {
    // Keep provided qrDataUrl if local generator throws
  }

  const qrImg = qrDataUrl ? await loadSafeImage(qrDataUrl) : null;

  // Try loading avatar safely (for relative /api/avatar/... or CORS-enabled images)
  let avatarImg: HTMLImageElement | null = null;
  if (data.avatarUrl) {
    avatarImg = await loadSafeImage(data.avatarUrl);
  }

  const borderStroke = bgIsLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.18)';
  const footerTint = bgIsLight ? 'rgba(15, 23, 42, 0.045)' : 'rgba(255, 255, 255, 0.06)';
  const avatarRing = bgIsLight ? 'rgba(15, 23, 42, 0.16)' : 'rgba(255, 255, 255, 0.42)';

  const renderCard = (includeAvatarImage: boolean) => {
    ctx.save();

    // Fill crisp base background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Subtle directional depth gradient tailored to light vs dark vibes
    const grad = ctx.createLinearGradient(0, 0, width, height);
    if (bgIsLight) {
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.01)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.05)');
    } else {
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.06)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.34)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Decorative ambient glow orbs in corners
    ctx.save();
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = bgIsLight ? 0.09 : 0.16;
    ctx.beginPath();
    ctx.arc(width - 240, 240, 420, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(280, height - 160, 480, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Inner card container with rounded corners and crisp border
    const cardMargin = 48;
    const cardW = width - cardMargin * 2;
    const cardH = height - cardMargin * 2;
    const cardRadius = 40;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardMargin, cardMargin, cardW, cardH, cardRadius);
    ctx.strokeStyle = borderStroke;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // 2. Avatar or Initial Monogram
    const avatarX = 140;
    const avatarY = 140;
    const avatarSize = 180;
    const avatarRadius = avatarSize / 2;

    if (includeAvatarImage && avatarImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();

      ctx.strokeStyle = avatarRing;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Designer monogram circle
      ctx.save();
      const monoGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
      monoGrad.addColorStop(0, accentColor);
      monoGrad.addColorStop(1, bgIsLight ? '#1E293B' : '#0A0A0A');
      ctx.fillStyle = monoGrad;
      ctx.beginPath();
      ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = avatarRing;
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 84px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initial = (data.displayName || data.username || 'I').charAt(0).toUpperCase();
      ctx.fillText(initial, avatarX + avatarRadius, avatarY + avatarRadius + 4);
      ctx.restore();
    }

    // 3. Name & Verified Handle
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.fillStyle = textColor;
    ctx.font = 'bold 74px system-ui, -apple-system, sans-serif';
    const rawName = data.displayName || data.username;
    // Truncate long names cleanly so they never overlap the QR code box
    let fittedName = rawName;
    while (fittedName.length > 3 && ctx.measureText(fittedName).width > 940) {
      fittedName = `${fittedName.slice(0, -2)}…`;
    }
    ctx.fillText(fittedName, 360, 148);

    ctx.font = '600 44px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = accentColor;
    ctx.fillText(`@${data.username}`, 360, 242);

    // 4. Bio snippet (word wrapped with clean line height)
    if (data.bio) {
      ctx.fillStyle = mutedColor;
      ctx.font = 'normal 38px system-ui, -apple-system, sans-serif';
      const maxWidth = 1040;
      const words = data.bio.trim().split(/\s+/);
      let line = '';
      let currentY = 390;
      const lineHeight = 58;
      let linesDrawn = 0;

      for (let n = 0; n < words.length && linesDrawn < 4; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          ctx.fillText(line.trim(), 140, currentY);
          line = words[n] + ' ';
          currentY += lineHeight;
          linesDrawn++;
        } else {
          line = testLine;
        }
      }
      if (line.trim() && linesDrawn < 4) {
        ctx.fillText(line.trim(), 140, currentY);
      }
    }

    // 5. Scannable QR Code Box on the Right
    const qrBoxW = 420;
    const qrBoxH = 420;
    const qrBoxX = width - qrBoxW - 140;
    const qrBoxY = 140;

    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 28);
    ctx.fill();

    ctx.strokeStyle = bgIsLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 3;
    ctx.stroke();

    if (qrImg) {
      const qrPad = 24;
      ctx.drawImage(qrImg, qrBoxX + qrPad, qrBoxY + qrPad, qrBoxW - qrPad * 2, qrBoxH - qrPad * 2);
    }
    ctx.restore();

    // QR Caption
    ctx.fillStyle = mutedColor;
    ctx.font = '600 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCAN WITH CAMERA', qrBoxX + qrBoxW / 2, qrBoxY + qrBoxH + 24);

    // 6. Bottom Brand & Address bar
    const bottomY = height - 190;
    ctx.fillStyle = footerTint;
    ctx.beginPath();
    ctx.roundRect(cardMargin + 2, bottomY, cardW - 4, 138, [0, 0, 36, 36]);
    ctx.fill();

    ctx.strokeStyle = borderStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardMargin + 2, bottomY);
    ctx.lineTo(cardMargin + cardW - 2, bottomY);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // iveo wordmark
    ctx.fillStyle = textColor;
    ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
    ctx.fillText('iveo', 140, bottomY + 68);

    // Separator dot
    ctx.fillStyle = mutedColor;
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillText('·', 252, bottomY + 68);

    // Clean address
    ctx.fillStyle = textColor;
    ctx.font = '500 38px monospace';
    ctx.fillText(`iveo.site/${data.username}`, 288, bottomY + 68);

    // Right CTA text
    ctx.textAlign = 'right';
    ctx.fillStyle = accentColor;
    ctx.font = '600 32px system-ui, -apple-system, sans-serif';
    ctx.fillText('Digital Business Card', width - 140, bottomY + 68);

    ctx.restore();
  };

  // First try rendering with avatar image
  try {
    renderCard(true);
    return canvas.toDataURL('image/png', 1.0);
  } catch {
    // If canvas is tainted by external CORS image, re-render with monogram so download ALWAYS succeeds
    renderCard(false);
    return canvas.toDataURL('image/png', 1.0);
  }
}

/**
 * Generates an ultra-crisp 1920x1080 business card PNG and reliably triggers browser download via Blob URL.
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
