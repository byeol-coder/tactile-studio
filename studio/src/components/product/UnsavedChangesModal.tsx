import { useEffect, useRef } from 'react';
import styles from './product.module.css';
import { Button } from '../ui/Button';

interface Props {
  onCancel: () => void;
  onSave: () => void;
  onDiscard: () => void;
}

/** Confirmation before navigating home with unsaved work. Focus-trapped, Esc cancels. */
export function UnsavedChangesModal({ onCancel, onSave, onDiscard }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button');
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        aria-describedby="unsaved-desc"
        onKeyDown={onKeyDown}
      >
        <div className={styles.dialogBody}>
          <h2 id="unsaved-title" className={styles.dialogTitle}>
            저장되지 않은 변경사항이 있습니다
          </h2>
          <p id="unsaved-desc" className={styles.dialogDesc}>
            홈으로 이동하면 현재 작업 내용이 사라질 수 있습니다.
          </p>
        </div>
        <div className={styles.dialogFooter}>
          <Button ref={firstRef} variant="quiet" onClick={onCancel}>
            취소
          </Button>
          <Button variant="default" onClick={onSave}>
            저장 후 이동
          </Button>
          <Button variant="danger" onClick={onDiscard}>
            그냥 이동
          </Button>
        </div>
      </div>
    </div>
  );
}
