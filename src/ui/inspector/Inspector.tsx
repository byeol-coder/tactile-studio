// src/ui/inspector/Inspector.tsx
//
// DEFERRED (documented in known-issues.md #5): device panel section (see
// DotPadPanel instead, composed separately by TactileStudioEditor), braille
// "Apply" conversion + preview (needs a wired BrailleService — plain
// autosave text only in this pass).

import React from 'react';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import type { StudioLabels, GridFxService } from '../../react/types/public-api.js';

export interface InspectorProps {
  labels?: StudioLabels;
  gridFx?: GridFxService;
}

export function Inspector({ labels, gridFx }: InspectorProps) {
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
      </div>

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
