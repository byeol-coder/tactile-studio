import type { TablerIcon } from '@tabler/icons-react';
import {
  IconAccessible,
  IconArrowRight,
  IconArrowsMinimize,
  IconArtboard,
  IconBooks,
  IconBucket,
  IconBuildingMonument,
  IconChevronDown,
  IconChevronUp,
  IconCircle,
  IconClock,
  IconCloud,
  IconContrast2,
  IconCopy,
  IconCrop,
  IconDeviceFloppy,
  IconDeviceTablet,
  IconDeviceTabletCheck,
  IconDeviceTabletOff,
  IconEraser,
  IconExternalLink,
  IconFocus,
  IconFolder,
  IconGridDots,
  IconHeart,
  IconHelpCircle,
  IconHome,
  IconKeyboard,
  IconLibrary,
  IconLine,
  IconPaint,
  IconPalette,
  IconPencil,
  IconPhoto,
  IconPlayerPlay,
  IconPlus,
  IconPointer,
  IconPolygon,
  IconRectangle,
  IconRefresh,
  IconSend,
  IconSettings,
  IconSparkles,
  IconStar,
  IconTemplate,
  IconUser,
  IconUserCircle,
  IconWand,
  IconWorld,
} from '@tabler/icons-react';

export const ICON_COLOR_TOKENS = {
  default: 'var(--color-icon)',
  hover: 'var(--color-icon-hover)',
  disabled: 'var(--color-icon-disabled)',
  active: 'var(--color-icon-active)',
  selected: 'var(--color-icon-active)',
} as const;

/** System defaults: 24px box, 2px stroke, Tabler outline only. */
export const ICON_SIZE_DEFAULT = 24;
export const ICON_SIZE = { dense: 20, default: 24, hero: 32 } as const;
export const ICON_STROKE_WIDTH = 2;

export const iconRegistry = {
  plus: IconPlus,
  template: IconTemplate,
  save: IconDeviceFloppy,
  folder: IconFolder,
  image: IconPhoto,
  home: IconHome,
  clock: IconClock,
  library: IconLibrary,
  user: IconUser,
  'external-link': IconExternalLink,
  dotpad: IconGridDots,
  device: IconDeviceTablet,
  send: IconSend,
  refresh: IconRefresh,
  keyboard: IconKeyboard,
  help: IconHelpCircle,
  accessibility: IconAccessible,
  'chevron-down': IconChevronDown,
  'chevron-up': IconChevronUp,
  crop: IconCrop,
  star: IconStar,
  heart: IconHeart,
  arrow: IconArrowRight,
  sparkle: IconSparkles,
  'dotpad-connected': IconDeviceTabletCheck,
  'dotpad-disconnected': IconDeviceTabletOff,
  'tactile-preview': IconGridDots,
  threshold: IconContrast2,
  'line-weight': IconLine,
  denoise: IconWand,
  simplify: IconArrowsMinimize,
  cursor: IconPointer,
  pen: IconPencil,
  eraser: IconEraser,
  line: IconLine,
  rect: IconRectangle,
  ellipse: IconCircle,
  polygon: IconPolygon,
  bucket: IconBucket,
  select: IconFocus,
  fill: IconPaint,
  copy: IconCopy,
  settings: IconSettings,
} satisfies Record<string, TablerIcon>;

export type IconName = keyof typeof iconRegistry;
export type IconState = keyof typeof ICON_COLOR_TOKENS;

export const UI_ICON_NAMES = Object.keys(iconRegistry) as IconName[];

export function getIcon(name: IconName): TablerIcon {
  return iconRegistry[name];
}

export function getIconColor(state: IconState = 'default'): string {
  return ICON_COLOR_TOKENS[state];
}

/**
 * Service → icon mapping for the Tactile ecosystem (approved guideline).
 * Reference these for cross-service nav / product switchers / headers.
 * Note: `dotpadConnection` intentionally reuses the in-app device family
 * (IconDeviceTablet) to stay consistent with the `device` /
 * `dotpad-connected` entries in iconRegistry above.
 *
 * This is additive foundation only — it does NOT replace any rendered UI icon.
 */
export const SERVICE_ICONS = {
  tactileStudio: IconPalette,
  dotLibrary: IconBooks,
  tactileDrive: IconCloud,
  dotPlay: IconPlayerPlay,
  dotCanvas: IconArtboard,
  dotpadConnection: IconDeviceTablet,
  imageBank: IconPhoto,
  tactileWorld: IconWorld,
  dotHeritage: IconBuildingMonument,
  settings: IconSettings,
  account: IconUserCircle,
  help: IconHelpCircle,
} satisfies Record<string, TablerIcon>;

export type ServiceIconKey = keyof typeof SERVICE_ICONS;

export function getServiceIcon(key: ServiceIconKey): TablerIcon {
  return SERVICE_ICONS[key];
}
