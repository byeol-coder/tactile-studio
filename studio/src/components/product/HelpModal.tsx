import { useEffect, useRef } from 'react';
import styles from './product.module.css';
import { Button } from '../ui/Button';

export type HelpSection = 'shortcuts' | 'fnkeys' | 'a11y';

const KEYBOARD: [string, string][] = [
  ['⌘K', '명령 실행창 열기'],
  ['Enter', '선택 항목 실행'],
  ['Esc', '메뉴 · 모달 닫기'],
  ['↑ ↓', '항목 이동'],
  ['Tab', '다음 요소로 이동'],
  ['⌘S', '프로젝트 저장'],
  ['⌘O', '프로젝트 열기'],
  ['⇧⌘E', 'PNG 내보내기'],
];
const FNKEYS: [string, string][] = [
  ['F4 (길게)', 'DotPad 명령 모드 열기'],
  ['패닝키 ←→', '추천 명령 이동'],
  ['F2', '선택 / 실행'],
  ['F1', '현재 선택 명령 읽기 (TTS)'],
  ['F3', '도움말'],
  ['F4', '명령 모드 닫기'],
];
const A11Y: string[] = [
  '키보드만으로 전체 기능 사용 가능',
  '상태 변경은 aria-live로 음성 안내',
  '아이콘은 항상 텍스트 라벨과 함께 제공',
  '색상만으로 상태를 구분하지 않음',
  '모든 인터랙션에 가시적 포커스 표시',
  '모달은 포커스 트랩 + ESC로 닫기, 닫으면 트리거로 포커스 복귀',
];

/** Help panel: keyboard shortcuts · DotPad function keys · accessibility guide. */
export function HelpModal({ section, onClose }: { section: HelpSection; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus();
  }, []);

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`${styles.dialog} ${styles.help}`}
        role="dialog"
        aria-modal="true"
        aria-label="도움말"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className={styles.pickerHead}>
          <h2 className={styles.pickerTitle}>도움말</h2>
          <button type="button" className={styles.pickerClose} onClick={onClose} aria-label="닫기">
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className={styles.helpBody}>
          <section className={`${styles.helpSection} ${section === 'shortcuts' ? styles.helpSectionActive : ''}`}>
            <h3 className={styles.helpH}>키보드 단축키</h3>
            {KEYBOARD.map(([k, d]) => (
              <div key={k} className={styles.helpRow}>
                <span className={styles.helpKey}>{k}</span>
                {d}
              </div>
            ))}
          </section>

          <section className={`${styles.helpSection} ${section === 'fnkeys' ? styles.helpSectionActive : ''}`}>
            <h3 className={styles.helpH}>DotPad 기능키</h3>
            {FNKEYS.map(([k, d]) => (
              <div key={k} className={styles.helpRow}>
                <span className={styles.helpKey}>{k}</span>
                {d}
              </div>
            ))}
          </section>

          <section className={`${styles.helpSection} ${section === 'a11y' ? styles.helpSectionActive : ''}`}>
            <h3 className={styles.helpH}>접근성 가이드</h3>
            {A11Y.map((t) => (
              <div key={t} className={styles.helpRow}>
                <span className={styles.helpBullet} aria-hidden="true" />
                {t}
              </div>
            ))}
          </section>
        </div>

        <div className={styles.pickerFooter}>
          <Button variant="quiet" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}
