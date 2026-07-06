import { useMemo, useState } from 'react';
import { GraphicPickerModal } from './GraphicPickerModal';
import { useAppStore } from '../../app/appState';
import { A11Y } from '../../i18n/messages';
import { useCorpusSeed } from '../../hooks/useCorpusSeed';
import { getCorpus } from '../../corpus';
import { corpusPageToDocument } from '../../corpus/search';
import type { CorpusGraphic } from '../../corpus/types';
import type { TactileDocument } from '../../types/tactile';

interface Props {
  onClose: () => void;
}

/**
 * Browse the bundled DTMS corpus ("published 조회" parity, spec A4). Reuses the
 * accessible {@link GraphicPickerModal} at two levels: a graphic list (one card
 * per ingested graphic, first-page preview) and — for multi-page graphics — a
 * page grid. Selecting seeds the chosen page's GRAPHIC layer via the shared
 * {@link useCorpusSeed}; braille/audio stay in the corpus.
 */
export function CorpusLibraryModal({ onClose }: Props) {
  const { state } = useAppStore();
  const lang = state.language;
  const s = A11Y[lang];
  const seedPage = useCorpusSeed();
  const [pageGraphic, setPageGraphic] = useState<CorpusGraphic | null>(null);

  const corpus = useMemo(() => getCorpus(), []);
  // List-level cards: first-page preview; multi-page titles carry a page count.
  const listDocs = useMemo<TactileDocument[]>(
    () =>
      corpus.map((g) => {
        const doc = corpusPageToDocument(g, 0, lang);
        return {
          ...doc,
          id: `corpus-list-${g.id}`,
          title: g.pages.length > 1 ? `${g.title} · ${s.corpusPagesLabel(g.pages.length)}` : g.title,
        };
      }),
    [corpus, lang, s],
  );
  const byListId = useMemo(() => new Map(listDocs.map((d, i) => [d.id, corpus[i]])), [listDocs, corpus]);
  const pageDocs = useMemo(
    () => (pageGraphic ? pageGraphic.pages.map((_, i) => corpusPageToDocument(pageGraphic, i, lang)) : []),
    [pageGraphic, lang],
  );

  if (pageGraphic) {
    return (
      <GraphicPickerModal
        title={`${pageGraphic.title} — ${s.corpusPickPage}`}
        items={pageDocs}
        onSelect={(doc) => {
          const i = pageDocs.indexOf(doc);
          if (i >= 0 && seedPage(pageGraphic, i)) onClose();
        }}
        onClose={() => setPageGraphic(null)}
      />
    );
  }

  return (
    <GraphicPickerModal
      title={s.corpusLibraryTitle}
      items={listDocs}
      onSelect={(doc) => {
        const g = byListId.get(doc.id);
        if (!g) return;
        if (g.pages.length === 1) {
          if (seedPage(g, 0)) onClose();
        } else {
          setPageGraphic(g);
        }
      }}
      onClose={onClose}
    />
  );
}
