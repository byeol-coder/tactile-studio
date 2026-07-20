import React from 'react';
import { analyzeTactileQuality } from '../../codecs/quality/quality.js';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';

export function QualityPanel() {
  const { snapshot, store } = useEditorStore();
  const report = analyzeTactileQuality(store.getActiveCells(), snapshot.gridW, snapshot.gridH);
  const summary = report.pass ? `Tactile quality looks good: ${report.dots} pins.` : `Tactile quality warning: ${report.issues.filter(i => i.level === 'warn').length} issues.`;
  return <div role="region" aria-label="Tactile quality" style={{ border: '1px solid var(--ts-line, #ECE6DC)', borderRadius: 8, padding: 8, minWidth: 220 }}>
    <strong style={{ fontSize: 13 }}>Tactile quality check</strong>
    <div role="status" aria-live="polite" style={{ fontSize: 12, marginTop: 5 }}>{summary}</div>
    <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12 }}>
      {report.issues.map((issue) => <li key={issue.key} style={{ color: issue.level === 'warn' ? 'var(--ts-danger, #DA120D)' : 'inherit' }}>{issue.message}</li>)}
    </ul>
  </div>;
}
