export type ImageProcessErrorCode =
  | 'unsupported'
  | 'too_large_input'
  | 'too_small'
  | 'too_large_output'
  | 'unknown';

export class ImageProcessError extends Error {
  code: ImageProcessErrorCode;

  constructor(code: ImageProcessErrorCode, message?: string) {
    super(message || code);
    this.name = 'ImageProcessError';
    this.code = code;
  }
}

export interface ProcessedImage {
  blob: Blob;
  type: 'image/webp' | 'image/jpeg';
  width: number;
  height: number;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!file || !allowedMimes.includes(file.type)) {
    throw new ImageProcessError('unsupported');
  }

  // Max 8 MB before processing
  if (file.size > 8 * 1024 * 1024) {
    throw new ImageProcessError('too_large_input');
  }

  // Decode image
  let imageSource: ImageBitmap | HTMLImageElement;
  let sourceWidth = 0;
  let sourceHeight = 0;

  try {
    if (typeof createImageBitmap === 'function') {
      imageSource = await createImageBitmap(file, { imageOrientation: 'from-image' });
      sourceWidth = imageSource.width;
      sourceHeight = imageSource.height;
    } else {
      const url = URL.createObjectURL(file);
      try {
        imageSource = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Image decode failed'));
          img.src = url;
        });
        sourceWidth = imageSource.naturalWidth;
        sourceHeight = imageSource.naturalHeight;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  } catch {
    throw new ImageProcessError('unsupported');
  }

  const shorterSide = Math.min(sourceWidth, sourceHeight);
  if (shorterSide < 64) {
    throw new ImageProcessError('too_small');
  }

  // Calculate target dimensions: longest side at most 1280px (never upscale)
  let targetWidth = sourceWidth;
  let targetHeight = sourceHeight;
  const maxSide = 1280;

  if (Math.max(sourceWidth, sourceHeight) > maxSide) {
    if (sourceWidth >= sourceHeight) {
      targetWidth = maxSide;
      targetHeight = Math.round((sourceHeight * maxSide) / sourceWidth);
    } else {
      targetHeight = maxSide;
      targetWidth = Math.round((sourceWidth * maxSide) / sourceHeight);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new ImageProcessError('unknown');
  }

  ctx.drawImage(imageSource, 0, 0, targetWidth, targetHeight);

  // Helper to get canvas blob
  const getBlob = (
    c: HTMLCanvasElement,
    type: string,
    quality: number
  ): Promise<Blob | null> => {
    return new Promise((resolve) => {
      c.toBlob((b) => resolve(b), type, quality);
    });
  };

  // Try webp first
  let format: 'image/webp' | 'image/jpeg' = 'image/webp';
  let quality = 0.82;
  let blob = await getBlob(canvas, 'image/webp', quality);

  // If browser returned different type (no webp support) or failed
  if (!blob || blob.type !== 'image/webp') {
    format = 'image/jpeg';
    quality = 0.85;

    // Fill white background for JPEG
    const jpegCanvas = document.createElement('canvas');
    jpegCanvas.width = canvas.width;
    jpegCanvas.height = canvas.height;
    const jCtx = jpegCanvas.getContext('2d');
    if (!jCtx) throw new ImageProcessError('unknown');

    jCtx.fillStyle = '#FFFFFF';
    jCtx.fillRect(0, 0, jpegCanvas.width, jpegCanvas.height);
    jCtx.drawImage(canvas, 0, 0);

    blob = await getBlob(jpegCanvas, 'image/jpeg', quality);
  }

  if (!blob) {
    throw new ImageProcessError('unknown');
  }

  const MAX_BYTES = 500000; // 500 KB limit for 512KB bucket

  // Reduce quality if larger than 500,000 bytes
  if (blob.size > MAX_BYTES) {
    while (quality > 0.5 && blob.size > MAX_BYTES) {
      quality -= 0.1;
      const nextBlob = await getBlob(canvas, format, Math.max(quality, 0.5));
      if (nextBlob) {
        blob = nextBlob;
      }
    }
  }

  // If still larger, scale canvas down by 0.8 and retry (at most 3 rounds)
  let scaleRound = 0;
  let currentCanvas = canvas;

  while (blob.size > MAX_BYTES && scaleRound < 3) {
    scaleRound++;
    const scaledWidth = Math.round(currentCanvas.width * 0.8);
    const scaledHeight = Math.round(currentCanvas.height * 0.8);

    if (scaledWidth < 32 || scaledHeight < 32) break;

    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = scaledWidth;
    scaledCanvas.height = scaledHeight;
    const sCtx = scaledCanvas.getContext('2d');
    if (!sCtx) break;

    if (format === 'image/jpeg') {
      sCtx.fillStyle = '#FFFFFF';
      sCtx.fillRect(0, 0, scaledWidth, scaledHeight);
    }
    sCtx.drawImage(currentCanvas, 0, 0, scaledWidth, scaledHeight);
    currentCanvas = scaledCanvas;

    const nextBlob = await getBlob(currentCanvas, format, 0.7);
    if (nextBlob) {
      blob = nextBlob;
    }
  }

  if (blob.size > 524288) {
    // Over the 512 KB bucket limit
    throw new ImageProcessError('too_large_output');
  }

  return {
    blob,
    type: format,
    width: currentCanvas.width,
    height: currentCanvas.height,
  };
}
