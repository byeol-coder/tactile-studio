import { useAppStore } from '../../app/appState';
import { A11Y, type ToolId } from '../../i18n/messages';
import styles from './LeftRail.module.css';

interface RailItem {
  key: string;
  glyph: string;
  label: string;
}

const NAV: RailItem[] = [
  { key: 'new', glyph: '＋', label: '새 작업' },
  { key: 'home', glyph: '▦', label: '홈' },
  { key: 'library', glyph: '▧', label: '라이브러리' },
  { key: 'dotpad', glyph: '⌨', label: 'Dot Pad' },
];

const TOOLS: { tool: ToolId; glyph: string }[] = [
  { tool: 'cursor', glyph: '⌖' },
  { tool: 'pen', glyph: '✎' },
  { tool: 'eraser', glyph: '⌫' },
  { tool: 'line', glyph: '╱' },
  { tool: 'rect', glyph: '▭' },
  { tool: 'ellipse', glyph: '◯' },
  { tool: 'polygon', glyph: '⬠' },
  { tool: 'bucket', glyph: '▨' },
  { tool: 'select', glyph: '⬚' },
];

/** Tools that honor the outline/fill toggle. */
const FILLABLE = new Set<ToolId>(['rect', 'ellipse', 'polygon']);

/**
 * Narrow rail: editing tools (F1.3/F1.7) at the top, then navigational
 * placeholders. Tool buttons are keyboard-focusable and expose active state via
 * aria-pressed (+ a non-color inset ring). Line/shape/fill/select come later.
 */
export function LeftRail() {
  const { state, dispatch } = useAppStore();
  const s = A11Y[state.language];

  return (
    <div className={styles.rail}>
      <div role="group" aria-label={s.toolGroup} style={{ display: 'contents' }}>
        {TOOLS.map((t) => {
          const active = state.activeTool === t.tool;
          return (
            <button
              key={t.tool}
              type="button"
              className={`${styles.item} ${active ? styles.toolActive : ''}`}
              aria-pressed={active}
              aria-label={s.toolName(t.tool)}
              title={s.toolName(t.tool)}
              onClick={() => dispatch({ type: 'tool/set', tool: t.tool })}
            >
              <span className={styles.glyph} aria-hidden="true">
                {t.glyph}
              </span>
              {s.toolName(t.tool)}
            </button>
          );
        })}
      </div>

      {FILLABLE.has(state.activeTool) && (
        <button
          type="button"
          className={`${styles.item} ${state.shapeFill ? styles.toolActive : ''}`}
          aria-pressed={state.shapeFill}
          aria-label={`${s.fillLabel} — ${s.fillMode(state.shapeFill)}`}
          title={`${s.fillLabel} — ${s.fillMode(state.shapeFill)}`}
          onClick={() => dispatch({ type: 'shape/fill', enabled: !state.shapeFill })}
        >
          <span className={styles.glyph} aria-hidden="true">
            {state.shapeFill ? '◼' : '▢'}
          </span>
          {s.fillMode(state.shapeFill)}
        </button>
      )}

      {state.activeTool === 'select' && (
        <button
          type="button"
          className={`${styles.item} ${state.selectCopy ? styles.toolActive : ''}`}
          aria-pressed={state.selectCopy}
          aria-label={`${s.copyLabel} — ${s.copyMode(state.selectCopy)}`}
          title={`${s.copyLabel} — ${s.copyMode(state.selectCopy)}`}
          onClick={() => dispatch({ type: 'select/copy', enabled: !state.selectCopy })}
        >
          <span className={styles.glyph} aria-hidden="true">
            {state.selectCopy ? '⧉' : '⤢'}
          </span>
          {s.copyMode(state.selectCopy)}
        </button>
      )}

      <div className={styles.divider} aria-hidden="true" />

      {NAV.map((it, i) => (
        <button
          key={it.key}
          type="button"
          className={`${styles.item} ${i === 0 ? styles.active : ''}`}
          aria-current={i === 0 ? 'page' : undefined}
        >
          <span className={styles.glyph} aria-hidden="true">
            {it.glyph}
          </span>
          {it.label}
        </button>
      ))}
      <div className={styles.spacer} />
      <button type="button" className={styles.item}>
        <span className={styles.glyph} aria-hidden="true">
          ⚙
        </span>
        설정
      </button>
    </div>
  );
}
