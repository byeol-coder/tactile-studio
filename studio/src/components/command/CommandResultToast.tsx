import styles from './command.module.css';

interface Props {
  message: string;
  tone: 'success' | 'error';
  onDismiss: () => void;
}

/** Transient result toast. aria-live announces the command outcome. */
export function CommandResultToast({ message, tone, onDismiss }: Props) {
  return (
    <div className={`${styles.toast} ${tone === 'error' ? styles.toastError : ''}`} role="status" aria-live="polite">
      <span className={styles.toastDot} aria-hidden="true" />
      <span className={styles.toastMsg}>{message}</span>
      <button type="button" className={styles.toastAction} onClick={onDismiss}>
        {tone === 'error' ? '다시 시도' : '실행 취소'}
      </button>
    </div>
  );
}
