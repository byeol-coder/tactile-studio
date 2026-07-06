import { useAppStore } from '../../app/appState';
import { EmptyState } from '../canvas/EmptyState';
import { ImageImportPanel } from '../canvas/ImageImportPanel';
import { TactileCanvas } from '../canvas/TactileCanvas';
import { TactileEditor } from '../canvas/TactileEditor';
import { TactileQualitySummary } from '../canvas/TactileQualitySummary';
import { CanvasControls } from '../canvas/CanvasControls';
import { ExportButtonGroup } from '../actions/ExportButtonGroup';
import { DotPadSendButton } from '../dotpad/DotPadSendButton';
import styles from './CanvasViewport.module.css';

/** Central work area. Renders per canvas status: empty → imported → converting → result. */
export function CanvasViewport() {
  const { state } = useAppStore();
  const { canvasStatus, document } = state;

  let body: JSX.Element;

  if (canvasStatus === 'empty') {
    body = <EmptyState />;
  } else if (canvasStatus === 'image-imported') {
    body = <ImageImportPanel />;
  } else if (canvasStatus === 'converting') {
    body = (
      <div className={styles.stack}>
        <TactileCanvas converting />
        <span className={styles.sub}>AI가 60×40 촉각그래픽으로 변환 중…</span>
      </div>
    );
  } else {
    // converted / send-ready / sending / sent / error
    body = (
      <div className={styles.stack}>
        {document ? <TactileEditor document={document} /> : <TactileCanvas document={document} />}
        {document?.quality && <TactileQualitySummary quality={document.quality} />}
        <div className={styles.actions}>
          {document && <ExportButtonGroup document={document} />}
          <DotPadSendButton />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.viewport}>
      <div className={styles.center}>{body}</div>
      {canvasStatus !== 'empty' && (
        <div className={styles.controls}>
          <CanvasControls />
        </div>
      )}
    </div>
  );
}
