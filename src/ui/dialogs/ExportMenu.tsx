// src/ui/dialogs/ExportMenu.tsx
//
// DTMS and Library Asset v1 export, wired to the Phase 3 codecs. Both
// produce a JSON string the host can turn into a download however it
// wants — this component does NOT touch document.createElement('a') /
// URL.createObjectURL itself (that's a browser-only file-download concern,
// left to the host via onExport, matching "Studio must pass complete
// document data to the host without loss").
//
// DEFERRED (documented): SVG/PNG export (PNG needs a real canvas.toBlob;
// SVG needs a bitsToSVG port — neither is extracted yet).

import React from 'react';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import type { TwEncodeBits } from '../../codecs/dtms/dtms.js';
import { encodeDtmsHex } from '../../codecs/dtms/dtms.js';
import { buildLibraryAssetV1 } from '../../codecs/library-asset-v1/library-asset-v1.js';
import { convQuality, banaPrintCheck } from '../../codecs/quality/quality.js';
import type { StudioLabels } from '../../react/types/public-api.js';

export interface ExportMenuProps {
  encodeBits: TwEncodeBits;
  labels?: StudioLabels;
  onExport(result: { format: 'dtms' | 'library-asset-v1'; json: string; filename: string }): void;
}

export function ExportMenu({ encodeBits, labels, onExport }: ExportMenuProps) {
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

  return (
    <div role="menu" aria-label={(labels?.tExport as string) || 'Export'} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button type="button" role="menuitem" onClick={exportDtms}>DTMS ({snapshot.pageCount} page{snapshot.pageCount === 1 ? '' : 's'})</button>
      <button type="button" role="menuitem" onClick={exportLibraryAsset}>Library Asset v1</button>
    </div>
  );
}
