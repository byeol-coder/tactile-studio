import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../app/appState';
import { A11Y } from '../../i18n/messages';
import { RESOLUTION_DIMS, type TactileDocument, type TactileResolution } from '../../types/tactile';
import {
  GENERATION_EXAMPLES,
  generateFromCommand,
  isBlankPrompt,
  type GenerationPurpose,
} from '../../generation/commandGenerate';
import { searchCorpus, nearMatches, corpusPageToDocument, type CorpusHit } from '../../corpus/search';
import { useCorpusSeed } from '../../hooks/useCorpusSeed';
import type { CorpusGraphic } from '../../corpus/types';
import { GraphicPickerModal } from './GraphicPickerModal';
import styles from './CommandGenerationPanel.module.css';

const PURPOSES: GenerationPurpose[] = ['lesson', 'diagram', 'map', 'object', 'museum', 'guide'];

/** Tiny SVG preview of a decoded document (active pins only). */
function ResultThumb({ doc }: { doc: TactileDocument }) {
  const { width, height } = RESOLUTION_DIMS[doc.resolution];
  const u = 2;
  return (
    <svg className={styles.resultThumb} viewBox={`0 0 ${width * u} ${height * u}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {doc.cells.map(
        (c) => c.active && <rect key={`${c.x}-${c.y}`} x={c.x * u} y={c.y * u} width={u} height={u} fill="#1a1a1a" />,
      )}
    </svg>
  );
}

interface Props {
  onClose: () => void;
  /** Optional: jump to the image-conversion flow (miss path B5). */
  onUseImage?: () => void;
}

type Phase = 'input' | 'results' | 'miss' | 'pages';

/**
 * Command entry for Studio (spec B). A prompt first searches the bundled DTMS
 * corpus; hits are shown for selection (single-page → auto-seed, multi-page →
 * page grid), and a miss surfaces near candidates + the deterministic generator
 * fallback + an image-conversion hint (never a bare "no results"). Seeding uses
 * the graphic layer only; braille/audio stay in the corpus.
 */
export function CommandGenerationPanel({ onClose, onUseImage }: Props) {
  const { state, dispatch } = useAppStore();
  const lang = state.language;
  const s = A11Y[lang];
  const seedPage = useCorpusSeed();

  const [prompt, setPrompt] = useState('');
  const [grid, setGrid] = useState<TactileResolution>(state.context.gridSize ?? '60x40');
  const [purpose, setPurpose] = useState<GenerationPurpose | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('input');
  const [hits, setHits] = useState<CorpusHit[]>([]);
  const [near, setNear] = useState<CorpusHit[]>([]);
  const [pageGraphic, setPageGraphic] = useState<CorpusGraphic | null>(null);

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<number | null>(null);
  const titleId = 'command-gen-title';

  useEffect(() => {
    promptRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [onClose]);

  // First-page preview per hit (decoded once per result set).
  const hitThumbs = useMemo(
    () => new Map(hits.map((h) => [h.graphic.id, corpusPageToDocument(h.graphic, 0, lang)])),
    [hits, lang],
  );
  // Per-page documents for the multi-page picker.
  const pageDocs = useMemo(
    () => (pageGraphic ? pageGraphic.pages.map((_, i) => corpusPageToDocument(pageGraphic, i, lang)) : []),
    [pageGraphic, lang],
  );

  const runSearch = () => {
    if (busy) return;
    if (isBlankPrompt(prompt)) {
      setError(s.generationEmptyPrompt);
      dispatch({ type: 'announce', message: s.generationEmptyPrompt });
      promptRef.current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    timer.current = window.setTimeout(() => {
      try {
        const found = searchCorpus(prompt, lang);
        setBusy(false);
        if (found.length > 0) {
          setHits(found);
          setPhase('results');
          dispatch({ type: 'announce', message: s.corpusResultsLabel(found.length) });
        } else {
          setNear(nearMatches(prompt, lang));
          setPhase('miss');
          dispatch({ type: 'announce', message: s.corpusMissTitle });
        }
      } catch {
        setBusy(false);
        setError(s.generationError);
        dispatch({ type: 'announce', message: s.generationError });
      }
    }, 250);
  };

  /** Result selected: single page auto-seeds, multi-page opens the page grid. */
  const chooseGraphic = (graphic: CorpusGraphic) => {
    if (graphic.pages.length === 1) {
      if (seedPage(graphic, 0)) onClose();
    } else {
      setPageGraphic(graphic);
      setPhase('pages');
    }
  };

  /** Generator fallback (miss path): deterministic local draft, editable. */
  const generateDraft = () => {
    try {
      const result = generateFromCommand(prompt, grid, lang, purpose || undefined);
      if (!result) {
        setError(s.generationEmptyPrompt);
        return;
      }
      dispatch({ type: 'document/generate', document: result.document, isFallback: result.isFallback });
      onClose();
    } catch {
      setError(s.generationError);
      dispatch({ type: 'announce', message: s.generationError });
    }
  };

  const useImage = () => {
    onClose();
    onUseImage?.();
  };

  // Multi-page selection reuses the accessible thumbnail-grid picker.
  if (phase === 'pages' && pageGraphic) {
    return (
      <GraphicPickerModal
        title={`${pageGraphic.title} — ${s.corpusPickPage}`}
        items={pageDocs}
        onSelect={(doc) => {
          const i = pageDocs.indexOf(doc);
          if (i >= 0 && seedPage(pageGraphic, i)) onClose();
        }}
        onClose={() => setPhase('results')}
      />
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <span id={titleId} className={styles.title}>
            {s.commandPanelTitle}
          </span>
          <button type="button" className={styles.close} aria-label={lang === 'ko' ? '닫기' : 'Close'} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <label className={styles.field}>
            <span className={styles.label}>{s.commandPromptLabel}</span>
            <textarea
              ref={promptRef}
              className={styles.prompt}
              rows={2}
              value={prompt}
              placeholder={s.commandPromptPlaceholder}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (error) setError(null);
                if (phase !== 'input') setPhase('input'); // editing invalidates results
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  runSearch();
                }
              }}
            />
          </label>

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>{s.imageResolution}</span>
              <select value={grid} onChange={(e) => setGrid(e.target.value as TactileResolution)}>
                <option value="60x40">60×40</option>
                <option value="96x64">96×64</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{s.commandPurposeLabel}</span>
              <select value={purpose} onChange={(e) => setPurpose(e.target.value as GenerationPurpose | '')}>
                <option value="">{s.commandPurposeAuto}</option>
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {s.commandPurpose(p)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {phase === 'input' && (
            <div className={styles.examples}>
              <span className={styles.label}>{s.commandExamplesLabel}</span>
              <div className={styles.chips}>
                {GENERATION_EXAMPLES.map((ex) => (
                  <button
                    key={ex.en}
                    type="button"
                    className={styles.chip}
                    onClick={() => {
                      setPrompt(ex[lang]);
                      setError(null);
                      setPhase('input');
                      promptRef.current?.focus();
                    }}
                  >
                    {ex[lang]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === 'results' && (
            <div className={styles.results} role="listbox" aria-label={s.corpusResultsLabel(hits.length)}>
              <div className={styles.resultsHead}>
                <span className={styles.label}>{s.corpusResultsLabel(hits.length)}</span>
              </div>
              {hits.map((h) => (
                <button
                  key={h.graphic.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className={styles.resultItem}
                  onClick={() => chooseGraphic(h.graphic)}
                >
                  {hitThumbs.get(h.graphic.id) && <ResultThumb doc={hitThumbs.get(h.graphic.id)!} />}
                  <span className={styles.resultText}>
                    <span className={styles.resultTitle}>{h.graphic.title}</span>
                    <span className={styles.resultMeta}>
                      {s.corpusCategory(h.graphic.category)} · {h.graphic.spec} · {s.corpusPagesLabel(h.graphic.pages.length)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {phase === 'miss' && (
            <div className={styles.miss}>
              <span className={styles.missTitle}>{s.corpusMissTitle}</span>
              {near.length > 0 && (
                <div className={styles.results} role="listbox" aria-label={s.corpusNearLabel}>
                  <span className={styles.label}>{s.corpusNearLabel}</span>
                  {near.map((h) => (
                    <button
                      key={h.graphic.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      className={styles.resultItem}
                      onClick={() => chooseGraphic(h.graphic)}
                    >
                      <span className={styles.resultText}>
                        <span className={styles.resultTitle}>{h.graphic.title}</span>
                        <span className={styles.resultMeta}>
                          {s.corpusCategory(h.graphic.category)} · {s.corpusPagesLabel(h.graphic.pages.length)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className={styles.missActions}>
                <button type="button" className={styles.secondary} onClick={generateDraft}>
                  {s.corpusGenerateInstead}
                </button>
                {onUseImage && (
                  <button type="button" className={styles.secondary} onClick={useImage}>
                    {s.corpusUseImage}
                  </button>
                )}
              </div>
              <p className={styles.missHint}>{s.corpusMissHint}</p>
            </div>
          )}

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>

        <div className={styles.foot}>
          {phase !== 'input' && (
            <button type="button" className={styles.back} onClick={() => setPhase('input')}>
              {s.corpusBack}
            </button>
          )}
          <button type="button" className={styles.generate} onClick={runSearch} disabled={busy}>
            {busy ? s.commandGenerating : s.commandGenerate}
          </button>
        </div>
      </div>
    </div>
  );
}
