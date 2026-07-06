import { useEffect, useRef, type KeyboardEvent } from 'react';
import styles from './command.module.css';
import { useCommandLauncher } from '../../hooks/useCommandLauncher';
import { CommandInput } from './CommandInput';
import { VoiceCommandButton } from './VoiceCommandButton';
import { CommandSubmitButton } from './CommandSubmitButton';
import { CommandSuggestionPanel } from './CommandSuggestionPanel';
import { CommandModeBadge } from './CommandModeBadge';

/**
 * Command Launcher — top-center quick-exec hub (⌘K / voice / DotPad keys).
 * Composes Command Bar Surface + Suggestion Panel + Mode Badge and owns the
 * keyboard interaction (⌘K open, ↑↓ move, Enter run, Esc close).
 */
export function CommandLauncher() {
  const cl = useCommandLauncher();
  const rootRef = useRef<HTMLDivElement>(null);
  const { open, openLauncher, close } = cl;

  // ⌘K / Ctrl+K opens the launcher from anywhere.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openLauncher('keyboard');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openLauncher]);

  // Click outside closes the suggestions.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open, close]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cl.move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cl.move(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      cl.runActive();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cl.close();
    }
  };

  const barCls = [
    styles.bar,
    (cl.status === 'focused' || cl.status === 'suggestionsOpen') && styles.barFocused,
    cl.status === 'listening' && styles.barListening,
    cl.status === 'processing' && styles.barProcessing,
    cl.status === 'error' && styles.barError,
  ]
    .filter(Boolean)
    .join(' ');

  const activeId = open && cl.suggestions[cl.activeIndex] ? `cmd-opt-${cl.activeIndex}` : undefined;

  const handleChange = (v: string) => {
    cl.setQuery(v);
    if (!open) openLauncher('keyboard');
  };

  return (
    <div className={styles.launcher} ref={rootRef}>
      <div className={barCls}>
        <CommandInput
          value={cl.query}
          status={cl.status}
          expanded={open}
          activeId={activeId}
          inputRef={cl.inputRef}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onFocus={cl.onFocus}
          onBlur={cl.onBlur}
          onClick={() => !open && openLauncher('keyboard')}
        />
        {cl.status === 'idle' && (
          <span className={styles.kbd} aria-hidden="true">
            ⌘K
          </span>
        )}
        <VoiceCommandButton
          active={cl.status === 'listening' || cl.status === 'transcribing'}
          onClick={cl.startVoice}
        />
        <CommandSubmitButton
          ready={!!cl.query.trim()}
          processing={cl.status === 'processing'}
          disabled={!cl.query.trim()}
          onClick={cl.runActive}
        />
      </div>

      <CommandModeBadge mode={cl.mode} />

      {open && (
        <CommandSuggestionPanel
          suggestions={cl.suggestions}
          activeIndex={cl.activeIndex}
          onSelect={(s) => cl.executeIntent(s.intent)}
          setActiveIndex={cl.setActiveIndex}
        />
      )}
    </div>
  );
}
