// src/ui/toolbar/GroupIcons.tsx
//
// Verbatim port of the monolith's strokeGroupIcon/eraserGroupIcon: a toolbar
// button glyph that reflects the CURRENT thickness (1/2/3) so the button
// itself communicates state, not just its dropdown. Pen/line/rect/ellipse/
// poly share the stacked-bars icon (line thickness); eraser gets nested
// squares (footprint size) since it clears an n×n block, not a line.

import React from 'react';

export function StrokeGroupIcon({ size = 20, activeN = 0 }: { size?: number; activeN?: number }) {
  const on = Math.max(0, Math.min(3, activeN || 0));
  const dim = (n: number) => (on === 0 || on === n ? 1 : 0.32);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <line x1={5} y1={7} x2={19} y2={7} stroke="currentColor" strokeOpacity={dim(1)} strokeWidth={1.6} strokeLinecap="round" />
      <line x1={5} y1={12.5} x2={19} y2={12.5} stroke="currentColor" strokeOpacity={dim(2)} strokeWidth={3} strokeLinecap="round" />
      <line x1={5} y1={18} x2={19} y2={18} stroke="currentColor" strokeOpacity={dim(3)} strokeWidth={4.6} strokeLinecap="round" />
    </svg>
  );
}

export function EraserGroupIcon({ size = 20, activeN = 0 }: { size?: number; activeN?: number }) {
  const on = Math.max(0, Math.min(3, activeN || 0));
  const dim = (n: number) => (on === 0 || on === n ? 1 : 0.3);
  const sq = (n: number) => {
    const s = 7 + n * 3.6, o = (24 - s) / 2;
    return <rect key={n} x={o} y={o} width={s} height={s} rx={2.2} stroke="currentColor" strokeOpacity={dim(n)} strokeWidth={1.8} fill="none" />;
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {sq(1)}{sq(2)}{sq(3)}
    </svg>
  );
}
