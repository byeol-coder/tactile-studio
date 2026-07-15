// src/ui/corpus/CorpusSearchPanel.tsx
//
// "명령어로 만들기" command-panel search UI, wired to the real ported search
// engine (codecs/corpus/corpus-search.ts) and EditorStore.loadCorpusResult.
// The host supplies the corpus data (typically by loading the real
// corpus.js and reading window.DTMS_CORPUS) — this panel never bundles or
// assumes a specific corpus source.
//
// Multi-page records: loading a hit from a record with more than one page
// sets up a navigation context (verbatim port of corpusCtxFor/corpusGoPage)
// so Prev/Next buttons can browse the record's OTHER pages without creating
// new document pages — matching the monolith's browsing-before-committing
// UX exactly.

import React, { useMemo, useState } from 'react';
import { searchCorpus, nearMatches, corpusCtxFor } from '../../codecs/corpus/corpus-search.js';
import type { CorpusRecord, CorpusSearchResult } from '../../codecs/corpus/types.js';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import type { StudioLabels } from '../../react/types/public-api.js';

export interface CorpusSearchPanelProps {
  corpus: CorpusRecord[];
  labels?: StudioLabels;
  /** 'new' inserts a fresh page (default); 'replace' overwrites the active page. */
  defaultMode?: 'new' | 'replace';
}

export function CorpusSearchPanel({ corpus, labels, defaultMode = 'new' }: CorpusSearchPanelProps) {
  const { snapshot, store } = useEditorStore();
  const [query, setQuery] = useState('');

  const { hits, suggestions } = useMemo(() => {
    const results = searchCorpus(corpus, query, { limit: 8 });
    const confidentHits = results.filter((r) => r.confident);
    if (confidentHits.length) return { hits: confidentHits, suggestions: [] as CorpusSearchResult[] };
    return { hits: [] as CorpusSearchResult[], suggestions: nearMatches(corpus, query, { limit: 4 }) };
  }, [corpus, query]);

  const load = (r: CorpusSearchResult) => {
    const label = r.pageCount > 1 ? `${r.title} · ${r.pageNumber}` : r.title;
    const ctx = corpusCtxFor(corpus, { id: r.id, title: r.title, pageIndex: r.pageIndex }, query);
    store.loadCorpusResult(r.graphic, defaultMode, label, ctx);
  };

  const ctx = snapshot.corpusCtx;
  const goPrev = () => { if (ctx) store.corpusGoPage(ctx.index - 1); };
  const goNext = () => { if (ctx) store.corpusGoPage(ctx.index + 1); };

  return (
    <div role="search" aria-label={(labels?.cmdPanelTitle as string) || 'Create with a command'} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 240 }}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={(labels?.cmdPlaceholder as string) || 'Describe what to draw…'}
        aria-label={(labels?.cmdInputLabel as string) || 'Command input'}
      />
      {query.trim() && hits.length > 0 && (
        <ul role="listbox" aria-label="Search results" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {hits.map((r) => (
            <li key={`${r.id}-${r.pageIndex}`}>
              <button type="button" onClick={() => load(r)} style={{ width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--ts-line, #ECE6DC)', background: 'var(--ts-surface, #FFFFFF)', cursor: 'pointer' }}>
                {r.title}{r.pageCount > 1 ? ` · ${r.pageNumber}/${r.pageCount}` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && hits.length === 0 && suggestions.length > 0 && (
        <div>
          <div style={{ fontSize: 12, marginBottom: 4 }}>{(labels?.cmdNoMatch as string) || 'No exact match — did you mean:'}</div>
          <ul role="listbox" aria-label="Suggestions" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {suggestions.map((r) => (
              <li key={`${r.id}-${r.pageIndex}`}>
                <button type="button" onClick={() => load(r)} style={{ width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 6, border: '1px dashed var(--ts-line, #ECE6DC)', background: 'transparent', cursor: 'pointer' }}>
                  {r.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {query.trim() && hits.length === 0 && suggestions.length === 0 && (
        <div style={{ fontSize: 12, opacity: 0.7 }}>{(labels?.cmdEmpty as string) || 'No matches found.'}</div>
      )}

      {ctx && (
        <div role="group" aria-label={(labels?.cmdPageNav as string) || 'Browse pages in this record'} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <button type="button" onClick={goPrev} disabled={ctx.index === 0} aria-label={(labels?.cmdPrevPage as string) || 'Previous page'}>◀</button>
          <span>{ctx.title} · {ctx.index + 1}/{ctx.pages.length}</span>
          <button type="button" onClick={goNext} disabled={ctx.index === ctx.pages.length - 1} aria-label={(labels?.cmdNextPage as string) || 'Next page'}>▶</button>
        </div>
      )}
    </div>
  );
}
