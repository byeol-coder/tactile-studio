import { useEffect } from 'react';
import { useAppStore } from '../../app/appState';
import { addRecent } from '../../utils/recentStore';
import { onActivation, startSession } from '../../analytics/activation';
import { useHistoryShortcuts } from '../../hooks/useHistoryShortcuts';
import { TopBar } from './TopBar';
import { LeftRail } from './LeftRail';
import { CanvasViewport } from './CanvasViewport';
import { BottomPanel } from './BottomPanel';
import { CommandResultToast } from '../command/CommandResultToast';
import styles from './AppShell.module.css';

/**
 * Top-level layout (fixed workspace regions): TopBar across the top, narrow
 * LeftRail on the side, the CanvasViewport filling the centre, and a persistent
 * BottomPanel status bar. These four regions are the stable layout contract —
 * future tools fill existing slots rather than adding new areas.
 */
export function AppShell() {
  const { state, dispatch } = useAppStore();
  useHistoryShortcuts();

  // Persist each converted/loaded document to recent-work history.
  const docId = state.document?.id;
  useEffect(() => {
    if (state.document) addRecent(state.document);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  // Spec §C: start the activation window on mount and surface the first
  // successful DotPad output (the activation moment) as a log + announcement.
  useEffect(() => {
    startSession();
    return onActivation((event) => {
      const secs = (event.timeToActivationMs / 1000).toFixed(1);
      dispatch({
        type: 'log',
        entry: {
          channel: 'dotpad',
          message: `첫 촉각 그래픽 출력 성공 · ${secs}초`,
          tone: 'success',
        },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <TopBar />
      </header>
      <nav className={styles.rail} aria-label="주요 도구">
        <LeftRail />
      </nav>
      <main className={styles.canvas} aria-label="촉각그래픽 캔버스">
        <CanvasViewport />
      </main>
      <div className={styles.logs}>
        <BottomPanel />
      </div>
      {state.commandResult && (
        <CommandResultToast
          key={state.commandResult.id}
          message={state.commandResult.message}
          tone={state.commandResult.tone}
          onDismiss={() => dispatch({ type: 'command/result-clear' })}
        />
      )}
    </div>
  );
}
