import styles from './command.module.css';
import type { CommandInputMode } from '../../types/command';

/** Shows the active non-keyboard input mode (voice / DotPad command mode). */
export function CommandModeBadge({ mode }: { mode: CommandInputMode }) {
  if (mode === 'keyboard') return null;
  const isVoice = mode === 'voice';
  return (
    <span className={`${styles.modeBadge} ${isVoice ? styles.modeVoice : styles.modeDotpad}`} role="status">
      <span aria-hidden="true">{isVoice ? '●' : '⌨'}</span>
      {isVoice ? '음성 모드' : 'DotPad 명령 모드'}
    </span>
  );
}
