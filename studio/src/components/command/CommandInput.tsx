import type { KeyboardEvent, RefObject } from 'react';
import styles from './command.module.css';
import { Icon } from '../ui/Icon';
import type { CommandLauncherStatus } from '../../types/command';

const PLACEHOLDER = '명령으로 변환·생성 — 최적화 / 외곽선만 / 원 그려줘 / 점자로…';

interface Props {
  value: string;
  status: CommandLauncherStatus;
  expanded: boolean;
  activeId?: string;
  inputRef: RefObject<HTMLInputElement>;
  onChange: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
  onClick: () => void;
}

/** The command combobox input (Input / Command). Sparkle + text field. */
export function CommandInput({
  value,
  status,
  expanded,
  activeId,
  inputRef,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  onClick,
}: Props) {
  const listening = status === 'listening';
  const transcribing = status === 'transcribing';
  const readOnly = listening || transcribing;
  const shown = listening ? '듣는 중입니다…' : transcribing ? '텍스트 변환 중…' : value;

  return (
    <>
      <span className={`${styles.sparkle} ${expanded || listening ? styles.sparkleActive : ''}`} aria-hidden="true">
        <Icon name="sparkle" size={16} />
      </span>
      {listening && <span className={styles.listenDot} aria-hidden="true" />}
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls="cmd-listbox"
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-label="명령 입력 — 변환·생성·라이브러리·DotPad·도움말"
        placeholder={PLACEHOLDER}
        value={shown}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        onClick={onClick}
      />
    </>
  );
}
