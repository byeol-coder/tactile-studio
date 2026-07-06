import type { TactileDocument } from '../types/tactile';
import {
  computeQuality,
  convertImageToGrid,
  createEmptyGrid,
  drawShapeGrid,
  type TactileShape,
} from './tactileGrid';

function make(id: string, title: string, cells: TactileDocument['cells']): TactileDocument {
  const iso = new Date().toISOString();
  return {
    id,
    title,
    resolution: '60x40',
    cells,
    quality: computeQuality(cells, '60x40'),
    createdAt: iso,
    updatedAt: iso,
  };
}
const shape = (s: TactileShape, title: string) => make(`lib-${s}-${title}`, title, drawShapeGrid(s, '60x40'));
const seed = (k: string, title: string) => make(`lib-${k}`, title, convertImageToGrid(k, '60x40'));

export type LibraryScope = 'mine' | 'shared' | 'public';

/** Deterministic sample library (v0 mock — no backend). */
export function buildLibrary(): Record<LibraryScope, TactileDocument[]> {
  return {
    mine: [shape('circle', '원'), shape('heart', '하트'), seed('내작업-지도', '지도 스케치'), seed('내작업-그래프', '막대 그래프')],
    shared: [shape('star', '별'), shape('arrow', '화살표'), seed('공유-분자', '분자 구조'), seed('공유-도형', '도형 세트')],
    public: [seed('강아지', '강아지'), seed('고양이', '고양이'), seed('나무', '나무'), seed('집', '집'), shape('circle', '기본 원'), seed('하트패턴', '하트 패턴')],
  };
}

export const SCOPE_TITLE: Record<LibraryScope, string> = {
  mine: '내 라이브러리',
  shared: '공유 라이브러리',
  public: '공용 라이브러리',
};

/** Starter templates (blank + basic shapes) to begin a new tactile graphic. */
export function buildTemplates(): TactileDocument[] {
  return [
    make('tpl-empty', '빈 60×40 캔버스', createEmptyGrid('60x40')),
    shape('circle', '원 템플릿'),
    shape('heart', '하트 템플릿'),
    shape('star', '별 템플릿'),
    shape('arrow', '화살표 템플릿'),
  ];
}
