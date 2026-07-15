// src/ui/dialogs/browser-image-decoder.ts
//
// Real browser image-file decoding: File -> <img> -> offscreen canvas ->
// RGBA pixel data. This is the browser-only step that feeds
// codecs/image/image.ts's PURE, already-tested imgToCells — decoding a
// JPEG/PNG file into pixels is not the tactile-conversion algorithm itself
// (see codecs/image/image.ts's header comment), so it was never meant to be
// ported/parity-tested; this is simply where that real decode step lives so
// ImportDialog has something to call in production.
//
// NOT parity-tested (documented, same reasoning as the text-tool glyph
// rasterizer and PNG export): image decoding is a real browser API with no
// meaningful cross-engine baseline. Overridable via ImportDialog's
// `decodeImageFile` prop for tests (jsdom can't decode real images either).

export interface DecodedImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export async function decodeImageFileInBrowser(file: File): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to decode image file.'));
      el.src = url;
    });
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth || img.width;
    cv.height = img.naturalHeight || img.height;
    const ctx = cv.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable.');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, cv.width, cv.height);
    return { data: imageData.data, width: cv.width, height: cv.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
