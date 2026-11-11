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
 * Generates a high-resolution PNG image of the digital business card using HTML5 Canvas.
 */
export async function generateBusinessCardPng(data: BusinessCardData): Promise<string> {
  const width = 1200;
  const height = 675; // Standard 16:9 modern card ratio

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  const bgColor = data.theme?.bg || '#0F172A';
  const textColor = data.theme?.text || '#FFFFFF';
  const mutedColor = data.theme?.muted || 'rgba(255, 255, 255, 0.65)';
  const accentColor = data.theme?.accent || '#6366F1';

  // 1. Draw rounded card background with subtle gradient
  const cardRadius = 36;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, cardRadius);
  ctx.clip();

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, bgColor);
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle decorative ambient glow circles
  ctx.fillStyle = accentColor;
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.arc(width - 150, 150, 260, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(200, height - 100, 320, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Outer border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, width - 4, height - 4);

  // 2. Avatar or Initial circle
  const avatarX = 80;
  const avatarY = 80;
  const avatarSize = 130;
  const avatarRadius = avatarSize / 2;

  let avatarRendered = false;
  if (data.avatarUrl) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = data.avatarUrl!;
      });

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();

      // Avatar stroke
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
      ctx.stroke();
      avatarRendered = true;
    } catch {}
  }

  if (!avatarRendered) {
    // Initial monogram circle
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(avatarX + avatarRadius, avatarY + avatarRadius, avatarRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = (data.displayName || data.username || 'I').charAt(0).toUpperCase();
    ctx.fillText(initial, avatarX + avatarRadius, avatarY + avatarRadius + 2);
  }

  // 3. Name & Handle
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Display Name
  ctx.fillStyle = textColor;
  ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
  const nameText = data.displayName || data.username;
  ctx.fillText(nameText, 240, 85);

  // Username badge
  ctx.fillStyle = accentColor;
  ctx.font = '600 32px system-ui, -apple-system, sans-serif';
  ctx.fillText(`@${data.username}`, 240, 150);

  // 4. Bio (word wrapped)
  if (data.bio) {
    ctx.fillStyle = mutedColor;
    ctx.font = 'normal 26px system-ui, -apple-system, sans-serif';
    const maxWidth = 640;
    const words = data.bio.split(' ');
    let line = '';
    let currentY = 250;
    const lineHeight = 38;
    let linesDrawn = 0;

    for (let n = 0; n < words.length && linesDrawn < 4; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, 80, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
        linesDrawn++;
      } else {
        line = testLine;
      }
    }
    if (line.trim() && linesDrawn < 4) {
      ctx.fillText(line, 80, currentY);
    }
  }

  // 5. Embedded QR Code on right side
  if (data.qrDataUrl) {
    try {
      const qrImg = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = () => reject();
        qrImg.src = data.qrDataUrl!;
      });

      const qrBoxX = width - 360;
      const qrBoxY = 80;
      const qrBoxSize = 280;

      // White card container for QR
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 20);
      ctx.fill();

      // QR Image
      const pad = 16;
      ctx.drawImage(qrImg, qrBoxX + pad, qrBoxY + pad, qrBoxSize - pad * 2, qrBoxSize - pad * 2);

      // Label under QR
      ctx.fillStyle = mutedColor;
      ctx.font = '500 20px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Scan to connect', qrBoxX + qrBoxSize / 2, qrBoxY + qrBoxSize + 16);
    } catch {}
  }

  // 6. Bottom Brand & Address bar
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(0, height - 90, width, 90);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;
  ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
  ctx.fillText('iveo', 80, height - 45);

  ctx.fillStyle = mutedColor;
  ctx.font = 'normal 24px monospace';
  ctx.fillText(`iveo.site/${data.username}`, 170, height - 45);

  ctx.restore();
  return canvas.toDataURL('image/png');
}
