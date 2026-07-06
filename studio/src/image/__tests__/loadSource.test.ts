import { describe, expect, it } from 'vitest';
import { isAllowedImageSource } from '../loadSource';

const ALLOW = ['https://tactileworld.org'];

describe('isAllowedImageSource', () => {
  it('accepts data:image URIs', () => {
    expect(isAllowedImageSource('data:image/png;base64,iVBOR...', ALLOW)).toBe(true);
    expect(isAllowedImageSource('data:image/jpeg;base64,/9j/4A', ALLOW)).toBe(true);
  });

  it('rejects non-image data URIs', () => {
    expect(isAllowedImageSource('data:text/html,<script>', ALLOW)).toBe(false);
  });

  it('accepts http(s) from an allowlisted origin only', () => {
    expect(isAllowedImageSource('https://tactileworld.org/img/a.png', ALLOW)).toBe(true);
    expect(isAllowedImageSource('https://evil.example/a.png', ALLOW)).toBe(false);
    expect(isAllowedImageSource('http://tactileworld.org/a.png', ALLOW)).toBe(false); // http vs the https origin
  });

  it('rejects other schemes and junk', () => {
    expect(isAllowedImageSource('blob:https://tactileworld.org/uuid', ALLOW)).toBe(false);
    expect(isAllowedImageSource('file:///etc/passwd', ALLOW)).toBe(false);
    expect(isAllowedImageSource('javascript:alert(1)', ALLOW)).toBe(false);
    expect(isAllowedImageSource('', ALLOW)).toBe(false);
    expect(isAllowedImageSource('not a url', ALLOW)).toBe(false);
  });
});
