/**
 * CloudDriveModal.jsx — tactile_agent Design System
 *
 * Tone & Manner Tokens:
 *   Background (sand)   #F5EFE4
 *   Container (white)   #FFFFFF
 *   Near-black          #1A1A1A  → heavy buttons, titles
 *   Accent (orange)     #FF5500  → active tabs, selected borders, FAB
 *   Muted               #666666  → body copy, metadata
 *   Modal radius        rounded-[24px]
 *   Card/Button radius  rounded-xl  (12 px)
 *   Selected outline    2 px solid #FF5500  (via box-shadow — no layout shift)
 *   Icons               Lucide React  strokeWidth=2  (flat line only, no emoji)
 *   Hover               transition-all duration-200
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Search,
  Grid3X3,
  List,
  FolderClosed,
  File,
  FileText,
  X,
  ChevronRight,
  Plus,
  UploadCloud,
} from 'lucide-react';

// ── Shared constants ───────────────────────────────────────────────────────────
const SAND   = '#F5EFE4';
const DARK   = '#1A1A1A';
const ACCENT = '#FF5500';
const MUTED  = '#666666';

// Box-shadow rings — avoids any box-model layout shift on toggle
const RING_DEFAULT  = '0 0 0 1px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.06)';
const RING_HOVER    = '0 0 0 1px rgba(0,0,0,0.12), 0 4px 14px rgba(0,0,0,0.10)';
const RING_SELECTED = `0 0 0 2px ${ACCENT}, 0 6px 20px rgba(255,85,0,0.14)`;

// ── Sample data ────────────────────────────────────────────────────────────────
const INITIAL_FILES = [
  {
    id: 1,
    type: 'folder',
    name: '점자 도형 모음',
    count: 12,
    date: '2024. 6. 1',
  },
  {
    id: 2,
    type: 'file',
    name: '기린_60x40.dtms',
    tags: ['60×40', 'animal'],
    date: '2024. 5. 28',
    size: '4.2 KB',
  },
  {
    id: 3,
    type: 'file',
    name: '한글_자음_모음.dtms',
    tags: ['96×64', 'korean'],
    date: '2024. 5. 22',
    size: '8.1 KB',
  },
  {
    id: 4,
    type: 'file',
    name: '세계지도_단순.dtms',
    tags: ['60×40', 'map'],
    date: '2024. 5. 18',
    size: '5.7 KB',
  },
  {
    id: 5,
    type: 'file',
    name: '심장_구조도.dtms',
    tags: ['96×64', 'biology'],
    date: '2024. 5. 10',
    size: '6.3 KB',
  },
  {
    id: 6,
    type: 'file',
    name: '피아노_건반.dtms',
    tags: ['60×40', 'music'],
    date: '2024. 4. 30',
    size: '3.8 KB',
  },
  {
    id: 7,
    type: 'file',
    name: '수학_함수_그래프.dtms',
    tags: ['96×64', 'math'],
    date: '2024. 4. 15',
    size: '7.2 KB',
  },
];

// ── FileCard — Grid view ───────────────────────────────────────────────────────
//
// Layout bug fixes applied:
//   [x] overflow-hidden → inner preview conforms to card radius (no white gap)
//   [x] aspect-[4/3]   → uniform preview height; no distortion on content change
//   [x] box-shadow ring → selected 2px orange outline with zero layout shift
//   [x] w-px divider   → single clean line; no double-border from border-r
//   [x] truncate        → long filenames ellipsis, never wrap
//   [x] space-y-1.5     → strict 6px vertical rhythm in metadata area
//   [x] identical tag pill size → px-2 py-0.5 rounded-md on every tag
function FileCard({ file, selected, onSelect, onOpen, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const isFolder = file.type === 'folder';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={selected}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative bg-white rounded-xl overflow-hidden cursor-pointer select-none transition-all duration-200"
      style={{
        boxShadow: selected
          ? RING_SELECTED
          : hovered
          ? RING_HOVER
          : RING_DEFAULT,
      }}
    >
      {/* ── Preview area ──────────────────────────────────────────────────
          aspect-[4/3] → locked height ratio; overflow-hidden on wrapper
          ensures this div's square corners get clipped to rounded-xl.
          Background reuses SAND so folders feel "part of" the app canvas.
      */}
      <div
        className="aspect-[4/3] flex flex-col items-center justify-center gap-2"
        style={{ background: SAND }}
      >
        {isFolder ? (
          <FolderClosed
            size={36}
            strokeWidth={2}
            style={{ color: ACCENT }}
          />
        ) : (
          <>
            <File size={30} strokeWidth={2} className="text-slate-300" />
            <span
              className="text-[10px] font-bold font-mono tracking-widest uppercase"
              style={{ color: MUTED }}
            >
              .dtms
            </span>
          </>
        )}
      </div>

      {/* ── Metadata ─────────────────────────────────────────────────────
          space-y-1.5 → 6px between every row; truncate on name.
      */}
      <div className="px-4 pt-3 pb-2 space-y-1.5">
        <p
          className="text-sm font-semibold truncate leading-snug"
          style={{ color: DARK }}
          title={file.name}
        >
          {file.name}
        </p>

        {/* Tag pills — uniform px-2 py-0.5 rounded-md */}
        {file.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {file.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center text-[11px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md leading-none"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {file.count !== undefined && (
          <p className="text-xs font-medium" style={{ color: MUTED }}>
            {file.count}개 파일
          </p>
        )}

        <p
          className="text-[11px] tabular-nums"
          style={{ color: MUTED }}
        >
          {file.date}
        </p>
      </div>

      {/* ── Action row ────────────────────────────────────────────────────
          FIX: No border-r on left button.
          A single <div w-px self-stretch> is the only divider.
          → Prevents the 2px double-border (card edge + button edge).
      */}
      <div className="flex border-t border-slate-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.();
          }}
          className="flex-1 py-2.5 text-sm font-semibold transition-all duration-200 hover:bg-slate-50 active:bg-slate-100"
          style={{ color: DARK }}
        >
          열기
        </button>

        {/* Single vertical divider — replaces any border-r / border-l */}
        <div className="w-px self-stretch bg-slate-100" aria-hidden="true" />

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          className="flex-1 py-2.5 text-sm font-semibold text-rose-500 transition-all duration-200 hover:bg-rose-50 active:bg-rose-100"
        >
          삭제
        </button>
      </div>
    </div>
  );
}

