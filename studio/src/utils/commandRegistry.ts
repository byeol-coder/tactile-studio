import type { CommandCategoryMeta, CommandDef } from '../types/command';

/** Ordered category metadata — frequently-used (convert) first, DotPad separated. */
export const CATEGORIES: CommandCategoryMeta[] = [
  { key: 'convert', label: '변환', icon: '◑' },
  { key: 'create', label: '도형 만들기', icon: '◇' },
  { key: 'library', label: '라이브러리', icon: '▤' },
  { key: 'dotpad', label: 'DotPad', icon: '⌨' },
  { key: 'help', label: '도움말', icon: '?' },
];

/**
 * The command registry mirrors the Figma CommandSuggestionPanel 1:1.
 * Each entry carries a resolved intent so dispatch is a pure lookup in v0;
 * a real intent parser can later produce these same intents from free text.
 */
export const COMMANDS: CommandDef[] = [
  // 1. 변환
  cmd('convert-optimize', 'DotPad에 맞게 최적화', '◑', 'convert', ['최적화', '맞게', 'optimize', 'dotpad'], 'optimize'),
  cmd('convert-outline', '외곽선만 남기기', '◠', 'convert', ['외곽선', '윤곽', 'outline', '선만'], 'outline'),
  cmd('convert-simplify', '더 단순하게', '▁', 'convert', ['단순', '심플', 'simple', '간단'], 'simplify'),
  cmd('convert-sharpen', '더 또렷하게', '◍', 'convert', ['또렷', '선명', '뚜렷', 'sharp'], 'sharpen'),
  cmd('convert-fewer', '점이 너무 많아', '⋯', 'convert', ['점이 많', '너무 많', '점 줄', 'fewer'], 'fewer-dots'),
  cmd('convert-invert', '밝고 어두움 반전', '◐', 'convert', ['반전', '밝고 어두', 'invert', '색 반전'], 'invert'),
  // 2. 도형 만들기
  cmd('create-heart', '하트 그려줘', '♥', 'create', ['하트', 'heart', '하트 그'], 'draw-heart', { shape: 'heart' }),
  cmd('create-circle', '원 그려줘', '○', 'create', ['원', 'circle', '동그라미'], 'draw-circle', { shape: 'circle' }),
  cmd('create-star', '별 그려줘', '★', 'create', ['별', 'star'], 'draw-star', { shape: 'star' }),
  cmd('create-arrow', '화살표 그려줘', '→', 'create', ['화살표', 'arrow'], 'draw-arrow', { shape: 'arrow' }),
  // 3. 라이브러리
  cmd('lib-recent', '최근 촉각그래픽 불러오기', '◷', 'library', ['최근', 'recent', '최근 작업'], 'recent'),
  cmd('lib-mine', '내 라이브러리에서 찾기', '▤', 'library', ['내 라이브러리', 'my library', '내 라'], 'search-mine'),
  cmd('lib-shared', '공유 라이브러리에서 찾기', '⇄', 'library', ['공유 라이브러리', 'shared'], 'search-shared'),
  cmd('lib-public', '공용 라이브러리에서 찾기', '◎', 'library', ['공용 라이브러리', 'public'], 'search-public'),
  // 4. DotPad
  cmd('dotpad-connect', 'DotPad 연결하기', '⌨', 'dotpad', ['연결', 'connect', '디바이스 연결'], 'connect'),
  cmd('dotpad-send', 'DotPad로 보내기', '↗', 'dotpad', ['보내', 'send', '전송', '보내줘'], 'send'),
  cmd('dotpad-reread', '현재 그래픽 다시 읽기', '↺', 'dotpad', ['다시 읽', 're-read', '새로 읽'], 're-read'),
  cmd('dotpad-preview', 'DotPad 미리보기 업데이트', '◉', 'dotpad', ['미리보기 업데이트', 'preview update'], 'preview-update'),
  // 5. 도움말
  cmd('help-shortcuts', '단축키 알려줘', '?', 'help', ['단축키', 'shortcut', '키'], 'shortcuts'),
  cmd('help-fnkeys', '기능키 도움말 열기', '⌘', 'help', ['기능키', '기능 키', 'function key'], 'function-keys'),
  cmd('help-convert', '이미지 변환 방법 안내', '❯', 'help', ['변환 방법', '어떻게 변환', 'how convert'], 'how-to-convert'),
];

function cmd(
  id: string,
  label: string,
  icon: string,
  category: CommandDef['category'],
  keywords: string[],
  action: string,
  args?: Record<string, unknown>,
): CommandDef {
  return { id, label, icon, category, keywords, intent: { type: category, action, label, args } };
}
