// Tactile Drive picker modal for the main tactile_agent workspace.
// The picker reuses the Tactile Drive data model and shared UI fragments,
// but trims the flow to "find a resource -> select it for the current work".

import { dotCloud } from './dot-cloud.js';
import { CATEGORIES, CAT_BY_ID, COMPLEXITY, FEATURED, SEED_ASSETS } from './drive-data.js';
import { dotMatrixSvg } from './drive-dot.js';
import { svgIcon } from './icons.js';
import {
  assetGridHtml,
  badge,
  categoryChipsHtml,
  categoryTileHtml,
  complexityBadge,
  dotPadReadyBadge,
  esc,
  filterPanelHtml,
  readabilityBadge,
  readinessBadge,
  sourceBadge,
  verifiedStateBadge,
} from './drive-ui-shared.js';

const SAVED_KEY = 'tactile-drive-picker:saved:v1';
const HISTORY_KEY = 'tactile-drive-picker:history:v1';

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function savedIds() { return new Set(readJson(SAVED_KEY, [])); }
function setSavedIds(ids) { writeJson(SAVED_KEY, [...ids]); }
function pushRecent(asset) {
  const h = readJson(HISTORY_KEY, []);
  writeJson(HISTORY_KEY, [{ id: asset.id, title: asset.title, at: Date.now() }, ...h.filter((x) => x.id !== asset.id)].slice(0, 16));
}

function announce(text) {
  const live = document.getElementById('liveRegion');
  if (!live || !text) return;
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 40);
}

function toast(text, kind = 'ok') {
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = text;
    t.classList.add('show', kind);
    setTimeout(() => t.classList.remove('show', kind), 1800);
  }
  announce(text);
}

function patternHex(cols, rows, seed = 1) {
  const bytes = Math.ceil((cols * rows) / 8);
  let out = '';
  for (let i = 0; i < bytes; i += 1) out += (((i * 37 + seed * 19) % 255) & 0xff).toString(16).padStart(2, '0');
  return out;
}

function dtmsFor(asset) {
  const [cols, rows] = asset.resolutionSupport?.includes('60x40') ? [60, 40] : [96, 64];
  return JSON.stringify({
    title: asset.title,
    resolution: { cols, rows },
    items: [{
      title: asset.title,
      graphic: { data: patternHex(cols, rows, asset.id.length) },
      text: { plain: asset.screenReaderDesc || asset.description },
      meta: {
        source: asset.source,
        category: CAT_BY_ID[asset.category]?.ko || asset.category,
        tactileGuide: asset.tactileGuide,
        landmarks: asset.landmarks,
      },
    }],
  }, null, 2);
}

