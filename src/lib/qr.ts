import QRCode from 'qrcode';

const svgCache = new Map<string, string>();
const pngCache = new Map<string, string>();

export async function makeQrSvg(url: string): Promise<string> {
  const cached = svgCache.get(url);
  if (cached) return cached;

  const result = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 4,
    color: {
      dark: '#0A0A0A',
      light: '#FFFFFF',
    },
  });

  svgCache.set(url, result);
  return result;
}

export async function makeQrPngDataUrl(url: string): Promise<string> {
  const cached = pngCache.get(url);
  if (cached) return cached;

  const result = await QRCode.toDataURL(url, {
    type: 'image/png',
    width: 1024,
    errorCorrectionLevel: 'M',
    margin: 4,
    color: {
      dark: '#0A0A0A',
      light: '#FFFFFF',
    },
  });

  pngCache.set(url, result);
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