// ── FileRow — List view ────────────────────────────────────────────────────────
function FileRow({ file, selected, onSelect, onOpen, onDelete }) {
  const isFolder = file.type === 'folder';

  return (
    <div
      role="row"
      aria-selected={selected}
      onClick={onSelect}
      className="flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-all duration-200"
      style={{
        background: selected ? 'rgba(255,85,0,0.05)' : undefined,
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = '';
      }}
    >
      {/* File type icon container */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: isFolder ? 'rgba(255,85,0,0.10)' : SAND,
        }}
      >
        {isFolder ? (
          <FolderClosed size={17} strokeWidth={2} style={{ color: ACCENT }} />
        ) : (
          <File size={17} strokeWidth={2} className="text-slate-400" />
        )}
      </div>

      {/* Name + date */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold truncate leading-snug"
          style={{ color: DARK }}
        >
          {file.name}
        </p>
        <p
          className="text-xs mt-0.5 tabular-nums"
          style={{ color: MUTED }}
        >
          {file.date}
        </p>
      </div>

      {/* Tags */}
      {file.tags?.length > 0 && (
        <div className="flex gap-1.5 flex-shrink-0">
          {file.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-[11px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Row actions */}
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.();
          }}
          className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg transition-all duration-200 hover:bg-slate-50 hover:border-slate-300"
          style={{ color: DARK }}
        >
          열기
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-rose-500 transition-all duration-200 hover:bg-rose-50 hover:border-rose-200"
        >
          삭제
        </button>
      </div>

      {/* Active indicator pip */}
      {selected && (
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: ACCENT }}
        />
      )}
    </div>
  );
}

