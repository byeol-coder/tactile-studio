import type { TactileQuality } from '../../types/tactile';
import styles from './TactileQualitySummary.module.css';

const CLARITY_LABEL: Record<TactileQuality['clarity'], string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

/** Compact quality summary: 핀 수 · 밀도 · 구조 명확도 · DotPad 호환성. */
export function TactileQualitySummary({ quality }: { quality: TactileQuality }) {
  return (
    <div className={styles.bar} aria-label="촉각 품질 요약">
      <div className={styles.metric}>
        <span className={styles.label}>핀 수</span>
        <span className={styles.value}>{quality.activePins}</span>
      </div>
      <div className={styles.metric}>
        <span className={styles.label}>밀도</span>
        <span className={styles.value}>{(quality.density * 100).toFixed(1)}%</span>
      </div>
      <div className={styles.metric}>
        <span className={styles.label}>구조 명확도</span>
        <span className={`${styles.value} ${styles[quality.clarity]}`}>{CLARITY_LABEL[quality.clarity]}</span>
      </div>
      <span className={`${styles.pill} ${quality.dotPadCompatible ? styles.pillOk : styles.pillNo}`}>
        <span className={styles.dot} aria-hidden="true" />
        {quality.dotPadCompatible ? 'DotPad 호환' : 'DotPad 비호환'}
      </span>
    </div>
  );
}
