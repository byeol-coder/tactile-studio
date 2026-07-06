import styles from './command.module.css';

interface Props {
  ready?: boolean;
  processing?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/** Runs the current command. Shows a spinner while processing. */
export function CommandSubmitButton({ ready = false, processing = false, disabled = false, onClick }: Props) {
  return (
    <button
      type="button"
      className={`${styles.iconBtn} ${ready && !processing ? styles.iconBtnReady : ''}`}
      onClick={onClick}
      disabled={disabled || processing}
      aria-label="명령 실행"
    >
      {processing ? <span className={styles.spinner} aria-hidden="true" /> : <span aria-hidden="true">↵</span>}
    </button>
  );
}
