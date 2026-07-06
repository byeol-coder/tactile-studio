import { useCallback } from 'react';
import { useAppStore } from '../app/appState';
import { A11Y } from '../i18n/messages';
import { addRecent } from '../utils/recentStore';
import { corpusPageToDocument } from '../corpus/search';
import type { CorpusGraphic } from '../corpus/types';

/**
 * Seed one page of a corpus graphic's GRAPHIC layer into the editor as an
 * editable starting point (spec B3/B4). Confirms before replacing existing work,
 * decodes via {@link corpusPageToDocument}, and dispatches the canonical
 * `document/seed` (history reset → clean edit start; DotPad send / export /
 * download all keep working). Returns false if the user cancels the replace.
 */
export function useCorpusSeed() {
  const { state, dispatch } = useAppStore();
  const lang = state.language;

  return useCallback(
    (graphic: CorpusGraphic, pageIndex: number): boolean => {
      const s = A11Y[lang];
      if (state.document && !window.confirm(s.templateReplaceConfirm)) return false;
      const document = corpusPageToDocument(graphic, pageIndex, lang);
      dispatch({ type: 'document/seed', document, message: s.corpusSeeded(graphic.title) });
      addRecent(document);
      return true;
    },
    [state.document, lang, dispatch],
  );
}
