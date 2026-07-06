import type { TactileDocument } from '../../types/tactile';
import { exportDtms, exportJson, exportPng, exportSvg } from '../../utils/exportTactileData';
import { useAppStore } from '../../app/appState';
import { Button } from '../ui/Button';

/** Export the current document — DTMS · PNG · JSON (developer). */
export function ExportButtonGroup({ document }: { document: TactileDocument }) {
  const { dispatch } = useAppStore();
  const run = (fn: () => void, label: string) => {
    fn();
    dispatch({ type: 'log', entry: { channel: 'save', message: `${label} 내보내기 완료`, tone: 'success' } });
  };

  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)' }} role="group" aria-label="내보내기">
      <Button size="md" variant="default" onClick={() => run(() => exportPng(document), 'PNG')}>
        PNG
      </Button>
      <Button size="md" variant="default" onClick={() => run(() => exportJson(document), 'JSON')}>
        JSON
      </Button>
      <Button size="md" variant="default" onClick={() => run(() => exportDtms(document), 'DTMS')}>
        DTMS
      </Button>
      <Button size="md" variant="default" onClick={() => run(() => exportSvg(document), 'SVG')}>
        SVG
      </Button>
    </div>
  );
}