// ── UploadZone ─────────────────────────────────────────────────────────────────
//
// Bug fix: useRef + .click() on hidden <input> elements.
// Both image and .dtms inputs are separate refs with separate accept values.
// Drag-and-drop routes files by MIME type or extension.
function UploadZone({ onImageFile, onDtmsFile }) {
  const imgRef  = useRef(null);
  const dtmsRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Drag handlers — prevent default to allow custom drop handling
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    // Only reset when the pointer truly leaves the container (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      Array.from(e.dataTransfer.files).forEach((file) => {
        if (file.type.startsWith('image/')) {
          onImageFile?.(file);
        } else if (
          file.name.endsWith('.dtms') ||
          file.name.endsWith('.dtm') ||
          file.name.endsWith('.json')
        ) {
          onDtmsFile?.(file);
        }
      });
    },
    [onImageFile, onDtmsFile]
  );

  return (
    <div
      className="flex-shrink-0 border-t border-slate-200/60 px-6 pt-4 pb-6 transition-all duration-200"
      style={{ background: isDragActive ? 'rgba(255,85,0,0.04)' : SAND }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop hint bar */}
      <div
        className="rounded-xl border-2 border-dashed px-4 py-2.5 text-center mb-4 transition-all duration-200"
        style={{
          borderColor: isDragActive ? ACCENT : 'rgba(0,0,0,0.15)',
          background: isDragActive ? 'rgba(255,85,0,0.06)' : 'rgba(255,255,255,0.5)',
        }}
      >
        <p
          className="text-xs font-medium"
          style={{ color: isDragActive ? ACCENT : MUTED }}
        >
          {isDragActive ? '여기에 파일을 드롭하세요' : '클릭하거나 파일을 드래그하세요'}
        </p>
      </div>

      {/* Hidden native file inputs ── separate refs, separate accept */}
      <input
        ref={imgRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImageFile?.(f);
          e.target.value = ''; // reset so same file can be re-selected
        }}
      />
      <input
        ref={dtmsRef}
        type="file"
        accept=".dtms,.dtm,.json"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onDtmsFile?.(f);
          e.target.value = '';
        }}
      />

      {/* Action buttons */}
      <div className="flex gap-3">
        {/* Primary — near-black dark button → opens image picker */}
        <button
          type="button"
          onClick={() => imgRef.current?.click()}
          className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:opacity-80"
          style={{ background: DARK }}
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          이미지 가져오기
        </button>

        {/* Secondary — white button → opens .dtms picker */}
        <button
          type="button"
          onClick={() => dtmsRef.current?.click()}
          className="flex-1 inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold bg-white border border-slate-200 transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100"
          style={{ color: DARK }}
        >
          <FileText size={15} strokeWidth={2} aria-hidden="true" />
          .dtms 파일 열기
        </button>
      </div>
    </div>
  );
}

