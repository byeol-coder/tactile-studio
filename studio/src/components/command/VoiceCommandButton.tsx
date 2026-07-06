import styles from './command.module.css';

interface Props {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/** Mic toggle for voice command input. Icon + accessible label (not icon-only). */
export function VoiceCommandButton({ active = false, disabled = false, onClick }: Props) {
  return (
    <button
      type="button"
      className={`${styles.iconBtn} ${active ? styles.iconBtnActive : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={active ? '음성 명령 듣는 중 — 중지' : '음성 명령 시작'}
    >
      <span aria-hidden="true">●</span>
    </button>
  );
}
