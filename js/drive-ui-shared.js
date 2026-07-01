// Shared Tactile Drive UI fragments used by the full library page and
// the in-app "choose from library" picker.

import { CATEGORIES, CAT_BY_ID, READINESS, COMPLEXITY } from './drive-data.js';
import { dotMatrixSvg } from './drive-dot.js';
import { svgIcon } from './icons.js';

export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function badge(tone, iconName, label) {
  const icon = iconName ? svgIcon(iconName) : '';
  return `<span class="badge ${tone}">${icon}${esc(label)}</span>`;
}

export function readinessBadge(level) {
  const r = READINESS[level] || READINESS.good;
  const tone = level === 'good' ? 'good' : level === 'review' ? 'warn' : 'bad';
  const icon = level === 'good' ? 'check' : 'alert';
  return badge(tone, icon, r.label);
}

export function dotPadReadyBadge(resolutionSupport) {
  if (resolutionSupport?.includes('60x40')) return badge('accent', 'plugZap', 'DotPad 60×40 준비 완료');
  if (resolutionSupport?.length) return badge('neutral', 'plug', `DotPad ${resolutionSupport.join(' · ')} 준비 완료`);
  return badge('neutral', 'plug', 'DotPad 준비 대기');
}

export function complexityBadge(level) {
  const tone = level === 'low' ? 'good' : level === 'medium' ? 'warn' : 'bad';
  return badge(tone, 'layers', `복잡도 ${COMPLEXITY[level] || '-'}`);
}

export function readabilityBadge(score) {
  if (score == null) return badge('neutral', 'gauge', '검수 대기');
  const tone = score >= 90 ? 'good' : score >= 78 ? 'warn' : 'bad';
  const label = score >= 90 ? '판독성 좋음' : score >= 78 ? '판독성 보통' : '판독성 낮음';
  return badge(tone, 'gauge', `${label} ${score}%`);
}

export function verifiedStateBadge(a) {
  return a.verified ? badge('verified', 'shieldCheck', '검수 완료') : badge('warn', 'clock', '검수 대기');
}

export function sourceBadge(source) {
  return source === 'Tactile Agent' ? badge('accent', 'sparkle', source) : badge('neutral', null, source);
}

export function primaryCardSignal(a) {
  if (a.verified) return verifiedStateBadge(a);
  if (a.resolutionSupport?.length) return dotPadReadyBadge(a.resolutionSupport);
  return verifiedStateBadge(a);
}

export function categoryTileHtml(categoryId) {
  const c = CAT_BY_ID[categoryId] || CATEGORIES[0];
  return `<div class="card-thumb-icon">${svgIcon(c.icon)}</div>`;
}

export function renderAssetCard(a, options = {}) {
  const mode = options.mode || 'browse';
  const cat = CAT_BY_ID[a.category];
  const titleAction = mode === 'select' ? 'pick-detail' : 'open';
  const primaryAction = mode === 'select' ? 'pick' : 'open';
  const primaryLabel = mode === 'select' ? '선택' : '보기';
  const primaryIcon = mode === 'select' ? 'check' : 'eye';
  const showSave = options.showSave !== false;
  const showAdapt = options.showAdapt !== false;
  const showSend = options.showSend !== false && mode !== 'select';

  return `
  <article class="asset-card">
    <button type="button" class="card-thumb" data-action="${titleAction}" data-id="${a.id}" aria-label="${esc(a.title)} 상세보기">
      ${categoryTileHtml(a.category)}
      <span class="card-dotpreview">${dotMatrixSvg(a.id, '60x40', { cell: 4 })}</span>
      ${a.verified ? `<span class="card-verified">${badge('verified', 'shieldCheck', '검수 완료')}</span>` : ''}
    </button>
    <div class="card-body">
      <div class="card-title-row">
        <button type="button" class="card-title" data-action="${titleAction}" data-id="${a.id}">${esc(a.title)}</button>
        ${showSave ? `<button type="button" class="save-btn" data-action="toggle-save" data-id="${a.id}" aria-pressed="${a.saved}" aria-label="${a.saved ? `${esc(a.title)} 저장 해제` : `${esc(a.title)} 내 라이브러리에 저장`}">
          ${svgIcon(a.saved ? 'bookmarkOn' : 'bookmark')}
        </button>` : ''}
      </div>
      <div class="badge-row">${badge('neutral', null, cat?.ko)}${sourceBadge(a.source)}</div>
      <div class="badge-row">${primaryCardSignal(a)}</div>
      <div class="card-actions">
        <button type="button" class="btn ${mode === 'select' ? 'btn-primary' : 'btn-secondary'} sm" data-action="${primaryAction}" data-id="${a.id}">${svgIcon(primaryIcon)}${primaryLabel}</button>
        <button type="button" class="btn btn-secondary sm icon-only" data-action="${titleAction}" data-id="${a.id}" aria-label="${esc(a.title)} 상세보기">${svgIcon('eye')}</button>
        ${showSend ? `<button type="button" class="btn btn-secondary sm icon-only" data-action="send" data-id="${a.id}" aria-label="${esc(a.title)} DotPad로 보내기">${svgIcon('send')}</button>` : ''}
        ${showAdapt ? `<button type="button" class="btn btn-secondary sm icon-only" data-action="adapt" data-id="${a.id}" aria-label="${esc(a.title)} Tactile Agent로 보정하기">${svgIcon('sparkle')}</button>` : ''}
      </div>
    </div>
  </article>`;
}