// ── CloudDriveModal — main export ──────────────────────────────────────────────
export default function CloudDriveModal({
  onClose,
  onOpenFile,
  onImageFile,
  onDtmsFile,
}) {
  const [files,       setFiles]       = useState(INITIAL_FILES);
  const [selected,    setSelected]    = useState(null);
  const [viewMode,    setViewMode]    = useState('grid'); // 'grid' | 'list'
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = searchQuery.trim()
    ? files.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : files;

  const handleDelete = useCallback((id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setSelected((prev) => (prev === id ? null : prev));
  }, []);

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => (prev === id ? null : id));
  }, []);

  return (
    /* ── Backdrop ─── click outside → close */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      style={{ background: 'rgba(26,26,26,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      {/* ── Modal shell ─── white, 24px radius */}
      <div
        className="bg-white w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ borderRadius: 24, maxHeight: '88vh' }}
        role="dialog"
        aria-modal="true"
        aria-label="내 드라이브"
      >

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
          <h2
            className="text-[15px] font-bold tracking-tight"
            style={{ color: DARK }}
          >
            내 드라이브
          </h2>
          <button
            onClick={onClose}
            aria-label="모달 닫기"
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 hover:bg-slate-100"
            style={{ color: MUTED }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* ── Toolbar ─────────────────────────────────────────────────────
            All children share the same items-center flex baseline.
            Search uses h-9 for vertical centering with icon positioned
            absolute left-3 at 50% translateY — guaranteed same baseline.
        */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100 flex-shrink-0">

          {/* Breadcrumb */}
          <button
            className="inline-flex items-center gap-1 text-sm font-semibold transition-all duration-200 flex-shrink-0"
            style={{ color: MUTED }}
            onMouseEnter={(e) => (e.currentTarget.style.color = ACCENT)}
            onMouseLeave={(e) => (e.currentTarget.style.color = MUTED)}
          >
            <ChevronRight
              size={14}
              strokeWidth={2}
              className="-rotate-180"
              aria-hidden="true"
            />
            <span>내 드라이브</span>
          </button>

          <div className="flex-1" />

          {/* Search input — icon absolutely within relative container */}
          <div className="relative flex items-center flex-shrink-0">
            <Search
              size={14}
              strokeWidth={2}
              className="absolute left-3 pointer-events-none"
              style={{ color: MUTED }}
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="파일 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 pr-4 text-sm rounded-xl border border-slate-200 w-44 transition-all duration-200 placeholder:font-medium focus:outline-none"
              style={{
                background: SAND,
                color: DARK,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = ACCENT;
                e.target.style.boxShadow = `0 0 0 3px rgba(255,85,0,0.12)`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '';
                e.target.style.boxShadow = '';
              }}
            />
          </div>

          {/* View mode toggle — orange active state */}
          <div
            className="flex items-center rounded-xl border border-slate-200 overflow-hidden flex-shrink-0"
            role="group"
            aria-label="보기 모드"
          >
            {[
              { mode: 'grid', Icon: Grid3X3, label: '그리드 보기' },
              { mode: 'list', Icon: List,    label: '목록 보기'  },
            ].map(({ mode, Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                aria-label={label}
                aria-pressed={viewMode === mode}
                className="h-9 w-9 flex items-center justify-center transition-all duration-200"
                style={{
                  background: viewMode === mode ? ACCENT : 'white',
                  color:      viewMode === mode ? 'white' : MUTED,
                }}
              >
                <Icon size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        {/* ── File content area ────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto p-6"
          style={{ background: SAND }}
        >
          {filtered.length === 0 ? (
            /* Empty state */
            <div className="h-40 flex flex-col items-center justify-center gap-2.5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.06)' }}
              >
                <File size={22} strokeWidth={1.5} style={{ color: MUTED }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: MUTED }}>
                파일을 찾을 수 없어요
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs font-semibold transition-all duration-200 hover:opacity-70"
                  style={{ color: ACCENT }}
                >
                  검색 초기화
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid view — 3 columns */
            <div className="grid grid-cols-3 gap-4">
              {filtered.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  selected={selected === file.id}
                  onSelect={() => toggleSelect(file.id)}
                  onOpen={() => onOpenFile?.(file)}
                  onDelete={() => handleDelete(file.id)}
                />
              ))}
            </div>
          ) : (
            /* List view — divided rows in white card */
            <div
              className="bg-white rounded-2xl overflow-hidden divide-y divide-slate-100"
              style={{ boxShadow: RING_DEFAULT }}
            >
              {filtered.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  selected={selected === file.id}
                  onSelect={() => toggleSelect(file.id)}
                  onOpen={() => onOpenFile?.(file)}
                  onDelete={() => handleDelete(file.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Upload zone (pinned to bottom) ──────────────────────────── */}
        <UploadZone
          onImageFile={onImageFile}
          onDtmsFile={onDtmsFile}
        />
      </div>
    </div>
  );
}
