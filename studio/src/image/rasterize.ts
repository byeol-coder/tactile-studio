/**
 * Decode an image file and downscale it to a `width × height` grayscale
 * luminance buffer (spec Phase 2). DOM-dependent (uses canvas), so it is kept
 * thin and separate from the pure conversion in ./convert.
 *
 * The image is fit *inside* the grid preserving aspect ratio (contain), centered
 * on a white background — so letterboxed margins read as light (no pins) and the
 * shape isn't distorted.
 */
export async function imageFileToGrayscale(
  file: File,
  width: number,
  height: number,
): Promise<Uint8ClampedArray> {
  const bitmap = await loadBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const scale = Math.min(width / bitmap.width, height / bitmap.height);
  const dw = Math.max(1, Math.round(bitmap.width * scale));
  const dh = Math.max(1, Math.round(bitmap.height * scale));
  const dx = Math.floor((width - dw) / 2);
  const dy = Math.floor((height - dh) / 2);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(bitmap, dx, dy, dw, dh);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  const { data } = ctx.getImageData(0, 0, width, height);
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3] / 255;
    // Composite over white for transparency, then luminance (Rec. 601).
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = Math.round(lum * a + 255 * (1 - a));
  }
  return gray;
}

/** Decode a File to an ImageBitmap (fallback to HTMLImageElement + object URL). */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
