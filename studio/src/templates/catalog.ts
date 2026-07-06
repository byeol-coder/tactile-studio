import type { CursorPos } from '../a11y/cursor';
import { RESOLUTION_DIMS, type TactileResolution } from '../types/tactile';
import { bresenhamLine, ellipseCells, rectCells } from '../geometry/raster';

/**
 * Starter Template Library (broad tactile-creation catalog — not education-only).
 *
 * Templates are self-describing (bilingual title/description live here, so the
 * i18n catalog stays small) and produce raised cells via a resolution-aware
 * `generate()` so the same definition adapts to 60×40 and 96×64. Generators use
 * simple raised-line contours with whitespace — tactile-readable starting
 * points, not finished artwork. `conversion-preset` entries carry no generator
 * (metadata/preset placeholders for the image pipeline; see load handling).
 */
export type TemplateCategory =
  | 'education'
  | 'diagram'
  | 'primitive'
  | 'image-conversion'
  | 'heritage'
  | 'custom';
export type TemplateSubject = 'math' | 'science' | 'geography' | 'language' | 'none';
export type TemplatePurpose = 'lesson' | 'museum' | 'map' | 'graph' | 'object' | 'guide' | 'layout' | 'helper';
export type TemplateAssetType = 'full-template' | 'primitive' | 'layout' | 'conversion-preset';

export interface Bilingual {
  ko: string;
  en: string;
}

export interface ConversionPreset {
  threshold: number;
  dither: boolean;
  invert: boolean;
}

/**
 * An image-conversion preset "armed" for the next image import. Carries the
 * definition id and bilingual title (for display) plus the sanitized preset
 * values that pre-fill the {@link ImageImportPanel}. It generates no cells.
 */
export interface PendingConversionPreset {
  id: string;
  title: Bilingual;
  preset: ConversionPreset;
}

export interface TactileTemplateDefinition {
  id: string;
  title: Bilingual;
  description: Bilingual;
  category: TemplateCategory;
  subject?: TemplateSubject;
  purpose?: TemplatePurpose;
  assetType: TemplateAssetType;
  supportedGridSizes: TactileResolution[];
  defaultGridSize: TactileResolution;
  tags: string[];
  /** Raised cells for a supported resolution. Omitted for conversion-preset. */
  generate?: (resolution: TactileResolution) => CursorPos[];
  /** Only for assetType 'conversion-preset'. */
  preset?: ConversionPreset;
}

// ── generator helpers (all take/produce in-bounds coords) ────────────────────
const box = (x0: number, y0: number, x1: number, y1: number): CursorPos[] =>
  rectCells({ x: x0, y: y0 }, { x: x1, y: y1 }, false);
const line = (x0: number, y0: number, x1: number, y1: number): CursorPos[] =>
  bresenhamLine(x0, y0, x1, y1);
const ring = (x0: number, y0: number, x1: number, y1: number): CursorPos[] =>
  ellipseCells({ x: x0, y: y0 }, { x: x1, y: y1 }, false);

/** Evenly spaced ticks along a horizontal line. */
function hTicks(y: number, W: number, step: number, len: number): CursorPos[] {
  const out: CursorPos[] = [];
  for (let x = step; x < W - 1; x += step) for (let d = -len; d <= len; d++) out.push({ x, y: y + d });
  return out;
}

