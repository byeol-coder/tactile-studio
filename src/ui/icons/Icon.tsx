// src/ui/icons/Icon.tsx
import React from 'react';
import { ICONS } from './icons.js';

export interface IconProps {
  name: string;
  size?: number;
  title?: string;
}

/**
 * Renders an ICONS entry verbatim: each path is stroked by default (matching
 * the monolith's toolbar icon rendering — 1.7px round-joined stroke, no
 * fill), except paths explicitly marked `fill: true` (used for small
 * solid accents like the flip-arrow heads), which are filled with
 * currentColor and stroked not at all.
 */
export function Icon({ name, size = 20, title }: IconProps) {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {paths.map((p, i) =>
        p.fill
          ? <path key={i} d={p.d} fill="currentColor" stroke="none" />
          : <path key={i} d={p.d} />,
      )}
    </svg>
  );
}
