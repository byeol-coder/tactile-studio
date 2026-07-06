import { RESOLUTION_DIMS, type TactileDocument } from '../../types/tactile';
import styles from './TactileCanvas.module.css';

interface Props {
  document?: TactileDocument | null;
  converting?: boolean;
}

/** Renders the 60×40 tactile grid as SVG pin dots (active = raised). */
export function TactileCanvas({ document, converting }: Props) {
  if (converting || !document) {
    return <div className={styles.skeleton} role="img" aria-label="촉각그래픽 변환 중" />;
  }

  const { width, height } = RESOLUTION_DIMS[document.resolution];
  const u = 10;
  const active = document.quality?.activePins ?? document.cells.filter((c) => c.active).length;

  return (
    <div className={styles.frame}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${width * u} ${height * u}`}
        role="img"
        aria-label={`${document.resolution} 촉각그래픽 미리보기 — 활성 핀 ${active}개`}
      >
        {document.cells.map((c) => (
          <circle
            key={`${c.x}-${c.y}`}
            cx={c.x * u + u / 2}
            cy={c.y * u + u / 2}
            r={c.active ? u * 0.34 : u * 0.16}
            fill={c.active ? '#1a1a1a' : '#e4e2df'}
          />
        ))}
      </svg>
    </div>
  );
}