let _styleInjected = false;
function injectStyles() {
  if (_styleInjected) return;
  _styleInjected = true;
  const s = document.createElement('style');
  s.textContent = `
  .tl-bg{position:fixed;inset:0;background:rgba(28,28,30,.52);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;z-index:410;padding:18px}
  .tl-panel{width:min(1180px,100%);height:min(90vh,820px);background:var(--bg,#F5F5F7);border-radius:20px;box-shadow:0 18px 64px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden;color:var(--ink,#1C1C1E);font-family:var(--font,'Inter','Noto Sans KR',system-ui,-apple-system,sans-serif)}
  .tl-panel *{box-sizing:border-box}.tl-panel button,.tl-panel input{font-family:inherit}.tl-panel svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
  .tl-top{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--border,#E5E5EA);background:rgba(255,255,255,.96)}
  .tl-logo{width:34px;height:34px;border-radius:10px;background:var(--ink,#1C1C1E);display:grid;place-items:center;color:#fff;flex-shrink:0}.tl-logo svg{width:18px;height:18px}
  .tl-title h2{font-size:16px;font-weight:800;line-height:1.2;margin:0}.tl-title p{font-size:12px;color:var(--sub,#6C6C70);margin:2px 0 0}
  .tl-close{margin-left:auto;width:36px;height:36px;border-radius:10px;border:none;background:transparent;color:var(--sub,#6C6C70);display:grid;place-items:center;cursor:pointer}.tl-close:hover{background:var(--surface2,#F2F2F4)}
  .tl-close svg{width:17px;height:17px}.tl-content{min-height:0;flex:1;overflow:auto;padding:20px}.tl-view-tabs{display:flex;gap:8px;margin:0 0 16px;flex-wrap:wrap}
  .tl-mini-tab{height:34px;padding:0 13px;border-radius:999px;border:1px solid var(--border,#E5E5EA);background:var(--surface,#fff);font-size:12.5px;font-weight:700;color:var(--ink,#1C1C1E);cursor:pointer;display:inline-flex;align-items:center;gap:6px}.tl-mini-tab svg{width:14px;height:14px}.tl-mini-tab[aria-pressed=true]{background:var(--accent,#EC5927);border-color:var(--accent,#EC5927);color:#fff}
  .td-hero{background:var(--surface,#fff);border:1px solid var(--border,#E5E5EA);border-radius:20px;padding:28px;margin-bottom:18px}.td-hero h1{margin:0 0 6px;font-size:24px;font-weight:800;letter-spacing:0}.td-hero p{margin:0 0 18px;font-size:14px;color:var(--sub,#6C6C70);max-width:640px}.td-hero .td-search.lg{max-width:540px;margin-bottom:18px}
  .td-search{position:relative;width:100%}.td-search svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:17px;height:17px;color:var(--hint,#AEAEB2);pointer-events:none}.td-search input{width:100%;height:42px;border-radius:16px;border:1px solid var(--border,#E5E5EA);background:var(--surface,#fff);padding:0 14px 0 40px;font-size:13.5px;color:var(--ink,#1C1C1E)}.td-search input:focus{border-color:var(--accent,#EC5927);box-shadow:0 0 0 3px rgba(236,89,39,.12);outline:none}.td-search.lg svg{width:20px;height:20px;left:18px}.td-search.lg input{height:54px;border-radius:20px;padding-left:50px;font-size:15px}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 14px;border-radius:12px;font-size:13.5px;font-weight:600;border:1px solid transparent;cursor:pointer;transition:background .12s,border-color .12s,filter .12s;white-space:nowrap}.btn svg{width:15px;height:15px;flex-shrink:0}.btn.sm{height:32px;padding:0 11px;font-size:12.5px}.btn.sm svg{width:14px;height:14px}.btn.icon-only{width:36px;padding:0}.btn.sm.icon-only{width:32px}.btn-primary{background:var(--accent,#EC5927);color:#fff}.btn-primary:hover{filter:brightness(.95)}.btn-secondary{background:var(--surface,#fff);color:var(--ink,#1C1C1E);border-color:var(--border,#E5E5EA)}.btn-secondary:hover{background:var(--surface2,#F2F2F4)}.btn-ghost{background:transparent;color:var(--ink,#1C1C1E)}.btn-ghost:hover{background:var(--surface2,#F2F2F4)}
  .badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:700;line-height:1;white-space:nowrap}.badge svg{width:11px;height:11px}.badge.neutral{background:var(--surface2,#F2F2F4);color:var(--sub,#6C6C70)}.badge.accent{background:var(--accent-bg,#FDECE4);color:var(--accent-d,#D64A1C)}.badge.good{background:var(--green-bg,#F0FBF3);color:var(--green-d,#25A244)}.badge.warn{background:var(--amber-bg,#FFF8EC);color:var(--amber-d,#B4790A)}.badge.bad{background:var(--red-bg,#FFF2F1);color:var(--red-d,#C23B22)}.badge.verified{background:var(--blue-bg,#EAF3FF);color:var(--blue,#0A84FF)}
  .chip-row{display:flex;flex-wrap:wrap;gap:8px}.cat-chip{height:34px;padding:0 14px;border-radius:999px;border:1px solid var(--border,#E5E5EA);background:var(--surface,#fff);color:var(--ink,#1C1C1E);font-size:12.5px;font-weight:700;cursor:pointer}.cat-chip[aria-pressed=true]{background:var(--accent,#EC5927);color:#fff;border-color:var(--accent,#EC5927)}.featured-row{display:flex;gap:8px;overflow-x:auto;margin:18px 0;padding-bottom:2px}.featured-pill{flex-shrink:0;border:1px solid var(--border,#E5E5EA);background:var(--surface,#fff);color:var(--ink,#1C1C1E);border-radius:12px;padding:9px 14px;font-size:12.5px;font-weight:700;cursor:pointer}.featured-pill[aria-pressed=true]{background:var(--accent,#EC5927);border-color:var(--accent,#EC5927);color:#fff}
  .td-body{display:flex;gap:24px;align-items:flex-start}.td-filter{width:256px;flex-shrink:0}.td-grid{flex:1;min-width:0}.filter-card{background:var(--surface,#fff);border:1px solid var(--border,#E5E5EA);border-radius:16px;padding:16px}.filter-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px}.filter-head h2{font-size:14px;font-weight:800;margin:0}.filter-reset{background:none;border:none;color:var(--accent-d,#D64A1C);font-size:12.5px;font-weight:700;text-decoration:underline;cursor:pointer;padding:2px}.filter-count{font-size:12px;color:var(--sub,#6C6C70);margin:0 0 4px}.filter-section{border-bottom:1px solid var(--border,#E5E5EA);padding:14px 0}.filter-section:first-of-type{padding-top:0}.filter-section:last-of-type{border-bottom:none;padding-bottom:0}.filter-section-title{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:var(--sub,#6C6C70);margin:0 0 8px}.filter-row{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13.5px;cursor:pointer}.filter-row input{accent-color:var(--accent,#EC5927);width:16px;height:16px}.filter-help{margin:8px 0 0;color:var(--sub,#6C6C70);font-size:12px;line-height:1.45}
  .asset-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}.asset-card{background:var(--surface,#fff);border:1px solid var(--border,#E5E5EA);border-radius:16px;overflow:hidden;display:flex;flex-direction:column}.asset-card:focus-within{box-shadow:0 0 0 2px var(--accent,#EC5927)}.card-thumb{position:relative;height:128px;background:var(--surface2,#F2F2F4);border:none;width:100%;padding:0;cursor:pointer;display:block}.card-thumb-icon{width:100%;height:100%;display:flex;align-items:center;justify-content:center}.card-thumb-icon svg{width:32px;height:32px;color:var(--accent-d,#D64A1C)}.card-dotpreview{position:absolute;top:8px;right:8px;width:64px;height:44px;border-radius:8px;overflow:hidden;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}.card-verified{position:absolute;top:8px;left:8px}.card-body{padding:14px;display:flex;flex-direction:column;gap:8px;flex:1}.card-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.card-title{background:none;border:none;padding:0;text-align:left;font-size:14px;font-weight:700;color:var(--ink,#1C1C1E);cursor:pointer;line-height:1.35}.card-title:hover{text-decoration:underline}.save-btn{background:none;border:none;width:30px;height:30px;flex-shrink:0;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--hint,#AEAEB2)}.save-btn svg{width:18px;height:18px}.save-btn[aria-pressed=true]{color:var(--accent-d,#D64A1C)}.badge-row{display:flex;flex-wrap:wrap;gap:6px}.card-actions{display:flex;gap:6px;padding-top:10px;margin-top:auto;border-top:1px solid var(--border,#E5E5EA)}.card-actions .btn:first-child{flex:1}
  .empty-state,.tl-draft-empty{ text-align:center;padding:56px 24px;border:1px solid var(--border,#E5E5EA);border-radius:16px;background:var(--surface,#fff)}.empty-state .empty-dots{width:96px;height:64px;margin:0 auto 16px;border-radius:10px;overflow:hidden;opacity:.7}.empty-state h3,.tl-draft-empty h3{margin:0 0 6px;font-size:15px;font-weight:800}.empty-state p,.tl-draft-empty p{margin:0 0 16px;font-size:13px;color:var(--sub,#6C6C70)}
  .detail-grid{display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start}.detail-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;margin-bottom:14px}.detail-head h1{margin:0 0 8px;font-size:22px;font-weight:800;line-height:1.25}.detail-visual{border:1px solid var(--border,#E5E5EA);border-radius:16px;height:190px;overflow:hidden;margin-bottom:14px;background:var(--surface2,#F2F2F4)}.report-visual-lbl{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;color:var(--sub,#6C6C70);margin:0 0 6px}.detail-tactile{border:1px solid var(--border,#E5E5EA);border-radius:16px;height:190px;overflow:hidden;margin-bottom:16px}.panel-block{border:1px solid var(--border,#E5E5EA);border-radius:16px;padding:16px;background:var(--surface,#fff);margin-bottom:16px}.panel-block h2{font-size:15px;font-weight:800;margin:0 0 12px}.a11y-dl dt{font-weight:700;color:var(--sub,#6C6C70);font-size:12.5px;margin-bottom:2px}.a11y-dl dd{margin:0 0 12px;font-size:13.5px;line-height:1.55}.a11y-dl ul{margin:0;padding-left:18px}.side-col{display:flex;flex-direction:column;gap:16px}.meta-row{display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:13px;border-bottom:1px solid var(--border,#E5E5EA)}.meta-row:last-child{border-bottom:none}.meta-row dt{color:var(--sub,#6C6C70)}.meta-row dd{margin:0;font-weight:700;text-align:right}.action-stack{display:flex;flex-direction:column;gap:8px}.action-stack .btn{width:100%}.review-pending{font-size:13px;color:var(--sub,#6C6C70);font-style:italic;margin:0}
  .tl-draft-list{display:grid;gap:12px}.tl-draft-row{display:flex;align-items:center;gap:12px;background:var(--surface,#fff);border:1px solid var(--border,#E5E5EA);border-radius:16px;padding:12px}.tl-draft-thumb{width:86px;height:58px;border-radius:10px;overflow:hidden;background:var(--surface2,#F2F2F4);flex-shrink:0}.tl-draft-row b{display:block;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tl-draft-row span{font-size:12px;color:var(--sub,#6C6C70)}.tl-draft-row .btn{margin-left:auto}
  .skeleton-card{border:1px solid var(--border,#E5E5EA);border-radius:16px;overflow:hidden;background:var(--surface,#fff);animation:pulse 1.4s ease-in-out infinite}.skeleton-card .sk-thumb{height:128px;background:var(--surface2,#F2F2F4)}.skeleton-card .sk-body{padding:14px;display:flex;flex-direction:column;gap:8px}.skeleton-card .sk-line{height:12px;border-radius:6px;background:var(--surface2,#F2F2F4)}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  @media(max-width:900px){.tl-content{padding:14px}.td-body{flex-direction:column}.td-filter{width:100%;order:2}.td-grid{order:1}.detail-grid{grid-template-columns:1fr}.tl-panel{height:94vh}.td-hero{padding:20px}.tl-draft-row{align-items:flex-start;flex-wrap:wrap}.tl-draft-row .btn{margin-left:0;width:100%}}
  `;
  document.head.appendChild(s);
}

