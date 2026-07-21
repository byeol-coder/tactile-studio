// src/ui/icons/icons.ts
//
// Verbatim copy of the monolith's ICONS map (index.html `ICONS = { ... }`) —
// canonical vector paths synced from the Figma design system ("02.
// Components / 01. Toolbar / Icon Set"), offset-corrected into a shared
// 24x24 viewBox. Do not hand-edit path data; if Figma changes it, re-copy
// from index.html's current ICONS object.

export interface IconPath {
  d: string;
  fill?: boolean;
}

export const ICONS: Record<string, IconPath[]> = {
    cursor: [{ d: 'M 7.91 16.91 C 7.96 17.15 8.08 17.37 8.26 17.54 C 8.44 17.7 8.67 17.81 8.91 17.84 C 9.15 17.88 9.4 17.83 9.62 17.72 C 9.84 17.61 10.02 17.44 10.13 17.22 L 12.22 14.13 L 17.13 19.04 C 17.23 19.14 17.35 19.21 17.48 19.27 C 17.61 19.32 17.74 19.35 17.88 19.35 C 18.03 19.35 18.16 19.32 18.29 19.27 C 18.42 19.21 18.54 19.14 18.64 19.04 L 19.69 17.99 C 19.79 17.89 19.86 17.77 19.92 17.64 C 19.97 17.51 20 17.38 20 17.24 C 20 17.09 19.97 16.96 19.92 16.83 C 19.86 16.7 19.79 16.58 19.69 16.48 L 14.78 11.57 L 17.89 9.48 C 18.11 9.37 18.28 9.19 18.39 8.97 C 18.5 8.75 18.55 8.5 18.51 8.26 C 18.48 8.02 18.37 7.79 18.21 7.61 C 18.04 7.43 17.82 7.31 17.58 7.26 L 4 3.35 L 7.91 16.91 Z' }],
    pen: [{ d: 'M 8 19.33 L 4 19.33 L 4 15.33 L 14.5 4.83 C 14.76 4.57 15.07 4.36 15.42 4.22 C 15.76 4.07 16.13 4 16.5 4 C 16.87 4 17.24 4.07 17.58 4.22 C 17.93 4.36 18.24 4.57 18.5 4.83 C 18.76 5.09 18.97 5.4 19.11 5.75 C 19.26 6.09 19.33 6.46 19.33 6.83 C 19.33 7.2 19.26 7.57 19.11 7.91 C 18.97 8.25 18.76 8.57 18.5 8.83 L 8 19.33 Z' }, { d: 'M 8 19.33 L 17.58 19.33' }, { d: 'M 13.5 5.83 L 17.5 9.83' }, { d: 'M 13.67 6.83 L 19.33 6.83' }],
    eraser: [{ d: 'M 18.02 19.96 L 7.52 19.96 L 3.31 15.66 C 3.13 15.47 3.02 15.22 3.02 14.95 C 3.02 14.69 3.13 14.43 3.31 14.25 L 13.31 4.25 C 13.5 4.06 13.75 3.96 14.02 3.96 C 14.28 3.96 14.54 4.06 14.72 4.25 L 19.72 9.25 C 19.91 9.43 20.01 9.69 20.01 9.95 C 20.01 10.22 19.91 10.47 19.72 10.66 L 10.52 19.96' }, { d: 'M 17.02 13.26 L 10.72 6.96' }, { d: 'M 6.25 18.25 L 3.25 15.25' }],
    line: [{ d: 'M 4 18 C 4 18.53 4.21 19.04 4.59 19.41 C 4.96 19.79 5.47 20 6 20 C 6.53 20 7.04 19.79 7.41 19.41 C 7.79 19.04 8 18.53 8 18 C 8 17.47 7.79 16.96 7.41 16.59 C 7.04 16.21 6.53 16 6 16 C 5.47 16 4.96 16.21 4.59 16.59 C 4.21 16.96 4 17.47 4 18 Z' }, { d: 'M 16 6 C 16 6.53 16.21 7.04 16.59 7.41 C 16.96 7.79 17.47 8 18 8 C 18.53 8 19.04 7.79 19.41 7.41 C 19.79 7.04 20 6.53 20 6 C 20 5.47 19.79 4.96 19.41 4.59 C 19.04 4.21 18.53 4 18 4 C 17.47 4 16.96 4.21 16.59 4.59 C 16.21 4.96 16 5.47 16 6 Z' }, { d: 'M 7.5 16.5 L 16.5 7.5' }],
    rect: [{ d: 'M 3 7 C 3 6.47 3.21 5.96 3.59 5.59 C 3.96 5.21 4.47 5 5 5 L 19 5 C 19.53 5 20.04 5.21 20.41 5.59 C 20.79 5.96 21 6.47 21 7 L 21 17 C 21 17.53 20.79 18.04 20.41 18.41 C 20.04 18.79 19.53 19 19 19 L 5 19 C 4.47 19 3.96 18.79 3.59 18.41 C 3.21 18.04 3 17.53 3 17 L 3 7 Z' }],
    ellipse: [{ d: 'M 20 12 C 20 16.42 16.42 20 12 20 C 7.58 20 4 16.42 4 12 C 4 7.58 7.58 4 12 4 C 16.42 4 20 7.58 20 12 Z' }],
    poly: [{ d: 'M 12 3.5 L 20 9.4 L 17 19 L 7 19 L 4 9.4 L 12 3.5 Z' }],
    fill: [{ d: 'M 6 11.5 L 12 5.5 L 18 11.5 L 12 17.5 C 11.85 17.65 11.67 17.78 11.47 17.86 C 11.28 17.94 11.06 17.99 10.85 17.99 C 10.64 17.99 10.42 17.94 10.23 17.86 C 10.03 17.78 9.85 17.65 9.7 17.5 L 6 13.8 C 5.85 13.65 5.72 13.47 5.64 13.27 C 5.56 13.08 5.51 12.86 5.51 12.65 C 5.51 12.44 5.56 12.22 5.64 12.03 C 5.72 11.83 5.85 11.65 6 11.5 Z' }, { d: 'M 12 5.5 L 10 3.5' }, { d: 'M 19.5 15.5 C 19.5 15.5 21 17.4 21 18.5 C 21 18.9 20.84 19.28 20.56 19.56 C 20.28 19.84 19.9 20 19.5 20 C 19.1 20 18.72 19.84 18.44 19.56 C 18.16 19.28 18 18.9 18 18.5 C 18 17.4 19.5 15.5 19.5 15.5 Z', fill: true }],
    select: [{ d: 'M 4 8.5 L 4 5.5 C 4 5.1 4.16 4.72 4.44 4.44 C 4.72 4.16 5.1 4 5.5 4 L 8.5 4' }, { d: 'M 15.5 4 L 18.5 4 C 18.9 4 19.28 4.16 19.56 4.44 C 19.84 4.72 20 5.1 20 5.5 L 20 8.5' }, { d: 'M 20 15.5 L 20 18.5 C 20 18.9 19.84 19.28 19.56 19.56 C 19.28 19.84 18.9 20 18.5 20 L 15.5 20' }, { d: 'M 8.5 20 L 5.5 20 C 5.1 20 4.72 19.84 4.44 19.56 C 4.16 19.28 4 18.9 4 18.5 L 4 15.5' }],
    text: [{ d: 'M5 5h14M12 5v14M9 19h6' }],
    shapes: [{ d: 'M4 5h8v8H4z' }, { d: 'M20 15.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z' }],
    clearAll: [{ d: 'M4 7h16' }, { d: 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2' }, { d: 'M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12' }],
    invert: [{ d: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z' }, { d: 'M12 4a8 8 0 0 1 0 16Z', fill: true }],
    flipH: [{ d: 'M12 3v18' }, { d: 'M8 8L4 12l4 4V8z', fill: true }, { d: 'M16 8l4 4-4 4V8z', fill: true }],
    flipV: [{ d: 'M3 12h18' }, { d: 'M8 8l4-4 4 4H8z', fill: true }, { d: 'M8 16l4 4 4-4H8z', fill: true }],
    more: [{ d: 'M6 12h.01M12 12h.01M18 12h.01' }],
    // Verbatim copy of the monolith's OWN hand-drawn undo/redo icons
    // (index.html, the ts-rail-history buttons around `doUndo`/`doRedo` --
    // NOT part of the separate Figma ICONS map, but real SVG path data does
    // exist in the monolith itself, just outside that map). Corrects an
    // earlier, inaccurate assumption in this file's history (see
    // Toolbar.tsx's prior doc comment, since removed) that no such path
    // data existed anywhere and these would need to come from Tabler --
    // when the monolith's own asset is available, porting it verbatim
    // takes precedence over substituting a library icon, same as every
    // other entry in this map.
    undo: [{ d: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11' }],
    redo: [{ d: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13' }],
    // Sourced from Tabler Icons (MIT, @tabler/icons 3.45.0, icons/outline/
    // plus.svg and minus.svg) rather than hand-drawn -- these two concepts
    // aren't part of the original Figma ICONS map (see this file's header),
    // and per the target stack's own convention, icons missing from BOTH
    // Figma and the monolith's own inline SVGs are meant to come from
    // Tabler, not be invented (unlike undo/redo above, the monolith itself
    // has no hand-drawn zoom plus/minus outside its own zoom-pill buttons,
    // which this file's ZoomControls.tsx now reuses verbatim in spirit --
    // same two line segments, Tabler's path notation just differs).
    // Kept as generic plus/minus (not zoom-specific names) so any future
    // +/- control can reuse them instead of each one hand-rolling its own.
    plus: [{ d: 'M12 5v14M5 12h14' }],
    minus: [{ d: 'M5 12h14' }],
    // Sourced from Tabler Icons (MIT, @tabler/icons 3.45.0, icons/outline/
    // crosshair.svg) -- same rationale as plus/minus above: the "center
    // guide line" concept (StudioCanvas's optional cross-hair overlay) has
    // no equivalent in either the Figma ICONS map or the monolith's own
    // hand-drawn SVGs, so it comes from Tabler rather than being invented.
    // The four corner-bracket paths plus the two center-line paths are
    // copied verbatim; Tabler's own invisible 24x24 hit-box path (present
    // in every icon file, never rendered) is omitted like it is everywhere
    // else in this map.
    crosshair: [
      { d: 'M4 8v-2a2 2 0 0 1 2 -2h2' },
      { d: 'M4 16v2a2 2 0 0 0 2 2h2' },
      { d: 'M16 4h2a2 2 0 0 1 2 2v2' },
      { d: 'M16 20h2a2 2 0 0 0 2 -2v-2' },
      { d: 'M9 12l6 0' },
      { d: 'M12 9l0 6' },
    ]
  };

export type IconName = keyof typeof ICONS;
