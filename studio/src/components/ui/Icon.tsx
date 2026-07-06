import type { ReactNode } from 'react';

/**
 * Inline SVG icon set (Dot / Tabler-style, 24×24, stroke = currentColor).
 * Mirrors the Dot Design System icons used in Figma so the app uses no emoji.
 */
export type IconName =
  | 'plus'
  | 'template'
  | 'save'
  | 'folder'
  | 'image'
  | 'home'
  | 'clock'
  | 'library'
  | 'user'
  | 'external-link'
  | 'dotpad'
  | 'device'
  | 'send'
  | 'refresh'
  | 'keyboard'
  | 'help'
  | 'accessibility'
  | 'chevron-down'
  | 'chevron-up'
  | 'crop'
  | 'star'
  | 'heart'
  | 'arrow'
  | 'sparkle'
  | 'dotpad-connected'
  | 'dotpad-disconnected'
  | 'tactile-preview'
  | 'threshold'
  | 'line-weight'
  | 'denoise'
  | 'simplify';

const PATHS: Record<IconName, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  template: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
  save: (
    <>
      <path d="M6 4h9l3 3v13H6z" />
      <path d="M9 4v5h6" />
      <path d="M9 14h6v6H9z" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="M4 18l5-5 4 4 3-3 4 4" />
    </>
  ),
  home: (
    <>
      <path d="M5 11l7-6 7 6" />
      <path d="M6 10v9h12v-9" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  library: (
    <>
      <path d="M4 5a1 1 0 0 1 1-1h4v16H5a1 1 0 0 1-1-1z" />
      <path d="M13 4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-5z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  'external-link': (
    <>
      <path d="M11 7H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4" />
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
    </>
  ),
  dotpad: (
    <g fill="currentColor" stroke="none">
      <circle cx="9" cy="7" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="9" cy="17" r="1.6" />
      <circle cx="15" cy="7" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="15" cy="17" r="1.6" />
    </g>
  ),
  device: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M10 18h4" />
    </>
  ),
  send: <path d="M8 5l11 7-11 7z" />,
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2 5" />
      <path d="M20 5v6h-6" />
    </>
  ),
  keyboard: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 4 2c0 1.5-2 2-2 3.5" />
      <path d="M12 17h.01" />
    </>
  ),
  accessibility: (
    <>
      <circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" />
      <path d="M5 8c2 1 5 1.5 7 1.5S17 9 19 8" />
      <path d="M12 9.5V15" />
      <path d="M9 20l3-5 3 5" />
    </>
  ),
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'chevron-up': <path d="M6 15l6-6 6 6" />,
  crop: (
    <>
      <path d="M7 3v14h14" />
      <path d="M3 7h14v14" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9z" />,
  heart: (
    <path d="M19.5 12.6L12 20l-7.5-7.4a5 5 0 1 1 7.5-6.6 5 5 0 1 1 7.5 6.6z" />
  ),
  arrow: (
    <>
      <path d="M4 12h16" />
      <path d="M13 6l7 6-7 6" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M18.5 3.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z" />
    </>
  ),
  'dotpad-connected': (
    <>
      <g fill="currentColor" stroke="none">
        <circle cx="8.5" cy="6.5" r="1.4" />
        <circle cx="8.5" cy="12" r="1.4" />
        <circle cx="8.5" cy="17.5" r="1.4" />
        <circle cx="14" cy="6.5" r="1.4" />
        <circle cx="14" cy="12" r="1.4" />
      </g>
      <path d="M14.5 17.5l2 2 4-4.5" />
    </>
  ),
  'dotpad-disconnected': (
    <>
      <circle cx="8.5" cy="6.5" r="1.5" />
      <circle cx="8.5" cy="12" r="1.5" />
      <circle cx="8.5" cy="17.5" r="1.5" />
      <circle cx="15.5" cy="6.5" r="1.5" />
      <circle cx="15.5" cy="12" r="1.5" />
      <circle cx="15.5" cy="17.5" r="1.5" />
      <path d="M5 19L19 5" />
    </>
  ),
  'tactile-preview': (
    <>
      <rect x="4" y="6" width="16" height="13" rx="2" />
      <g fill="currentColor" stroke="none">
        <circle cx="8.5" cy="10.5" r="0.9" />
        <circle cx="12" cy="10.5" r="0.9" />
        <circle cx="15.5" cy="10.5" r="0.9" />
        <circle cx="8.5" cy="14.5" r="0.9" />
        <circle cx="12" cy="14.5" r="0.9" />
        <circle cx="15.5" cy="14.5" r="0.9" />
      </g>
    </>
  ),
  threshold: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill="currentColor" stroke="none" />
    </>
  ),
  'line-weight': (
    <>
      <path d="M5 7h14" strokeWidth={1} />
      <path d="M5 12h14" strokeWidth={2.5} />
      <path d="M5 17.5h14" strokeWidth={4} />
    </>
  ),
  denoise: (
    <>
      <g fill="currentColor" stroke="none">
        <circle cx="7" cy="12" r="2.4" />
        <circle cx="12.5" cy="12" r="1.5" />
        <circle cx="16.5" cy="12" r="0.9" />
      </g>
      <path d="M19 4l.7 1.9 1.9.7-1.9.7L19 9.2l-.7-1.9L16.4 6.6l1.9-.7z" />
    </>
  ),
  simplify: (
    <>
      <path d="M7 5l5 5 5-5" />
      <path d="M7 19l5-5 5 5" />
    </>
  ),
};

interface Props {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
}

/** Renders an icon. Decorative by default (aria-hidden); pass `title` for a labelled graphic. */
export function Icon({ name, size = 20, className, title }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}
