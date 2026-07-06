import { useAppStore } from '../../app/appState';
import { RESOLUTION_DIMS } from '../../types/tactile';
import { A11Y } from '../../i18n/messages';
import { clampCursor } from '../../a11y/cursor';
import { cellStateOf } from '../../a11y/announce';
import styles from './BottomPanel.module.css';

/**
 * Persistent BottomPanel (spec layout contract): a visual mirror of the current
 * cursor position, cell state, and active tool, plus the latest status message.
 *
 * This is a *visual* readout only — the canvas keeps its own aria-live regions,
 * so nothing here is a live region (avoids double-announcing to screen readers).
 * Future F1.3–F1.10 quality/output feedback slots into this same region.
 */
export function BottomPanel() {
  const { state } = useAppStore();
  const { cursor, document, activeTool, language } = state;
  const s = A11Y[language];
  const latest = state.logs[state.logs.length - 1];

  const dims = document ? RESOLUTION_DIMS[document.resolution] : null;
  const at = dims ? clampCursor(cursor, dims) : null;
  const active = at
    ? Boolean(document?.cells.find((c) => c.x === at.x && c.y === at.y)?.active)
    : null;

  const positionText = at ? s.positionShort(at.y + 1, at.x + 1) : s.none;
  const stateText = active === null ? s.none : s.stateWord(cellStateOf(active));
  const canUndo = state.history.past.length > 0;
  const canRedo = state.history.future.length > 0;

  return (
    <div className={styles.panel} role="region" aria-label={s.panel.region}>
      <dl className={styles.fields}>
        <div className={styles.field}>
          <dt>{s.panel.position}</dt>
          <dd>{positionText}</dd>
        </div>
        <div className={styles.field}>
          <dt>{s.panel.state}</dt>
          <dd>{stateText}</dd>
        </div>
        <div className={styles.field}>
          <dt>{s.panel.tool}</dt>
          <dd>{s.toolName(activeTool)}</dd>
        </div>
        <div className={styles.field}>
          <dt>{s.undoLabel}</dt>
          <dd>{canUndo ? s.available : s.unavailable}</dd>
        </div>
        <div className={styles.field}>
          <dt>{s.redoLabel}</dt>
          <dd>{canRedo ? s.available : s.unavailable}</dd>
        </div>
      </dl>

      <div className={styles.status}>
        {latest && (
          <>
            <span className={styles.time}>{latest.time}</span>
            <span className={`${styles.dot} ${styles[latest.tone]}`} aria-hidden="true" />
            <span className={styles.msg}>{latest.message}</span>
          </>
        )}
      </div>
    </div>
  );
}