function libraryLogo() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="7" cy="7" r="1.6" fill="#F2ECDF" stroke="none"/><circle cx="12" cy="7" r="1.6" fill="#F2ECDF" stroke="none"/><circle cx="17" cy="7" r="1.6" fill="#F2ECDF" stroke="none"/>
    <circle cx="7" cy="12" r="1.6" fill="#F2ECDF" stroke="none" opacity=".4"/><circle cx="12" cy="12" r="1.6" fill="var(--accent,#EC5927)" stroke="none"/><circle cx="17" cy="12" r="1.6" fill="#F2ECDF" stroke="none" opacity=".4"/>
    <circle cx="7" cy="17" r="1.6" fill="#F2ECDF" stroke="none" opacity=".2"/><circle cx="12" cy="17" r="1.6" fill="#F2ECDF" stroke="none"/><circle cx="17" cy="17" r="1.6" fill="#F2ECDF" stroke="none" opacity=".2"/>
  </svg>`;
}

function metaRow(label, value) {
  if (!value) return '';
  return `<div class="meta-row"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
}

function checklistHtml(a) {
  const items = [
    [a.complexity !== 'high', '명확한 윤곽선'],
    [a.readinessScore !== 'complex', '낮은 시각적 혼잡도'],
    [a.dotPadTested, 'DotPad 출력 테스트 완료'],
    [a.verified, '교사/디자이너 검수 완료'],
  ];
  return `<div class="badge-row">${items.map(([ok, label]) => badge(ok ? 'good' : 'neutral', ok ? 'check' : 'clock', label)).join('')}</div>`;
}

