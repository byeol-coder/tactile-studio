import type { DotPadStatus } from '../../types/dotpad';
import styles from './DotPadStatusBadge.module.css';

const LABEL: Record<DotPadStatus, string> = {
  disconnected: 'Dot Pad 연결 안 됨',
  connecting: 'Dot Pad 연결 중…',
  connected: 'Dot Pad 연결됨',
  error: 'Dot Pad 연결 실패',
};

interface Props {
  status: DotPadStatus;
  deviceName?: string | null;
}

/** Always-visible device status. Text label carries the meaning, not colour. */
export function DotPadStatusBadge({ status, deviceName }: Props) {
  const label = LABEL[status];
  const text = status === 'connected' && deviceName ? `${label} · ${deviceName}` : label;
  return (
    <span className={`${styles.badge} ${styles[status]}`}>
      <span className={styles.dot} aria-hidden="true" />
      {text}
    </span>
  );
}
