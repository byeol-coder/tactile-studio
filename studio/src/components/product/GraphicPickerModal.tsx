import { useEffect, useRef } from 'react';
import styles from './product.module.css';
import { RESOLUTION_DIMS, type TactileDocument } from '../../types/tactile';
import { Button } from '../ui/Button';

/** Small SVG thumbnail of a tactile document (active pins only). */
function Thumb({ doc }: { doc: TactileDocument }) {
  const { width, height } = RESOLUTION_DIMS[doc.resolution];
  const u = 4;
  return (
    <svg className={styles.thumb} viewBox={`0 0 ${width * u} ${height * u}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {doc.cells.map(
        (c) =>
          c.active && <circle key={`${c.x}-${c.y}`} cx={c.x * u + u / 2} cy={c.y * u + u / 2} r={u * 0.42} fill="#1a1a1a" />,
      )}
    </svg>
  );
}

interface Props {
  title: string;
  items: TactileDocument[];
  onSelect: (doc: TactileDocument) => void;
  onClose: () => void;
  emptyText?: string;
  onRemove?: (doc: TactileDocument) => void;
  onClear?: () => void;
}

/** Modal grid picker for library / recent graphics. Esc closes, focus-trapped. */
export function GraphicPickerModal({ title, items, onSelect, onClose, emptyText, onRemove, onClear }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button, [tabindex]')?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`${styles.dialog} ${styles.picker}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={onKeyDown}
      >
        <div className={styles.pickerHead}>
          <h2 className={styles.pickerTitle}>{title}</h2>
          <span className={styles.pickerCount}>{items.length}개</span>
          <button type="button" className={styles.pickerClose} onClick={onClose} aria-label="닫기">
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {items.length === 0 ? (
          <p className={styles.pickerEmpty}>{emptyText ?? '항목이 없습니다.'}</p>
        ) : (
          <div className={styles.pickerGrid} role="listbox" aria-label={title}>
            {items.map((doc) => (
              <div
                key={doc.id}
                role="option"
                aria-selected={false}
                tabIndex={0}
                className={`${styles.card} ${styles.cardWrap}`}
                onClick={() => onSelect(doc)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(doc);
                  }
                }}
              >
                {onRemove && (
                  <button
                    type="button"
                    className={styles.cardRemove}
                    aria-label={`${doc.title} 최근 목록에서 제거`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(doc);
                    }}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                )}
                <Thumb doc={doc} />
                <span className={styles.cardTitle}>{doc.title}</span>
                <span className={styles.cardMeta}>
                  {doc.resolution} · 핀 {doc.quality?.activePins ?? doc.cells.filter((c) => c.active).length}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.pickerFooter}>
          {onClear && items.length > 0 && (
            <Button variant="quiet" className={styles.pickerClear} onClick={onClear}>
              전체 지우기
            </Button>
          )}
          <Button variant="quiet" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}
