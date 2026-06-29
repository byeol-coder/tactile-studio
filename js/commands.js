// ── Command Interpreter ───────────────────────────────────────
// Natural-language → structured conversion intent.
// Pure: takes (text, lang) and returns an intent object.
// app.js applies the intent to conversionState and reports `reply`.
//
// Intent shape:
//   {
//     patch:    { ...conversionState fields to merge },   // optional
//     optimize: false,                                     // run optimizeForDotPad
//     action:   null | 'send' | 'braille' | 'clear' | 'invert' | 'reset',
//     reply:    'human-readable summary (current lang)',
//     matched:  true,                                      // did anything match?
//   }

const R = (ko, en) => ({ ko, en });

// Each rule: { test, patch?, optimize?, action?, reply }
// `reply` is {ko, en}. Rules are evaluated in order; later patches win on conflict.
const RULES = [
  {
    test: /최적화|optimi[sz]e|읽기\s*쉽게|가독|readable|dotpad에?\s*맞게|핀에?\s*맞게|tactile|촉각.*최적/i,
    optimize: true,
    reply: R('Dot Pad 가독성에 맞춰 자동 최적화했어요', 'Optimized for Dot Pad readability'),
  },
  {
    test: /단순|간단|심플|simpl/i,
    patch: { outline: 1, minComp: 4, denoise: true, edge: 'none' },
    reply: R('윤곽선 중심으로 단순하게 변환했어요', 'Simplified to outline-focused form'),
  },
  {
    test: /또렷|선명|디테일|자세|detail|sharp|crisp/i,
    patch: { minComp: 1, outline: 0, denoise: false },
    reply: R('디테일을 살려 또렷하게 변환했어요', 'Brought back detail and crispness'),
  },
  {
    test: /외곽|윤곽|테두리|라인|outline|edge\s*only|contour/i,
    patch: { outline: 1, edge: 'none' },
    reply: R('외곽선만 남겼어요', 'Kept the outline only'),
  },
  {
    test: /두\s*줄|2\s*줄|굵은\s*외곽|double\s*outline/i,
    patch: { outline: 2 },
    reply: R('외곽선을 2줄로 두껍게 했어요', 'Made the outline a 2-line border'),
  },
  {
    test: /채워|채우|면으로|솔리드|fill|solid|filled/i,
    patch: { outline: 0 },
    reply: R('면을 채워서 변환했어요', 'Filled the shapes'),
  },
  {
    test: /굵게|두껍게|진하게|bold|thick|dilat/i,
    patch: { dilate: true, erode: false },
    reply: R('점을 굵게 키웠어요', 'Thickened the strokes'),
  },
  {
    test: /가늘게|얇게|얇은|thin|erode|skeleton/i,
    patch: { erode: true, dilate: false },
    reply: R('점을 가늘게 줄였어요', 'Thinned the strokes'),
  },
  {
    test: /노이즈|잡티|점\s*제거|깨끗|정리|denoise|clean|noise/i,
    patch: { denoise: true, minComp: 4 },
    reply: R('흩어진 점을 정리했어요', 'Cleaned up scattered dots'),
  },
  {
    test: /점\s*(많|늘|높|진)|더\s*많|밀도\s*(높|올)|more\s*dots|dense|denser/i,
    patch: { method: 'global' },
    deltaThreshold: +24,
    reply: R('점 밀도를 높였어요', 'Increased dot density'),
  },
  {
    test: /점\s*(적|줄|낮|연)|더\s*적|밀도\s*(낮|내)|fewer\s*dots|sparse|lighter/i,
    patch: { method: 'global' },
    deltaThreshold: -24,
    reply: R('점 밀도를 낮췄어요', 'Reduced dot density'),
  },
  {
    test: /엣지|에지|sobel|경계\s*감지|edge\s*detect/i,
    patch: { edge: 'sobel', outline: 0 },
    reply: R('Sobel 엣지로 경계를 추출했어요', 'Extracted edges with Sobel'),
  },
  {
    test: /반전|뒤집|invert|negative|flip\s*pin/i,
    action: 'invert',
    reply: R('밝고 어두운 영역을 반전했어요', 'Inverted light and dark areas'),
  },
  {
    test: /점자|브라유|braille/i,
    action: 'braille',
    reply: R('점자 설명을 Dot Pad로 보냈어요', 'Sent the braille description to Dot Pad'),
  },
  {
    test: /보내|전송|출력|send|전달|export\s*to\s*dot/i,
    action: 'send',
    reply: R('Dot Pad로 보냈어요', 'Sent to Dot Pad'),
  },
  {
    test: /전체\s*지|모두\s*지|초기화|클리어|clear\s*all|reset\s*canvas/i,
    action: 'clear',
    reply: R('캔버스를 전부 지웠어요', 'Cleared the whole canvas'),
  },
  {
    test: /처음|원래|되돌|기본값|reset|original|revert/i,
    action: 'reset',
    reply: R('자동 변환 상태로 되돌렸어요', 'Reverted to the auto-converted state'),
  },
];

/**
 * Interpret a natural-language command.
 * @param {string} text
 * @param {'ko'|'en'} lang
 * @returns {{patch:object, deltaThreshold:number, optimize:boolean, action:?string, reply:string, matched:boolean}}
 */
export function interpretCommand(text, lang = 'ko') {
  const s = (text || '').trim();
  const patch = {};
  let deltaThreshold = 0;
  let optimize = false;
  let action = null;
  const replies = [];
  let matched = false;

  for (const rule of RULES) {
    if (!rule.test.test(s)) continue;
    matched = true;
    if (rule.patch) Object.assign(patch, rule.patch);
    if (rule.deltaThreshold) deltaThreshold += rule.deltaThreshold;
    if (rule.optimize) optimize = true;
    if (rule.action) action = rule.action;   // last action wins
    replies.push(rule.reply[lang] || rule.reply.ko);
  }

  // optimize wins over manual patches — it computes its own params.
  if (optimize) { Object.keys(patch).forEach(k => delete patch[k]); deltaThreshold = 0; }

  const reply = matched
    ? replies.join(' · ')
    : (lang === 'ko'
        ? '명령을 이해하지 못했어요. "단순하게", "외곽선만", "최적화" 같은 표현을 써보세요.'
        : "Didn't catch that. Try \"simplify\", \"outline only\", or \"optimize\".");

  return { patch, deltaThreshold, optimize, action, reply, matched };
}

/**
 * Curated quick commands for the prompt suggestion dropdown.
 * `text` is fed straight back into interpretCommand.
 */
export const QUICK_COMMANDS = [
  { icon: '✨', text: { ko: 'Dot Pad에 맞게 최적화', en: 'Optimize for Dot Pad' }, primary: true },
  { icon: '◯', text: { ko: '외곽선만 남기기',       en: 'Outline only' } },
  { icon: '▢', text: { ko: '더 단순하게',           en: 'Simplify' } },
  { icon: '◆', text: { ko: '디테일 살리기',         en: 'More detail' } },
  { icon: '⬤', text: { ko: '점 굵게',               en: 'Thicker dots' } },
  { icon: '⊙', text: { ko: '노이즈 정리',           en: 'Clean up noise' } },
  { icon: '⇄', text: { ko: '밝고 어두움 반전',      en: 'Invert' } },
];
