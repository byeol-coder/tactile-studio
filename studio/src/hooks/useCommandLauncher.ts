import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../app/appState';
import { useDotPadConnection } from './useDotPadConnection';
import { useTactileConversion } from './useTactileConversion';
import { useDotPadSend } from './useDotPadSend';
import { filterCommands, parseCommand } from '../utils/commandParser';
import { computeQuality, drawShapeGrid, type TactileShape } from '../utils/tactileGrid';
import type {
  CommandInputMode,
  CommandIntent,
  CommandLauncherStatus,
} from '../types/command';
import type { TactileDocument } from '../types/tactile';

interface EffectResult {
  message: string;
  tone: 'success' | 'error';
}

let cmdDocSeq = 0;

/**
 * Orchestrates the Command Launcher: local UI state (open / query / active
 * option / input mode / status) + intent dispatch onto the existing domain
 * hooks. In v0 the parser is a mock; the dispatch mapping is the seam where a
 * real intent parser, voice recognition, and DotPad hardware actions plug in.
 */
export function useCommandLauncher() {
  const { state, dispatch } = useAppStore();
  const { connect } = useDotPadConnection();
  const { convert } = useTactileConversion();
  const { send, canSend } = useDotPadSend();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<CommandLauncherStatus>('idle');
  const [mode, setMode] = useState<CommandInputMode>('keyboard');
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);
  const after = (ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const suggestions = useMemo(() => filterCommands(query), [query]);
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, suggestions.length - 1)));
  }, [suggestions.length]);

  const focusInput = () => window.setTimeout(() => inputRef.current?.focus(), 0);

  const openLauncher = useCallback((m: CommandInputMode = 'keyboard') => {
    setMode(m);
    setOpen(true);
    setStatus('suggestionsOpen');
    setActiveIndex(0);
    focusInput();
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setStatus('idle');
    focusInput();
  }, []);

  const runEffect = useCallback(
    (intent: CommandIntent): EffectResult => {
      switch (intent.type) {
        case 'convert': {
          convert('60x40');
          const msgs: Record<string, string> = {
            optimize: 'DotPad에 맞게 최적화했습니다',
            outline: '외곽선만 남기기가 적용되었습니다',
            simplify: '더 단순하게 적용했습니다',
            sharpen: '더 또렷하게 적용했습니다',
            'fewer-dots': '점 수를 줄였습니다',
            invert: '밝고 어두움을 반전했습니다',
          };
          return { message: msgs[intent.action] ?? '변환을 적용했습니다', tone: 'success' };
        }
        case 'create': {
          const shape = (intent.args?.shape as TactileShape) ?? 'circle';
          const cells = drawShapeGrid(shape, '60x40');
          const iso = new Date().toISOString();
          const doc: TactileDocument = {
            id: `doc-cmd-${++cmdDocSeq}`,
            title: intent.label.replace(/\s*그려줘$/, ''),
            resolution: '60x40',
            cells,
            quality: computeQuality(cells, '60x40'),
            createdAt: iso,
            updatedAt: iso,
          };
          dispatch({ type: 'convert/done', document: doc });
          return { message: `${doc.title}을(를) 그렸습니다`, tone: 'success' };
        }
        case 'dotpad': {
          if (intent.action === 'connect') {
            connect();
            return { message: 'DotPad 연결을 시작합니다', tone: 'success' };
          }
          if (intent.action === 'send') {
            if (!canSend)
              return { message: '먼저 DotPad를 연결하고 그래픽을 변환하세요', tone: 'error' };
            send();
            return { message: 'DotPad로 전송을 시작합니다', tone: 'success' };
          }
          return { message: 'DotPad 미리보기를 업데이트했습니다', tone: 'success' };
        }
        case 'library':
          return {
            message:
              intent.action === 'recent'
                ? '최근 촉각그래픽을 불러왔습니다 (데모)'
                : '라이브러리 검색은 준비 중입니다',
            tone: 'success',
          };
        case 'help': {
          const msgs: Record<string, string> = {
            shortcuts: '단축키: ⌘K 열기 · Enter 실행 · Esc 닫기 · ↑ ↓ 이동',
            'function-keys': 'DotPad 기능키: F4 열기 · 패닝키 이동 · F2 실행 · F1 읽기 · F3 도움말',
            'how-to-convert': '이미지를 가져오면 60×40 촉각그래픽으로 변환됩니다',
          };
          return { message: msgs[intent.action] ?? '도움말을 열었습니다', tone: 'success' };
        }
        default:
          return { message: `명령을 이해하지 못했습니다: “${intent.label}”`, tone: 'error' };
      }
    },
    [convert, dispatch, connect, send, canSend],
  );

  const executeIntent = useCallback(
    (intent: CommandIntent) => {
      setOpen(false);
      setStatus('processing');
      dispatch({ type: 'announce', message: '명령을 실행하는 중입니다' });
      after(600, () => {
        const res = runEffect(intent);
        dispatch({ type: 'command/result', message: res.message, tone: res.tone });
        setStatus(res.tone === 'error' ? 'error' : 'success');
        setQuery('');
        after(3200, () => {
          dispatch({ type: 'command/result-clear' });
          setStatus('idle');
        });
      });
    },
    [dispatch, runEffect],
  );

  /** Submit the free-text query through the mock parser. */
  const submit = useCallback(() => {
    if (!query.trim()) return;
    executeIntent(parseCommand(query).intent);
  }, [query, executeIntent]);

  /** Run the currently highlighted suggestion, else submit the text. */
  const runActive = useCallback(() => {
    if (open && suggestions[activeIndex]) executeIntent(suggestions[activeIndex].intent);
    else submit();
  }, [open, suggestions, activeIndex, executeIntent, submit]);

  const move = useCallback(
    (delta: number) => {
      if (!open) setOpen(true);
      setActiveIndex((i) => {
        const n = suggestions.length;
        if (n === 0) return 0;
        return (i + delta + n) % n;
      });
    },
    [open, suggestions.length],
  );

  /** Mock voice flow: listening → transcribing → filled query, ready to run. */
  const startVoice = useCallback(() => {
    setMode('voice');
    setOpen(true);
    setStatus('listening');
    dispatch({ type: 'announce', message: '듣는 중입니다' });
    after(1400, () => {
      setStatus('transcribing');
      after(900, () => {
        setQuery('외곽선만 남겨줘');
        setStatus('suggestionsOpen');
        setActiveIndex(0);
        dispatch({ type: 'announce', message: '음성 인식 완료 — 실행하려면 Enter' });
        focusInput();
      });
    });
  }, [dispatch]);

  const openDotPadMode = useCallback(() => {
    openLauncher('dotpad');
  }, [openLauncher]);

  const onFocus = useCallback(() => {
    if (status === 'idle') setStatus('focused');
  }, [status]);
  const onBlur = useCallback(() => {
    if (!open && status === 'focused') setStatus('idle');
  }, [open, status]);

  return {
    // state
    open,
    query,
    status,
    mode,
    activeIndex,
    suggestions,
    inputRef,
    canSend,
    hasDocument: state.document !== null,
    // actions
    setQuery,
    setActiveIndex,
    openLauncher,
    openDotPadMode,
    close,
    submit,
    runActive,
    move,
    executeIntent,
    startVoice,
    onFocus,
    onBlur,
  };
}