export async function openTactileLibraryUI({ onOpen } = {}) {
  injectStyles();
  const triggerEl = document.activeElement;
  const ids = savedIds();
  const st = {
    assets: SEED_ASSETS.map((a) => ({ ...a, saved: ids.has(a.id) })),
    query: '',
    category: 'all',
    featured: 'all',
    filters: { source: new Set(), resolution: new Set(), format: new Set(), complexity: new Set(), sort: 'recent', savedOnly: false },
    mode: 'drive',
    detailId: '',
    localFiles: [],
    loading: true,
    localLoading: false,
    error: '',
  };

  const bg = document.createElement('div');
  bg.className = 'tl-bg';
  bg.innerHTML = `
    <section class="tl-panel" role="dialog" aria-modal="true" aria-labelledby="tlTitle">
      <div class="tl-top">
        <span class="tl-logo">${libraryLogo()}</span>
        <div class="tl-title">
          <h2 id="tlTitle">텍타일 드라이브 / 자료 선택</h2>
          <p>라이브러리와 같은 카드, 필터, 검수 상태로 자료를 골라 현재 작업으로 가져옵니다.</p>
        </div>
        <button class="tl-close" data-action="close" aria-label="자료 선택 닫기">${svgIcon('x')}</button>
      </div>
      <div class="tl-content" id="tlContent"></div>
    </section>`;
  document.body.appendChild(bg);

  const panel = bg.querySelector('.tl-panel');
  const content = bg.querySelector('#tlContent');
  const close = () => { bg.remove(); triggerEl?.focus?.(); };

  function assetById(id) { return st.assets.find((a) => a.id === id); }

  function getFiltered() {
    let list = st.assets;
    if (st.category === 'agent') list = list.filter((a) => a.source === 'Tactile Agent');
    else if (st.category === 'dotpadready') list = list.filter((a) => a.resolutionSupport.length > 0);
    else if (st.category !== 'all') list = list.filter((a) => a.category === st.category);

    if (st.featured === 'dotpad6040') list = list.filter((a) => a.resolutionSupport.includes('60x40'));
    else if (st.featured === 'teacher') list = list.filter((a) => a.source !== 'Tactile Agent' && ['education', 'math', 'science'].includes(a.category));
    else if (st.featured === 'agent') list = list.filter((a) => a.source === 'Tactile Agent');
    else if (st.featured === 'verified') list = list.filter((a) => a.verified);

    const q = st.query.trim().toLowerCase();
    if (q) {
      list = list.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        a.landmarks.some((l) => l.toLowerCase().includes(q)) ||
        (CAT_BY_ID[a.category]?.ko || '').includes(q)
      );
    }
    const f = st.filters;
    if (f.source.size) list = list.filter((a) => f.source.has(a.source) || (f.source.has('Verified') && a.verified));
    if (f.resolution.size) list = list.filter((a) => a.resolutionSupport.some((r) => f.resolution.has(r)));
    if (f.format.size) list = list.filter((a) => a.formats.some((fm) => f.format.has(fm)));
    if (f.complexity.size) list = list.filter((a) => f.complexity.has(a.complexity));
    if (f.savedOnly) list = list.filter((a) => a.saved);

    list = [...list];
    if (f.sort === 'used') list.sort((a, b) => (b.dotPadTested ? 1 : 0) - (a.dotPadTested ? 1 : 0));
    else list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return list;
  }

  function renderTabs() {
    return `<div class="tl-view-tabs" role="group" aria-label="자료 선택 보기">
      <button type="button" class="tl-mini-tab" data-action="mode" data-mode="drive" aria-pressed="${st.mode === 'drive'}">${svgIcon('bookmark')}라이브러리</button>
      <button type="button" class="tl-mini-tab" data-action="mode" data-mode="drafts" aria-pressed="${st.mode === 'drafts'}">${svgIcon('folder')}Studio 초안</button>
    </div>`;
  }

  function renderDrive() {
    const list = getFiltered();
    content.innerHTML = `
      ${renderTabs()}
      <section class="td-hero">
        <h1>텍타일 드라이브</h1>
        <p>촉각 그래픽, AI 생성 자료, DotPad 학습 자료를 같은 라이브러리 경험 안에서 선택하세요.</p>
        <div class="td-search lg">
          ${svgIcon('search')}
          <input type="search" id="tlSearch" aria-label="텍타일 드라이브 자료 검색" placeholder="지도, 과학 도표, 게임, 학습지, 문화, 수학 검색..." value="${esc(st.query)}"/>
        </div>
        ${categoryChipsHtml(st)}
      </section>
      <div class="featured-row" aria-label="추천 컬렉션">
        ${FEATURED.map((f) => `<button type="button" class="featured-pill" data-action="featured" data-featured="${f.id}" aria-pressed="${st.featured === f.id}">${esc(f.label)}</button>`).join('')}
      </div>
      <div class="td-body">
        ${filterPanelHtml(st, list.length)}
        <div class="td-grid">${assetGridHtml(list, st.loading, { mode: 'select', showAdapt: false })}</div>
      </div>`;
    content.querySelector('#tlSearch')?.addEventListener('input', (e) => { st.query = e.target.value; renderDrive(); });
    if (!st.loading) announce(`검색 결과 ${list.length}개`);
  }

  function renderDetail() {
    const a = assetById(st.detailId);
    if (!a) { st.detailId = ''; renderDrive(); return; }
    const cat = CAT_BY_ID[a.category];
    content.innerHTML = `
      ${renderTabs()}
      <button type="button" class="btn btn-ghost" data-action="back">${svgIcon('arrowLeft')}검색 결과로 돌아가기</button>
      <div class="detail-grid" style="margin-top:14px">
        <div>
          <div class="detail-head">
            <div>
              <h1 tabindex="-1">${esc(a.title)}</h1>
              <div class="badge-row">
                ${badge('neutral', null, cat?.ko)}${sourceBadge(a.source)}
                ${verifiedStateBadge(a)}
                ${readinessBadge(a.readinessScore)}
                ${readabilityBadge(a.tactileReadability)}
              </div>
            </div>
          </div>
          <p class="report-visual-lbl">원본 이미지</p>
          <div class="detail-visual">${categoryTileHtml(a.category)}</div>
          <p class="report-visual-lbl">촉각그래픽 미리보기</p>
          <div class="detail-tactile">${dotMatrixSvg(a.id, '60x40', { cell: 8 })}</div>
          <section class="panel-block" aria-labelledby="tl-report-h">
            <h2 id="tl-report-h">촉각그래픽 검수 리포트</h2>
            <dl class="a11y-dl">
              <dt>간단 설명</dt><dd>${esc(a.description)}</dd>
              <dt>촉각 탐색 순서</dt><dd>${esc(a.tactileGuide)}</dd>
              <dt>주요 랜드마크</dt><dd><ul>${a.landmarks.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></dd>
              <dt>단순화 정도</dt><dd>${esc(a.simplification || '검수 대기')}</dd>
              <dt>선 굵기/간격 체크</dt><dd>${esc(a.lineSpec || '검수 대기')}</dd>
              <dt>스크린리더 설명</dt><dd>${esc(a.screenReaderDesc || a.description)}</dd>
            </dl>
          </section>
        </div>
        <div class="side-col">
          <div class="panel-block action-stack">
            <button type="button" class="btn btn-primary" data-action="pick" data-id="${a.id}">${svgIcon('check')}현재 작업으로 가져오기</button>
            <button type="button" class="btn btn-secondary" data-action="toggle-save" data-id="${a.id}">${svgIcon(a.saved ? 'bookmarkOn' : 'bookmark')}${a.saved ? '저장 해제' : '내 라이브러리에 저장'}</button>
          </div>
          <div class="panel-block">
            <h2>자료 정보</h2>
            <dl>
              ${metaRow('제작자', a.createdBy)}
              ${metaRow('최근 업데이트', a.updatedAt)}
              ${metaRow('권장 사용처', a.recommendedUse)}
              ${metaRow('대상 연령', a.ageLevel)}
              ${metaRow('복잡도', COMPLEXITY[a.complexity])}
              ${metaRow('DotPad 해상도', a.resolutionSupport.join(', '))}
              ${metaRow('파일 형식', a.formats.join(', '))}
              ${metaRow('라이선스', a.license)}
            </dl>
          </div>
          <div class="panel-block">
            <h2>상태</h2>
            <div class="badge-row">${dotPadReadyBadge(a.resolutionSupport)}${complexityBadge(a.complexity)}</div>
            <div style="margin-top:10px">${checklistHtml(a)}</div>
            ${a.reviewer ? `<p style="font-size:12.5px;color:var(--sub,#6C6C70);line-height:1.55;margin:12px 0 0">${esc(a.reviewer.comment)}</p>` : `<p class="review-pending" style="margin-top:12px">검수자 코멘트 대기</p>`}
          </div>
        </div>
      </div>`;
    content.querySelector('h1[tabindex="-1"]')?.focus?.();
  }

  function renderDrafts() {
    content.innerHTML = `
      ${renderTabs()}
      ${st.localLoading ? `<div class="tl-draft-empty"><h3>Studio 초안을 불러오는 중...</h3><p>잠시만 기다려 주세요.</p></div>` :
        st.error ? `<div class="tl-draft-empty"><h3>초안을 불러오지 못했어요</h3><p>${esc(st.error)}</p><button class="btn btn-primary" data-action="reload-drafts">${svgIcon('refresh')}다시 시도</button></div>` :
        st.localFiles.length ? `<div class="tl-draft-list">${st.localFiles.map((f) => `<div class="tl-draft-row">
          <div class="tl-draft-thumb">${f.thumb ? `<img src="${esc(f.thumb)}" alt="" style="width:100%;height:100%;object-fit:contain">` : dotMatrixSvg(f.name || 'draft', '60x40', { cell: 4 })}</div>
          <div style="min-width:0;flex:1"><b>${esc(f.name)}</b><span>${f.width ? `${f.width} x ${f.height}` : 'DTMS'} · 브라우저에 저장된 초안</span></div>
          <button class="btn btn-primary" data-action="open-local" data-no="${esc(f.no)}" data-name="${esc(f.name)}">${svgIcon('check')}가져오기</button>
        </div>`).join('')}</div>` :
        `<div class="tl-draft-empty"><h3>저장된 Studio 초안이 없어요</h3><p>현재 작업에서 라이브러리에 저장한 뒤 다시 열면 여기에 표시됩니다.</p></div>`}`;
  }

  function render() {
    if (st.mode === 'drafts') renderDrafts();
    else if (st.detailId) renderDetail();
    else renderDrive();
  }

  async function loadLocalFiles() {
    st.localLoading = true; st.error = '';
    if (st.mode === 'drafts') renderDrafts();
    try {
      const res = await dotCloud.list({ driverKind: 'P', parentGroupNo: 'ROOT', pageNo: 1, query: '' });
      st.localFiles = (res.items || []).filter((x) => x.type === 'file');
    } catch {
      st.error = '로컬 라이브러리 저장소에 접근할 수 없습니다.';
    } finally {
      st.localLoading = false;
      if (st.mode === 'drafts') renderDrafts();
    }
  }

  function toggleSave(id) {
    const a = assetById(id);
    if (!a) return;
    a.saved = !a.saved;
    const next = savedIds();
    a.saved ? next.add(id) : next.delete(id);
    setSavedIds(next);
    toast(a.saved ? '내 라이브러리에 저장했어요' : '저장을 해제했어요');
    render();
  }

  function pickAsset(id) {
    const a = assetById(id);
    if (!a || !onOpen) return;
    pushRecent(a);
    close();
    onOpen(dtmsFor(a), `${a.id}.dtms`);
  }

  bg.addEventListener('click', async (e) => {
    if (e.target === bg) { close(); return; }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'close') { close(); return; }
    if (action === 'mode') { st.mode = el.dataset.mode; st.detailId = ''; render(); if (st.mode === 'drafts' && !st.localFiles.length) loadLocalFiles(); return; }
    if (action === 'pick') { pickAsset(el.dataset.id); return; }
    if (action === 'pick-detail') { st.detailId = el.dataset.id; renderDetail(); return; }
    if (action === 'back') { st.detailId = ''; renderDrive(); return; }
    if (action === 'toggle-save') { toggleSave(el.dataset.id); return; }
    if (action === 'category') { st.category = el.dataset.cat; st.detailId = ''; renderDrive(); return; }
    if (action === 'featured') { st.featured = st.featured === el.dataset.featured ? 'all' : el.dataset.featured; if (st.featured === 'recent') st.filters.sort = 'recent'; renderDrive(); return; }
    if (action === 'reset-filters') {
      st.filters = { source: new Set(), resolution: new Set(), format: new Set(), complexity: new Set(), sort: 'recent', savedOnly: false };
      st.category = 'all'; st.featured = 'all'; st.query = ''; renderDrive(); return;
    }
    if (action === 'reload-drafts') { loadLocalFiles(); return; }
    if (action === 'open-local') {
      const dtms = await dotCloud.load({ driverKind: 'P', fileNo: el.dataset.no });
      if (dtms != null && onOpen) { close(); onOpen(dtms, el.dataset.name || 'library-item.dtms'); }
    }
  });

  bg.addEventListener('change', (e) => {
    const el = e.target.closest('[data-filter-group]');
    if (!el) return;
    const group = el.dataset.filterGroup, value = el.dataset.filterValue;
    if (group === 'sort') { st.filters.sort = value; renderDrive(); return; }
    if (group === 'savedOnly') { st.filters.savedOnly = el.checked; renderDrive(); return; }
    const set = st.filters[group];
    if (!set) return;
    el.checked ? set.add(value) : set.delete(value);
    renderDrive();
  });

  bg.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll('button,input,select,[tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  render();
  loadLocalFiles();
  setTimeout(() => { st.loading = false; render(); bg.querySelector('.tl-close')?.focus(); }, 450);
}
