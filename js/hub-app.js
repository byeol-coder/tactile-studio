// ── Tactile World Hub (landing page) ────────────────────────────
import { t } from './i18n.js';
import { dotCloud } from './dot-cloud.js';

const ge = id => document.getElementById(id);
const qsa = s => [...document.querySelectorAll(s)];

const LANG_KEY = 'ta_lang';
let lang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ko';

const CHIPS = [
  { key: 'hub_chip_image',    d: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 16l5-5 4 4 3-3 4 4M15 9h.01' },
  { key: 'hub_chip_command',  d: 'M4 5h16v14H4zM8 9l3 3-3 3M13 15h4' },
  { key: 'hub_chip_template', d: 'M4 5a1 1 0 0 1 1-1h6v16H5a1 1 0 0 1-1-1zM13 4h6a1 1 0 0 1 1 1v6h-7zM13 13h7v6a1 1 0 0 1-1 1h-6z' },
  { key: 'hub_chip_dotpad',   d: 'M10 14L21 3M21 3l-6.5 18a.5.5 0 0 1-1 0L10 14l-7-3.5a.5.5 0 0 1 0-1z' },
  { key: 'hub_chip_emboss',   d: 'M7 3h10v6H7zM5 9h14a1 1 0 0 1 1 1v7h-4v4H8v-4H4v-7a1 1 0 0 1 1-1zM8 17h8' },
];

function applyI18n() {
  document.documentElement.lang = lang;
  qsa('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n, lang); });
  qsa('[data-i18n-attr]').forEach(el => {
    el.dataset.i18nAttr.split(',').forEach(pair => {
      const [attr, key] = pair.split(':').map(s => s.trim());
      if (attr && key) el.setAttribute(attr, t(key, lang));
    });
  });
  qsa('#langGroup button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}

function renderChips() {
  ge('chipRow').innerHTML = CHIPS.map(c => `
    <span class="chip">
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="${c.d}" fill="none" stroke="#EC5927" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
      ${t(c.key, lang)}
    </span>`).join('');
}

function relTime(ms) {
  const diff = Date.now() - ms, day = 86400000;
  if (diff < 3600000) return lang === 'ko' ? '방금 전' : 'just now';
  if (diff < day) return lang === 'ko' ? `${Math.floor(diff / 3600000)}시간 전` : `${Math.floor(diff / 3600000)}h ago`;
  const days = Math.floor(diff / day);
  return lang === 'ko' ? `${days}일 전` : `${days}d ago`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer = null;
function toast(msg) {
  const el = ge('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function cardHtml(file) {
  const grid = file.width && file.height ? `${file.width}×${file.height}` : '—';
  const thumb = file.thumb || '';
  return `
    <div class="card">
      <button type="button" class="card-thumb" data-action="edit" data-id="${file.no}">
        <span class="badge-drive"><span class="dot"></span>${t('hub_recent_pill', lang)}</span>
        <span class="badge-type">${(file.ext || 'dtms').toUpperCase()}</span>
        ${thumb ? `<img src="${thumb}" alt="">` : `<div style="width:100%;height:120px;border-radius:8px;background:#fff;border:1px solid var(--border-soft)"></div>`}
      </button>
      <div class="card-body">
        <div>
          <div class="card-name">${escapeHtml(file.name)}</div>
          <div class="card-meta">${grid} · ${relTime(file.modDate || Date.now())}</div>
        </div>
        <span class="card-status">
          <svg width="12" height="12" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
          ${t('hub_status_saved', lang)}
        </span>
        <div class="card-actions">
          <button type="button" class="btn-edit" data-action="edit" data-id="${file.no}">
            <svg width="14" height="14" viewBox="0 0 24 24"><path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            ${t('hub_edit', lang)}
          </button>
          <button type="button" class="btn-send" data-action="send" data-id="${file.no}">
            <svg width="14" height="14" viewBox="0 0 24 24"><path d="M10 14L21 3M21 3l-6.5 18a.5.5 0 0 1-1 0L10 14l-7-3.5a.5.5 0 0 1 0-1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            DotPad
          </button>
        </div>
      </div>
    </div>`;
}

const importTileHtml = () => `
  <button type="button" class="import-tile" id="importTile">
    <span class="ico">
      <svg width="24" height="24" viewBox="0 0 24 24"><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 16l5-5 4 4 3-3 4 4M15 9h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    </span>
    <span class="t1">${t('hub_import_title', lang)}</span>
    <span class="t2">${t('hub_import_sub', lang)}</span>
  </button>`;

let recentFiles = [];

async function loadRecent() {
  try {
    const res = await dotCloud.list({ driverKind: 'P', parentGroupNo: 'ROOT' });
    recentFiles = (res.items || []).filter(i => i.type === 'file').slice(0, 3);
  } catch {
    recentFiles = [];
  }
  renderCards();
}

function renderCards() {
  const grid = ge('cardGrid');
  const cards = recentFiles.map(cardHtml).join('');
  const empty = recentFiles.length === 0 ? `
    <div class="empty-state">
      <div class="t1">${t('hub_empty_title', lang)}</div>
      <div class="t2">${t('hub_empty_sub', lang)}</div>
    </div>` : '';
  grid.innerHTML = cards + empty + importTileHtml();
  ge('importTile')?.addEventListener('click', () => { window.location.href = 'index.html'; });
}

function drawHero() {
  const c = ge('heroCanvas');
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth || 220, h = c.clientHeight || 150;
  c.width = w * dpr; c.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  // Decorative radiating tactile dot pattern — not tied to real document data.
  const cols = 22, rows = 15, gap = w / cols;
  const cx = cols / 2, cy = rows / 2, maxR = Math.min(cols, rows) / 2;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const ring = Math.abs(d - maxR * 0.55);
      if (ring < 0.6 || d < maxR * 0.18) {
        ctx.beginPath();
        ctx.arc(x * gap + gap / 2, y * gap + gap / 2, gap * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(236,89,39,0.85)';
        ctx.fill();
      }
    }
  }
}

function onGridClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'edit') {
    window.location.href = 'index.html';
  } else if (action === 'send') {
    toast(t('hub_toast_send_ok', lang));
  }
}

function initLangToggle() {
  ge('langGroup').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-lang]');
    if (!btn) return;
    lang = btn.dataset.lang;
    localStorage.setItem(LANG_KEY, lang);
    applyI18n();
    renderChips();
    renderCards();
  });
}

function init() {
  applyI18n();
  renderChips();
  drawHero();
  initLangToggle();
  ge('cardGrid').addEventListener('click', onGridClick);
  loadRecent();
  window.addEventListener('resize', drawHero);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
