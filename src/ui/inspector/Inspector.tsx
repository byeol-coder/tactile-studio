// src/ui/inspector/Inspector.tsx
//
// DEFERRED (documented in known-issues.md #5): device panel section (see
// DotPadPanel instead, composed separately by TactileStudioEditor).

import React from 'react';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import type { StudioLabels, GridFxService, BrailleService } from '../../react/types/public-api.js';

const BRAILLE_LANGS = [
  { key: 'ko-g2', label: 'Korean (Grade 2)' },
  { key: 'ko-g1', label: 'Korean (Grade 1)' },
  { key: 'ueb-g1', label: 'UEB (Grade 1)' },
  { key: 'ueb-g2', label: 'UEB (Grade 2)' },
];

export interface InspectorProps {
  labels?: StudioLabels;
  gridFx?: GridFxService;
  braille?: BrailleService;
}

export function Inspector({ labels, gridFx, braille }: InspectorProps) {
  const { snapshot, store } = useEditorStore();
  const audio = store.getPageAudio(snapshot.pageIndex);

  return (
    <div role="region" aria-label={(labels?.inspProps as string) || 'Properties'} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 220 }}>
      <div>
        <label htmlFor="ts-page-desc" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
          {(labels?.inspDesc as string) || 'Braille description'}
        </label>
        <textarea
          id="ts-page-desc"
          value={audio.desc || ''}
          onChange={(e) => store.setPageDesc(e.target.value)}
          rows={2}
          style={{ width: '100%', resize: 'vertical' }}
        />
        {braille && (
          <button
            type="button"
            disabled={snapshot.brailleBusy || !(audio.desc || '').trim()}
            onClick={() => store.applyBraille('desc', braille)}
            aria-label={((labels?.applyBraille as string) || 'Apply braille') + ' (description)'}
            style={{ marginTop: 4 }}
          >
            {snapshot.brailleBusy ? ((labels?.applying as string) || 'Applying…') : ((labels?.applyBraille as string) || 'Apply braille')}
          </button>
        )}
      </div>
      <div>
        <label htmlFor="ts-page-narr" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
          {(labels?.inspNarr as string) || 'Narration text'}
        </label>
        <textarea
          id="ts-page-narr"
          value={audio.narration || ''}
          onChange={(e) => store.setPageNarration(e.target.value)}
          rows={2}
          style={{ width: '100%', resize: 'vertical' }}
        />
        {braille && (
          <button
            type="button"
            disabled={snapshot.brailleBusy || !(audio.narration || '').trim()}
            onClick={() => store.applyBraille('narration', braille)}
            aria-label={((labels?.applyBraille as string) || 'Apply braille') + ' (narration)'}
            style={{ marginTop: 4 }}
          >
            {snapshot.brailleBusy ? ((labels?.applying as string) || 'Applying…') : ((labels?.applyBraille as string) || 'Apply braille')}
          </button>
        )}
      </div>

      {braille && (
        <div>
          <label htmlFor="ts-braille-lang" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
            {(labels?.inspBrailleLang as string) || 'Braille language'}
          </label>
          <select id="ts-braille-lang" value={snapshot.brailleLang} onChange={(e) => store.setBrailleLang(e.target.value)}>
            {BRAILLE_LANGS.map((l) => (
              <option key={l.key} value={l.key}>{(labels?.[`brailleLang${l.key}`] as string) || l.label}</option>
            ))}
          </select>
          <div aria-live="polite" style={{ fontSize: 12, marginTop: 4 }}>
            {snapshot.braillePreview == null
              ? ((labels?.braillePreviewEmpty as string) || 'Enter a braille description and Apply to preview the converted result.')
              : snapshot.braillePreview.ok
                ? `${snapshot.braillePreview.unicode} (${snapshot.braillePreview.cells} cells)`
                : ((labels?.braillePreviewFail as string) || 'Translation failed — the braille line will not be sent.')}
          </div>
        </div>
      )}

      {gridFx && (
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>{(labels?.inspCleanup as string) || 'Cleanup'}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => store.applyGridFxOp((cells, w, h) => gridFx.thicken(cells, w, h, -1))}>
              {(labels?.inspThinner as string) || 'Thinner'}
            </button>
            <button type="button" onClick={() => store.applyGridFxOp((cells, w, h) => gridFx.thicken(cells, w, h, 1))}>
              {(labels?.inspThicker as string) || 'Thicker'}
            </button>
            <button type="button" onClick={() => store.applyGridFxOp((cells, w, h) => gridFx.denoise(cells, w, h))}>
              {(labels?.inspDenoise as string) || 'Remove noise'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