export function skeletonCards(n) {
  return Array.from({ length: n }).map(() => `
    <div class="skeleton-card">
      <div class="sk-thumb"></div>
      <div class="sk-body">
        <div class="sk-line" style="width:75%;height:15px"></div>
        <div class="sk-line" style="width:45%"></div>
        <div class="sk-line" style="width:100%;height:26px;margin-top:6px"></div>
      </div>
    </div>`).join('');
}

export function emptyStateHtml() {
  return `
    <div class="empty-state">
      <div class="empty-dots">${dotMatrixSvg('empty-state', '60x40', { cell: 3 })}</div>
      <h3>조건에 맞는 자료가 없어요</h3>
      <p>검색어나 필터를 조정하면 다른 자료를 찾을 수 있어요.</p>
      <button type="button" class="btn btn-primary" data-action="reset-filters">${svgIcon('refresh')}필터 초기화</button>
    </div>`;
}

export function assetGridHtml(list, loading, options = {}) {
  if (loading) return `<div class="asset-grid">${skeletonCards(6)}</div>`;
  if (!list.length) return emptyStateHtml();
  return `<div class="asset-grid">${list.map((a) => renderAssetCard(a, options)).join('')}</div>`;
}

function checkRow(group, value, checked, label) {
  return `<label class="filter-row">
    <input type="checkbox" data-filter-group="${group}" data-filter-value="${esc(value)}" ${checked ? 'checked' : ''}/>
    ${esc(label)}
  </label>`;
}

export function filterPanelHtml(state, resultCount) {
  const f = state.filters;
  const sortOptions = [
    { id: 'recent', label: '최근 추가순' },
    { id: 'used', label: '많이 사용됨' },
  ];
  return `
  <aside class="td-filter" aria-label="필터">
    <div class="filter-card">
      <div class="filter-head">
        <h2>필터</h2>
        <button type="button" class="filter-reset" data-action="reset-filters">초기화</button>
      </div>
      <p class="filter-count">${resultCount}개 결과</p>

      <div class="filter-section">
        <p class="filter-section-title">출처</p>
        ${checkRow('source', 'Tactile World', f.source.has('Tactile World'), 'Tactile World')}
        ${checkRow('source', 'Tactile Agent', f.source.has('Tactile Agent'), 'Tactile Agent')}
        ${checkRow('source', 'Uploaded', f.source.has('Uploaded'), '직접 업로드')}
        ${checkRow('source', 'Verified', f.source.has('Verified'), '검수 완료 자료만')}
        ${checkRow('savedOnly', 'true', f.savedOnly, '내가 저장한 자료만')}
      </div>
      <div class="filter-section">
        <p class="filter-section-title">DotPad 해상도</p>
        ${checkRow('resolution', '60x40', f.resolution.has('60x40'), '60 × 40')}
        ${checkRow('resolution', '96x64', f.resolution.has('96x64'), '96 × 64')}
      </div>
      <div class="filter-section">
        <p class="filter-section-title">형식</p>
        ${['SVG', 'PNG', 'PDF', 'STL', 'DOTPAD'].map((fm) => checkRow('format', fm, f.format.has(fm), fm)).join('')}
        <p class="filter-help">DOTPAD는 점 배열과 해상도 정보를 함께 저장한 즉시 출력용 형식입니다.</p>
      </div>
      <div class="filter-section">
        <p class="filter-section-title">복잡도</p>
        ${Object.entries(COMPLEXITY).map(([k, v]) => checkRow('complexity', k, f.complexity.has(k), v)).join('')}
      </div>
      <div class="filter-section">
        <p class="filter-section-title">정렬</p>
        ${sortOptions.map((s) => `
          <label class="filter-row">
            <input type="radio" name="td-sort" data-filter-group="sort" data-filter-value="${s.id}" ${f.sort === s.id ? 'checked' : ''}/>
            ${esc(s.label)}
          </label>`).join('')}
      </div>
    </div>
  </aside>`;
}

export function categoryChipsHtml(state) {
  const items = [
    { id: 'all', ko: '전체' },
    ...CATEGORIES,
    { id: 'agent', ko: 'Tactile Agent' },
    { id: 'dotpadready', ko: 'DotPad 준비 완료' },
  ];
  return `<div class="chip-row" role="group" aria-label="카테고리 필터">${items.map((c) =>
    `<button type="button" class="cat-chip" data-action="category" data-cat="${c.id}" aria-pressed="${state.category === c.id}">${esc(c.ko)}</button>`
  ).join('')}</div>`;
}
