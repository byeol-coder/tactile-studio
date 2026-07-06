import { DEFAULT_ALLOWED_ORIGINS } from '../integration/context';

/**
 * Validate a `backgroundImage` source from the entry context before loading it.
 * Parent-supplied data is untrusted, so we only accept:
 *   - `data:image/*` URIs (self-contained), and
 *   - `http(s)` URLs whose origin is on the allowlist.
 * Everything else (blob:, file:, other schemes, junk) is rejected.
 */
export function isAllowedImageSource(
  src: string,
  allowlist: readonly string[] = DEFAULT_ALLOWED_ORIGINS,
): boolean {
  if (typeof src !== 'string' || src.length === 0) return false;
  if (src.startsWith('data:image/')) return true;
  try {
    const url = new URL(src);
    if (url.protocol === 'http:' || url.protocol === 'https:') return allowlist.includes(url.origin);
    return false;
  } catch {
    return false;
  }
}

function deriveName(src: string): string {
  if (src.startsWith('data:')) return 'background-image';
  try {
    const path = new URL(src).pathname;
    const last = path.split('/').filter(Boolean).pop();
    return last || 'background-image';
  } catch {
    return 'background-image';
  }
}

/**
 * Fetch a validated image source into a File so it flows through the exact same
 * import/conversion pipeline as a manual upload. Throws on network failure or a
 * non-image response — callers surface a safe error status.
 */
export async function fetchImageFile(src: string): Promise<File> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) throw new Error(`not an image: ${blob.type || 'unknown'}`);
  return new File([blob], deriveName(src), { type: blob.type });
}
