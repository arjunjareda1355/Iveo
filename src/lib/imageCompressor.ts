/**
 * Fast client-side image compressor utility
 * Resizes and compresses image files into lightweight data URLs or Blobs
 * to guarantee instant uploads and fast public page load times.
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  format?: 'image/jpeg' | 'image/webp' | 'image/png';
  cropSquare?: boolean;
}

export async function compressImageFile(
  file: File | Blob,
  options: CompressOptions = {}
): Promise<{ dataUrl: string; blob: Blob; width: number; height: number; sizeBytes: number }> {
  const {
    maxWidth = 600,
    maxHeight = 600,
    quality = 0.85,
    format = 'image/jpeg',
    cropSquare = false,
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file format'));
      img.onload = () => {
        let srcX = 0;
        let srcY = 0;
        let srcW = img.width;
        let srcH = img.height;

        let targetW = img.width;
        let targetH = img.height;

        if (cropSquare) {
          const side = Math.min(srcW, srcH);
          srcX = (srcW - side) / 2;
          srcY = (srcH - side) / 2;
          srcW = side;
          srcH = side;
          targetW = Math.min(side, maxWidth);
          targetH = Math.min(side, maxHeight);
        } else {
          // Scale down proportionally
          if (targetW > maxWidth || targetH > maxHeight) {
            const ratio = Math.min(maxWidth / targetW, maxHeight / targetH);
            targetW = Math.round(targetW * ratio);
            targetH = Math.round(targetH * ratio);
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);

        const dataUrl = canvas.toDataURL(format, quality);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas to Blob failed'));
              return;
            }
            resolve({
              dataUrl,
              blob,
              width: targetW,
              height: targetH,
              sizeBytes: blob.size,
            });
          },
          format,
          quality
        );
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('FileReader empty'));
      }
    };

    reader.readAsDataURL(file);
  });
}