// ── the catalog ──────────────────────────────────────────────────────────────
export const TEMPLATES: TactileTemplateDefinition[] = [
  // Education · Math
  {
    id: 'edu-math-coordinate-plane',
    title: { ko: '좌표평면', en: 'Coordinate plane' },
    description: { ko: '가로·세로 축과 눈금이 있는 좌표평면', en: 'X and Y axes with tick marks' },
    category: 'education',
    subject: 'math',
    purpose: 'graph',
    assetType: 'full-template',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['축', 'graph', '좌표'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const cx = (W / 2) | 0;
      const cy = (H / 2) | 0;
      return [
        ...line(1, cy, W - 2, cy),
        ...line(cx, 1, cx, H - 2),
        ...hTicks(cy, W, Math.max(4, (W / 12) | 0), 1),
      ];
    },
  },
  {
    id: 'edu-math-number-line',
    title: { ko: '수직선', en: 'Number line' },
    description: { ko: '눈금과 화살표가 있는 수직선', en: 'A number line with ticks and arrows' },
    category: 'education',
    subject: 'math',
    purpose: 'graph',
    assetType: 'full-template',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['수', 'number', '눈금'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const y = (H / 2) | 0;
      return [
        ...line(2, y, W - 3, y),
        ...line(W - 3, y, W - 6, y - 3),
        ...line(W - 3, y, W - 6, y + 3), // right arrowhead
        ...line(2, y, 5, y - 3),
        ...line(2, y, 5, y + 3), // left arrowhead
        ...hTicks(y, W, Math.max(5, (W / 10) | 0), 2),
      ];
    },
  },
  {
    id: 'edu-math-basic-geometry',
    title: { ko: '기본 도형', en: 'Basic shapes' },
    description: { ko: '삼각형과 사각형 기본 도형 세트', en: 'A triangle and a rectangle to start from' },
    category: 'education',
    subject: 'math',
    purpose: 'lesson',
    assetType: 'full-template',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['도형', 'shapes', '삼각형', '사각형'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const m = Math.max(3, (H / 8) | 0);
      const midX = (W / 2) | 0;
      // rectangle on the left, triangle on the right
      const rect = box(m, m, midX - m, H - 1 - m);
      const ax = midX + m;
      const bx = W - 1 - m;
      const topY = m;
      const botY = H - 1 - m;
      const apex = ((ax + bx) / 2) | 0;
      const tri = [...line(ax, botY, bx, botY), ...line(ax, botY, apex, topY), ...line(bx, botY, apex, topY)];
      return [...rect, ...tri];
    },
  },

  // Education · Science
  {
    id: 'edu-sci-cell',
    title: { ko: '세포 구조', en: 'Cell diagram' },
    description: { ko: '세포막과 핵을 나타낸 세포 다이어그램', en: 'A cell membrane with a nucleus' },
    category: 'education',
    subject: 'science',
    purpose: 'lesson',
    assetType: 'full-template',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['세포', 'cell', '과학'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const mx = (W * 0.15) | 0;
      const my = (H * 0.15) | 0;
      const cx = (W / 2) | 0;
      const cy = (H / 2) | 0;
      const nr = Math.max(3, (Math.min(W, H) * 0.12) | 0);
      return [...ring(mx, my, W - 1 - mx, H - 1 - my), ...ring(cx - nr, cy - nr, cx + nr, cy + nr)];
    },
  },
  {
    id: 'edu-sci-circuit',
    title: { ko: '전기 회로', en: 'Electric circuit' },
    description: { ko: '전지가 있는 단순 폐회로', en: 'A simple closed loop with a battery gap' },
    category: 'education',
    subject: 'science',
    purpose: 'lesson',
    assetType: 'full-template',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['회로', 'circuit', '전기'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const mx = (W * 0.15) | 0;
      const my = (H * 0.2) | 0;
      const loop = box(mx, my, W - 1 - mx, H - 1 - my).filter(
        // leave a gap at the top-center for the battery symbol
        (c) => !(c.y === my && Math.abs(c.x - (W / 2 | 0)) <= 2),
      );
      const bx = (W / 2) | 0;
      const battery = [...line(bx - 2, my - 2, bx - 2, my + 2), ...line(bx + 2, my - 1, bx + 2, my + 1)];
      return [...loop, ...battery];
    },
  },

  // Education · Geography
  {
    id: 'edu-geo-compass',
    title: { ko: '나침반(방위)', en: 'Compass directions' },
    description: { ko: '동서남북 방위를 나타낸 십자 나침반', en: 'A cross with N/E/S/W end markers' },
    category: 'education',
    subject: 'geography',
    purpose: 'map',
    assetType: 'full-template',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['방위', 'compass', '지도'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const cx = (W / 2) | 0;
      const cy = (H / 2) | 0;
      const r = Math.max(6, (Math.min(W, H) * 0.35) | 0);
      const ends: CursorPos[] = [];
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const ex = cx + dx * r;
        const ey = cy + dy * r;
        ends.push(...ring(ex - 1, ey - 1, ex + 1, ey + 1)); // direction dot marker
      }
      return [...line(cx, cy - r, cx, cy + r), ...line(cx - r, cy, cx + r, cy), ...ends];
    },
  },
  {
    id: 'edu-geo-landform',
    title: { ko: '지형 단면', en: 'Landform cross-section' },
    description: { ko: '언덕 능선과 기준선을 나타낸 지형 단면', en: 'A terrain profile line over a baseline' },
    category: 'education',
    subject: 'geography',
    purpose: 'map',
    assetType: 'full-template',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['지형', 'terrain', '단면'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const base = (H * 0.8) | 0;
      const pts: CursorPos[] = [];
      for (let x = 1; x < W - 1; x++) {
        const t = (x / (W - 1)) * Math.PI * 2;
        const y = base - Math.round((Math.sin(t) * 0.5 + 0.5) * (H * 0.45));
        pts.push({ x, y });
      }
      const profile: CursorPos[] = [];
      for (let i = 1; i < pts.length; i++) profile.push(...line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y));
      return [...line(1, base, W - 2, base), ...profile];
    },
  },

  // Education · Language
  {
    id: 'edu-lang-braille-cell',
    title: { ko: '점자 셀 안내', en: 'Braille cell guide' },
    description: { ko: '2×3 점 배열의 점자 셀 안내', en: 'A 2×3 braille cell dot layout' },
    category: 'education',
    subject: 'language',
    purpose: 'guide',
    assetType: 'full-template',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['점자', 'braille', '문자'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const cx = (W / 2) | 0;
      const cy = (H / 2) | 0;
      const gx = Math.max(4, (W * 0.12) | 0);
      const gy = Math.max(4, (H * 0.18) | 0);
      const out: CursorPos[] = [];
      for (const c of [-1, 1]) for (const r of [-1, 0, 1]) {
        const x = cx + c * gx;
        const y = cy + r * gy;
        out.push(...ring(x - 1, y - 1, x + 1, y + 1));
      }
      return out;
    },
  },
  {
    id: 'edu-lang-writing-lines',
    title: { ko: '글자 쓰기 안내선', en: 'Letter practice lines' },
    description: { ko: '기준선·중간선·윗선의 글자 연습 안내', en: 'Baseline, midline and cap-line guides' },
    category: 'education',
    subject: 'language',
    purpose: 'guide',
    assetType: 'layout',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['쓰기', 'writing', '안내선'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const ys = [0.35, 0.5, 0.7].map((f) => (H * f) | 0);
      return ys.flatMap((y) => line(2, y, W - 3, y));
    },
  },

  // Diagrams
  {
    id: 'diagram-flowchart',
    title: { ko: '순서도', en: 'Flowchart' },
    description: { ko: '화살표로 연결된 두 단계 상자', en: 'Two step boxes joined by an arrow' },
    category: 'diagram',
    purpose: 'layout',
    assetType: 'layout',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['순서도', 'flow', '다이어그램'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const bw = (W * 0.3) | 0;
      const bh = (H * 0.25) | 0;
      const y0 = (H * 0.15) | 0;
      const y1 = (H * 0.6) | 0;
      const cx = (W / 2) | 0;
      const b1 = box(cx - (bw / 2) | 0, y0, cx + (bw / 2) | 0, y0 + bh);
      const b2 = box(cx - (bw / 2) | 0, y1, cx + (bw / 2) | 0, y1 + bh);
      const arrow = line(cx, y0 + bh, cx, y1); // connector
      const head = [...line(cx, y1, cx - 2, y1 - 2), ...line(cx, y1, cx + 2, y1 - 2)]; // downward head
      return [...b1, ...b2, ...arrow, ...head];
    },
  },
  {
    id: 'diagram-table-grid',
    title: { ko: '표(격자)', en: 'Table grid' },
    description: { ko: '행과 열이 있는 표 격자', en: 'A bordered table with rows and columns' },
    category: 'diagram',
    purpose: 'layout',
    assetType: 'layout',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['표', 'table', '격자'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const x0 = (W * 0.12) | 0;
      const y0 = (H * 0.15) | 0;
      const x1 = W - 1 - x0;
      const y1 = H - 1 - y0;
      const cells = [...box(x0, y0, x1, y1)];
      for (let c = 1; c < 3; c++) cells.push(...line(x0 + ((x1 - x0) * c) / 3, y0, x0 + ((x1 - x0) * c) / 3, y1));
      for (let r = 1; r < 3; r++) cells.push(...line(x0, y0 + ((y1 - y0) * r) / 3, x1, y0 + ((y1 - y0) * r) / 3));
      return cells.map((p) => ({ x: p.x | 0, y: p.y | 0 }));
    },
  },
  {
    id: 'diagram-timeline',
    title: { ko: '타임라인', en: 'Timeline' },
    description: { ko: '시점 표시가 있는 가로 타임라인', en: 'A horizontal timeline with event marks' },
    category: 'diagram',
    purpose: 'layout',
    assetType: 'layout',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['타임라인', 'timeline', '순서'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const y = (H / 2) | 0;
      const out = [...line(2, y, W - 3, y)];
      const n = 4;
      for (let i = 0; i < n; i++) {
        const x = (2 + ((W - 5) * (i + 0.5)) / n) | 0;
        out.push(...ring(x - 2, y - 2, x + 2, y + 2));
      }
      return out;
    },
  },

  // Tactile primitives
  {
    id: 'prim-line',
    title: { ko: '선', en: 'Line' },
    description: { ko: '기본 대각선', en: 'A simple diagonal line' },
    category: 'primitive',
    purpose: 'helper',
    assetType: 'primitive',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['선', 'line'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      return line((W * 0.2) | 0, (H * 0.7) | 0, (W * 0.8) | 0, (H * 0.3) | 0);
    },
  },
  {
    id: 'prim-arrow',
    title: { ko: '화살표', en: 'Arrow' },
    description: { ko: '방향을 가리키는 화살표', en: 'A direction arrow' },
    category: 'primitive',
    purpose: 'helper',
    assetType: 'primitive',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['화살표', 'arrow', '방향'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const y = (H / 2) | 0;
      const tx = (W * 0.8) | 0;
      return [...line((W * 0.2) | 0, y, tx, y), ...line(tx, y, tx - 4, y - 4), ...line(tx, y, tx - 4, y + 4)];
    },
  },
  {
    id: 'prim-circle',
    title: { ko: '원', en: 'Circle' },
    description: { ko: '가운데 정렬된 원 윤곽', en: 'A centered circle outline' },
    category: 'primitive',
    purpose: 'helper',
    assetType: 'primitive',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['원', 'circle'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const r = (Math.min(W, H) * 0.35) | 0;
      const cx = (W / 2) | 0;
      const cy = (H / 2) | 0;
      return ring(cx - r, cy - r, cx + r, cy + r);
    },
  },
  {
    id: 'prim-rectangle',
    title: { ko: '사각형', en: 'Rectangle' },
    description: { ko: '가운데 정렬된 사각형 윤곽', en: 'A centered rectangle outline' },
    category: 'primitive',
    purpose: 'helper',
    assetType: 'primitive',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['사각형', 'rectangle'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      return box((W * 0.25) | 0, (H * 0.25) | 0, (W * 0.75) | 0, (H * 0.75) | 0);
    },
  },
  {
    id: 'prim-boundary-frame',
    title: { ko: '테두리 프레임', en: 'Boundary frame' },
    description: { ko: '캔버스 가장자리 테두리', en: 'An inset border around the canvas' },
    category: 'primitive',
    purpose: 'helper',
    assetType: 'primitive',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['테두리', 'frame', '경계'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      return box(1, 1, W - 2, H - 2);
    },
  },

  // Image-conversion presets (metadata/preset placeholders — see load handling)
  {
    id: 'conv-outline',
    title: { ko: '윤곽선 변환 프리셋', en: 'Outline conversion preset' },
    description: { ko: '윤곽 위주로 이미지를 변환하는 프리셋', en: 'Favor edges/outlines when converting an image' },
    category: 'image-conversion',
    purpose: 'object',
    assetType: 'conversion-preset',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['변환', 'outline', 'preset'],
    preset: { threshold: 110, dither: false, invert: false },
  },
  {
    id: 'conv-high-contrast',
    title: { ko: '고대비 변환 프리셋', en: 'High-contrast preset' },
    description: { ko: '밝고 어두움을 강하게 나눈 변환', en: 'A hard light/dark split for bold shapes' },
    category: 'image-conversion',
    purpose: 'object',
    assetType: 'conversion-preset',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['변환', 'contrast', 'preset'],
    preset: { threshold: 128, dither: false, invert: false },
  },
  {
    id: 'conv-silhouette',
    title: { ko: '실루엣 변환 프리셋', en: 'Object silhouette preset' },
    description: { ko: '사물 실루엣을 채워 변환', en: 'Fill a solid object silhouette' },
    category: 'image-conversion',
    purpose: 'object',
    assetType: 'conversion-preset',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['변환', 'silhouette', 'preset'],
    preset: { threshold: 150, dither: true, invert: false },
  },

  // Museum / Heritage / Exhibition
  {
    id: 'heritage-exhibit-outline',
    title: { ko: '전시물 윤곽', en: 'Exhibit object outline' },
    description: { ko: '도자기 형태의 전시물 윤곽 시작점', en: 'A vessel-like exhibit outline to start from' },
    category: 'heritage',
    purpose: 'object',
    assetType: 'full-template',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['전시', 'exhibit', '유물'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const cx = (W / 2) | 0;
      const bodyTop = (H * 0.35) | 0;
      const bodyBot = (H * 0.85) | 0;
      const bw = (W * 0.22) | 0;
      const neck = (W * 0.08) | 0;
      const rimY = (H * 0.18) | 0;
      return [
        ...ring(cx - bw, bodyTop, cx + bw, bodyBot), // body
        ...line(cx - neck, rimY, cx - neck, bodyTop), // neck sides
        ...line(cx + neck, rimY, cx + neck, bodyTop),
        ...line(cx - neck, rimY, cx + neck, rimY), // rim
      ];
    },
  },
  {
    id: 'heritage-building-facade',
    title: { ko: '건물 정면', en: 'Building facade' },
    description: { ko: '지붕·문·창이 있는 건물 정면 시작점', en: 'A facade with roof, door and windows' },
    category: 'heritage',
    purpose: 'guide',
    assetType: 'full-template',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['건물', 'building', '유산'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const x0 = (W * 0.2) | 0;
      const x1 = (W * 0.8) | 0;
      const wallTop = (H * 0.4) | 0;
      const wallBot = (H * 0.85) | 0;
      const apex = (W / 2) | 0;
      const roofTop = (H * 0.15) | 0;
      const doorW = (W * 0.08) | 0;
      const door = box(apex - doorW, (H * 0.62) | 0, apex + doorW, wallBot);
      const winY0 = (H * 0.5) | 0;
      const winY1 = (H * 0.58) | 0;
      const wL = box(x0 + 3, winY0, x0 + 3 + doorW, winY1);
      const wR = box(x1 - 3 - doorW, winY0, x1 - 3, winY1);
      return [
        ...box(x0, wallTop, x1, wallBot),
        ...line(x0, wallTop, apex, roofTop),
        ...line(x1, wallTop, apex, roofTop),
        ...door,
        ...wL,
        ...wR,
      ];
    },
  },
  {
    id: 'heritage-info-card',
    title: { ko: '촉각 정보 카드', en: 'Tactile info card' },
    description: { ko: '제목과 본문 영역이 있는 정보 카드 레이아웃', en: 'A card with a title area and body lines' },
    category: 'heritage',
    purpose: 'layout',
    assetType: 'layout',
    supportedGridSizes: ['60x40', '96x64'],
    defaultGridSize: '60x40',
    tags: ['카드', 'card', '설명'],
    generate: (res) => {
      const { width: W, height: H } = RESOLUTION_DIMS[res];
      const x0 = 2;
      const y0 = 2;
      const x1 = W - 3;
      const y1 = H - 3;
      const titleY = (H * 0.28) | 0;
      const bodyLines = [0.45, 0.6, 0.75].map((f) => (H * f) | 0);
      return [
        ...box(x0, y0, x1, y1),
        ...line(x0 + 2, titleY, x1 - 2, titleY), // title separator
        ...bodyLines.flatMap((y) => line(x0 + 4, y, x1 - 4, y)),
      ];
    },
  },
];

