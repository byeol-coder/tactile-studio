// src/ui/dialogs/ExportMenu.tsx
//
// DTMS, Library Asset v1, SVG, and PNG export.
//
// DTMS/Library-Asset-v1/SVG produce text the host turns into a download
// however it wants, via onExport — this component does not touch
// document.createElement('a')/URL.createObjectURL itself for those (matches
// "Studio must pass complete document data to the host without loss").
//
// PNG is different in kind: it's the one export format with no vendor
// function to inject (the monolith's exportPNG draws directly to an
// offscreen canvas and calls toBlob) — genuinely browser-canvas-only, like
// the text-tool glyph rasterizer. Implemented for real here (not deferred),
// but NOT parity-tested pixel-for-pixel for the same reason as that
// rasterizer: there's no meaningful cross-engine baseline to compare a
// rendered bitmap against outside a real browser. onExport receives a Blob
// for this one format instead of a string.

import React from 'react';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import type { TwEncodeBits } from '../../codecs/dtms/dtms.js';
import { encodeDtmsHex } from '../../codecs/dtms/dtms.js';
import { buildLibraryAssetV1 } from '../../codecs/library-asset-v1/library-asset-v1.js';
import { convQuality, banaPrintCheck } from '../../codecs/quality/quality.js';
import { encodeSvg, type TwBitsToSvg } from '../../codecs/svg/svg.js';
import type { StudioLabels } from '../../react/types/public-api.js';

export type ExportResult =
  | { format: 'dtms' | 'library-asset-v1' | 'svg'; json: string; filename: string }
  | { format: 'png'; blob: Blob; filename: string };

export interface ExportMenuProps {
  encodeBits: TwEncodeBits;
  bitsToSvg?: TwBitsToSvg;
  labels?: StudioLabels;
  onExport(result: ExportResult): void;
}

export function ExportMenu({ encodeBits, bitsToSvg, labels, onExport }: ExportMenuProps) {
  const { snapshot, store } = useEditorStore();
  const doc = store.getDocument();

  const exportDtms = () => {
    const { w, h } = doc.grid;
    const items = doc.pages.map((cellBuf, i) => ({
      label: `${doc.title || 'tactile'} · ${i + 1}`,
      data: encodeDtmsHex(encodeBits, cellBuf, w, h),
    }));
    const json = JSON.stringify({
      title: doc.title || 'tactile',
      lang: 'korean',
      lang_option: '1',
      device: w >= 96 ? 'dotpad768' : 'dotpad320',
      audioPath: '',
      items: items.map((it, n) => ({
        page: n + 1,
        title: it.label,
        graphic: { name: `${n + 1}.dtm`, data: it.data },
        text: { name: `${n + 1}.txt`, data: '', plain: it.label },
        audio: { fileName: '' },
      })),
    }, null, 2);
    onExport({ format: 'dtms', json, filename: `${doc.title || 'tactile'}.dtms.json` });
  };

  const exportLibraryAsset = () => {
    const { w, h } = doc.grid;
    const asset = buildLibraryAssetV1({
      name: doc.title || 'tactile',
      gridW: w, gridH: h, lang: 'ko', brailleLang: 'ko-g2',
      activeCells: store.getActiveCells(),
      pages: doc.pages,
      pageAudio: doc.pageAudio as any,
      pageVectors: doc.pageVectors as any,
      corpusCtx: null,
    }, { encodeBits, convQuality, banaCheck: banaPrintCheck, now: Date.now() });
    onExport({ format: 'library-asset-v1', json: JSON.stringify(asset, null, 2), filename: `${asset.id}.json` });
  };

  const exportSvg = () => {
    if (!bitsToSvg) return;
    const { w, h } = doc.grid;
    const svg = encodeSvg(bitsToSvg, store.getActiveCells(), w, h, { title: doc.title || 'tactile' });
    onExport({ format: 'svg', json: svg, filename: `${doc.title || 'tactile'}.svg` });
  };

  const exportPng = () => {
    const { w, h } = doc.grid;
    const cell = 12, pad = cell;
    const cv = document.createElement('canvas');
    cv.width = w * cell + pad * 2;
    cv.height = h * cell + pad * 2;
    const g = cv.getContext('2d');
    if (!g) return; // no 2D context available (non-browser environment) — nothing to export
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#1a1a1a';
    const cells = store.getActiveCells();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (cells[y * w + x]) {
        g.beginPath();
        g.arc(pad + x * cell + cell / 2, pad + y * cell + cell / 2, cell * 0.42, 0, Math.PI * 2);
        g.fill();
      }
    }
    cv.toBlob((blob) => {
      if (blob) onExport({ format: 'png', blob, filename: `${doc.title || 'tactile'}.png` });
    }, 'image/png');
  };

  return (
    <div role="menu" aria-label={(labels?.tExport as string) || 'Export'} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button type="button" role="menuitem" onClick={exportDtms}>DTMS ({snapshot.pageCount} page{snapshot.pageCount === 1 ? '' : 's'})</button>
      <button type="button" role="menuitem" onClick={exportLibraryAsset}>Library Asset v1</button>
      {bitsToSvg && <button type="button" role="menuitem" onClick={exportSvg}>SVG</button>}
      <button type="button" role="menuitem" onClick={exportPng}>PNG</button>
    </div>
  );
}
