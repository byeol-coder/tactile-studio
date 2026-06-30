// ── Flat Icon Set ─────────────────────────────────────────────
// Single monochrome 2D line-icon system used across the UI.
// All icons share: viewBox 0 0 24 24, fill none, stroke currentColor,
// 1.75 stroke, round caps — matching the rail/header icon style.
// Filled accents (braille dots, contrast half) carry inline fill on the
// element so the shared stroke styling doesn't apply to them.

const PATHS = {
  // transforms
  sparkle:  '<path d="M12 3.2l1.8 5.2 5.2 1.8-5.2 1.8L12 17.2l-1.8-5.2L5 10.2l5.2-1.8z"/><path d="M18.5 15l.55 1.7 1.7.55-1.7.55-.55 1.7-.55-1.7-1.7-.55 1.7-.55z"/>',
  outline:  '<circle cx="12" cy="12" r="7.5"/>',
  simplify: '<rect x="5.5" y="5.5" width="13" height="13" rx="2.5"/>',
  noise:    '<path d="M3 9h10.5a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 14.5h13a2.5 2.5 0 1 1-2.5 2.5"/>',
  invert:   '<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill="currentColor" stroke="none"/>',
  thin:     '<path d="M5 12h14"/><path d="M7 8.5h10"/><path d="M9 15.5h6"/>',

  // symbols / create
  heart:    '<path d="M12 19.4S5 15.1 5 10.2A3.4 3.4 0 0 1 12 6.9 3.4 3.4 0 0 1 19 10.2c0 4.9-7 9.2-7 9.2z"/>',
  globe:    '<circle cx="12" cy="12" r="7.5"/><line x1="4.5" y1="12" x2="19.5" y2="12"/><ellipse cx="12" cy="12" rx="3.6" ry="7.5"/>',
  butterfly:'<line x1="12" y1="7.2" x2="12" y2="16.5"/><path d="M12 7.6C10 4.8 4 5.2 4 9.6s6 4.8 8 1.6"/><path d="M12 7.6C14 4.8 20 5.2 20 9.6s-6 4.8-8 1.6"/><path d="M12 7.2c-.4-1.4-1.8-2.4-2.8-2.4"/><path d="M12 7.2c.4-1.4 1.8-2.4 2.8-2.4"/>',
  wave:     '<path d="M2.5 12c1.8-5.5 4.2-5.5 6 0s4.2 5.5 6 0 4.2-5.5 6 0"/>',
  braille:  '<g fill="currentColor" stroke="none"><circle cx="9" cy="7" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="9" cy="17" r="1.6"/><circle cx="15" cy="7" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="15" cy="17" r="1.6"/></g>',
  describe: '<line x1="5" y1="7" x2="19" y2="7"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="17" x2="13" y2="17"/>',

  // misc
  star:     '<path d="M12 4l2.3 4.7 5.2.8-3.75 3.65.9 5.15L12 16.7l-4.65 2.45.9-5.15L4.5 9.5l5.2-.8z"/>',
  sun:      '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
  arrow:    '<line x1="4" y1="12" x2="20" y2="12"/><polyline points="14 6 20 12 14 18"/>',
  shapes:   '<rect x="4" y="4" width="7" height="7" rx="1.5"/><circle cx="16.5" cy="16.5" r="3.5"/>',

  // bank categories
  fish:     '<path d="M5 12c0 0 2.5-4.5 7-4.5s7 4.5 7 4.5-2.5 4.5-7 4.5S5 12 5 12z"/><circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none"/><path d="M5 12L2 9m3 3l-3 3"/>',
  book:     '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="2" x2="12" y2="17"/>',
  note:     '<path d="M9 17V6l12-2v11"/><circle cx="6" cy="17" r="3"/><circle cx="18" cy="15" r="3"/>',
  abc:      '<path d="M4 17l3.5-10 3.5 10"/><line x1="5.5" y1="13" x2="10" y2="13"/><line x1="15" y1="6" x2="15" y2="17"/><line x1="13" y1="11.5" x2="17" y2="11.5"/>',
  map:      '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>',
  body:     '<circle cx="12" cy="5.5" r="2.5"/><path d="M8.5 9.5h7l1 6H7.5z"/><line x1="9" y1="15.5" x2="8" y2="21"/><line x1="15" y1="15.5" x2="16" y2="21"/>',
  landmark: '<path d="M3 21h18"/><path d="M5 21V9l7-6 7 6v12"/><rect x="9" y="14" width="6" height="7"/>',
  palette:  '<circle cx="12" cy="12" r="8.5"/><circle cx="8.5" cy="10" r="1.5" fill="currentColor" stroke="none"/><circle cx="15.5" cy="9" r="1.5" fill="currentColor" stroke="none"/><circle cx="17" cy="15" r="1.5" fill="currentColor" stroke="none"/><circle cx="9" cy="16" r="1.5" fill="currentColor" stroke="none"/>',
  joystick: '<rect x="6" y="11" width="12" height="8" rx="2"/><line x1="12" y1="11" x2="12" y2="6"/><circle cx="12" cy="5" r="2"/><line x1="9" y1="15" x2="9" y2="15" stroke-linecap="round" stroke-width="3"/><line x1="15" y1="15" x2="15" y2="15" stroke-linecap="round" stroke-width="3"/>',
};

/** Return a full inline <svg> string for an icon name (empty if unknown). */
export function svgIcon(name) {
  const inner = PATHS[name];
  if (!inner) return '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

export const ICON_NAMES = Object.keys(PATHS);
