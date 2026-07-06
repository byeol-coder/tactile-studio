import { useAppStore } from '../../app/appState';
import { A11Y } from '../../i18n/messages';
import { stopSpeaking } from '../../a11y/tts';
import styles from './CanvasControls.module.css';

const CONTROLS: { glyph: string; label: string }[] = [
  { glyph: '＋', label: '확대' },
  { glyph: '－', label: '축소' },
  { glyph: '✥', label: '이동(팬)' },
  { glyph: '◉', label: '미리보기' },
  { glyph: '?', label: '도움말' },
];

/** Floating canvas controls. Icon buttons each carry an accessible label. */
export function CanvasControls() {
  const { state, dispatch } = useAppStore();
  const s = A11Y[state.language];

  const toggleTts = () => {
    const enabled = !state.ttsEnabled;
    if (!enabled) stopSpeaking();
    dispatch({ type: 'tts/set', enabled });
  };

  return (
    <div className={styles.controls} role="toolbar" aria-label="캔버스 컨트롤" aria-orientation="vertical">
      {/* Optional Korean/English voice readout toggle (F1.2 §4). */}
      <button
        type="button"
        className={`${styles.btn} ${state.ttsEnabled ? styles.btnActive : ''}`}
        aria-pressed={state.ttsEnabled}
        aria-label={`${s.ttsLabel} — ${s.ttsToggle(state.ttsEnabled)}`}
        title={`${s.ttsLabel} — ${s.ttsToggle(state.ttsEnabled)}`}
        onClick={toggleTts}
      >
        <span aria-hidden="true">♪</span>
      </button>
      {CONTROLS.map((c) => (
        <button key={c.label} type="button" className={styles.btn} aria-label={c.label} title={c.label}>
          <span aria-hidden="true">{c.glyph}</span>
        </button>
      ))}

      <div className={styles.divider} aria-hidden="true" />

      {/* Quick Actions (F1.10) — one DocumentCommand each, undoable. */}
      <div role="group" aria-label={s.quickActionsLabel} style={{ display: 'contents' }}>
        <button
          type="button"
          className={styles.btn}
          disabled={!state.document}
          aria-label={s.clearAllLabel}
          title={s.clearAllLabel}
          onClick={() => {
            if (window.confirm(s.clearConfirm)) dispatch({ type: 'document/clear-all' });
          }}
        >
          <span aria-hidden="true">⌦</span>
        </button>
        <button
          type="button"
          className={styles.btn}
          disabled={!state.document}
          aria-label={s.invertLabel}
          title={s.invertLabel}
          onClick={() => dispatch({ type: 'document/invert' })}
        >
          <span aria-hidden="true">◐</span>
        </button>
        <button
          type="button"
          className={styles.btn}
          disabled={!state.document}
          aria-label={s.fitGridLabel}
          title={s.fitGridLabel}
          onClick={() => dispatch({ type: 'document/fit-grid' })}
        >
          <span aria-hidden="true">▣</span>
        </button>
      </div>
    </div>
  );
}