/** Look up a template by id (stable, unique). */
export function getTemplate(id: string): TactileTemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** UI groups (curated). "Recommended" references a hand-picked subset by id. */
export type TemplateGroupKey =
  | 'recommended'
  | 'education'
  | 'diagram'
  | 'primitive'
  | 'image-conversion'
  | 'heritage';

const RECOMMENDED_IDS = [
  'edu-math-coordinate-plane',
  'edu-sci-cell',
  'diagram-flowchart',
  'prim-boundary-frame',
  'heritage-exhibit-outline',
];

export function templatesForGroup(group: TemplateGroupKey): TactileTemplateDefinition[] {
  if (group === 'recommended') {
    return RECOMMENDED_IDS.map((id) => getTemplate(id)).filter((t): t is TactileTemplateDefinition => Boolean(t));
  }
  return TEMPLATES.filter((t) => t.category === group);
}

/** Default conversion values when a preset omits or malforms its metadata. */
const DEFAULT_CONVERSION_PRESET: ConversionPreset = { threshold: 128, dither: false, invert: false };

/**
 * Coerce possibly-partial/invalid preset metadata into a safe {@link ConversionPreset}
 * — threshold is clamped to 0–255 (falling back to the default when non-finite),
 * booleans are normalized. Never throws, so bad catalog data can't crash a load.
 */
export function normalizeConversionPreset(preset?: Partial<ConversionPreset> | null): ConversionPreset {
  const raw = preset?.threshold;
  const threshold =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.min(255, Math.max(0, Math.round(raw)))
      : DEFAULT_CONVERSION_PRESET.threshold;
  return { threshold, dither: Boolean(preset?.dither), invert: Boolean(preset?.invert) };
}

/**
 * Build a {@link PendingConversionPreset} from a template. Returns null for any
 * template that is not a `conversion-preset` (those load as documents instead).
 * Missing/invalid preset metadata is made safe via {@link normalizeConversionPreset}.
 */
export function toPendingConversionPreset(t: TactileTemplateDefinition): PendingConversionPreset | null {
  if (t.assetType !== 'conversion-preset') return null;
  return { id: t.id, title: t.title, preset: normalizeConversionPreset(t.preset) };
}
