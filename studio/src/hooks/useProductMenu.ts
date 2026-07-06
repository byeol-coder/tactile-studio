import { useCallback, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../app/appState';
import { useDotPadConnection } from './useDotPadConnection';
import { useDotPadSend } from './useDotPadSend';
import { exportJson, exportPng } from '../utils/exportTactileData';
import { addRecent } from '../utils/recentStore';
import type { TactileDocument } from '../types/tactile';
import type { IconName } from '../components/ui/Icon';

export type PickerKind = 'recent' | 'mine' | 'shared' | 'public' | 'template' | 'corpus';
export type HelpKind = 'shortcuts' | 'fnkeys' | 'a11y';

export interface ProductMenuItemDef {
  icon: IconName;
  label: string;
  action: string;
  shortcut?: string;
  destructive?: boolean;
}
export interface ProductMenuSectionDef {
  key: string;
  label: string;
  items: ProductMenuItemDef[];
}

export const PRODUCT_MENU: ProductMenuSectionDef[] = [
  {
    key: 'file',
    label: 'FILE',
    items: [
      { icon: 'plus', label: '새 작업', action: 'new' },
      { icon: 'template', label: '템플릿 라이브러리', action: 'template' },
      { icon: 'save', label: '프로젝트 저장', action: 'save', shortcut: '⌘S' },
      { icon: 'folder', label: '프로젝트 열기', action: 'open', shortcut: '⌘O' },
      { icon: 'image', label: 'PNG 내보내기', action: 'export-png', shortcut: '⇧⌘E' },
    ],
  },
  {
    key: 'workspace',
    label: 'WORKSPACE',
    items: [
      { icon: 'home', label: '홈으로 이동', action: 'home' },
      { icon: 'sparkle', label: 'DTMS 라이브러리', action: 'lib-corpus' },
      { icon: 'clock', label: '최근 작업', action: 'recent' },
      { icon: 'library', label: '내 라이브러리', action: 'lib-mine' },
      { icon: 'user', label: '공유 라이브러리', action: 'lib-shared' },
      { icon: 'external-link', label: '공용 라이브러리', action: 'lib-public' },
    ],
  },
  {
    key: 'dotpad',
    label: 'DOTPAD',
    items: [
      { icon: 'dotpad', label: 'DotPad 연결', action: 'dp-connect' },
      { icon: 'device', label: 'DotPad 연결 테스트', action: 'dp-test' },
      { icon: 'send', label: 'DotPad로 보내기', action: 'dp-send' },
      { icon: 'refresh', label: '현재 그래픽 다시 읽기', action: 'dp-reread' },
    ],
  },
  {
    key: 'help',
    label: 'HELP',
    items: [
      { icon: 'keyboard', label: '키보드 단축키', action: 'shortcuts', shortcut: '?' },
      { icon: 'help', label: 'DotPad 기능키 도움말', action: 'fnkeys' },
      { icon: 'accessibility', label: '접근성 가이드', action: 'a11y' },
    ],
  },
];

const FLAT = PRODUCT_MENU.flatMap((s) => s.items);

/** Product Switcher menu orchestration: open state, keyboard nav, action dispatch, unsaved-home flow. */
export function useProductMenu() {
  const { state, dispatch } = useAppStore();
  const { connect } = useDotPadConnection();
  const { send, canSend } = useDotPadSend();

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const [help, setHelp] = useState<HelpKind | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openProjectRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => FLAT, []);
  const toast = (message: string, tone: 'success' | 'error' = 'success') =>
    dispatch({ type: 'command/result', message, tone });
  const reset = () => dispatch({ type: 'canvas/reset' });

  const closeMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const openMenu = useCallback(() => {
    setOpen(true);
    setActiveIndex(0);
  }, []);

  const run = useCallback(
    (action: string) => {
      setOpen(false);
      switch (action) {
        case 'new':
          reset();
          toast('새 작업을 시작했습니다');
          break;
        case 'save':
          if (state.document) {
            exportJson(state.document);
            toast('프로젝트를 저장했습니다');
          } else toast('저장할 작업이 없습니다', 'error');
          break;
        case 'export-png':
          if (state.document) {
            exportPng(state.document);
            toast('PNG를 내보냈습니다');
          } else toast('내보낼 그래픽이 없습니다', 'error');
          break;
        case 'home':
          if (state.document) setUnsavedOpen(true);
          else {
            reset();
            toast('홈으로 이동했습니다');
          }
          break;
        case 'dp-connect':
        case 'dp-test':
          connect();
          toast(action === 'dp-test' ? 'DotPad 연결을 테스트합니다' : 'DotPad 연결을 시작합니다');
          break;
        case 'dp-send':
          if (canSend) {
            send();
            toast('DotPad로 전송을 시작합니다');
          } else toast('먼저 DotPad를 연결하고 변환하세요', 'error');
          break;
        case 'dp-reread':
          toast('DotPad에서 현재 그래픽을 다시 읽었습니다');
          break;
        case 'shortcuts':
          setHelp('shortcuts');
          break;
        case 'recent':
          setPicker('recent');
          break;
        case 'lib-mine':
          setPicker('mine');
          break;
        case 'lib-shared':
          setPicker('shared');
          break;
        case 'lib-public':
          setPicker('public');
          break;
        case 'lib-corpus':
          setPicker('corpus');
          break;
        case 'template':
          setPicker('template');
          break;
        case 'open':
          openProjectRef.current?.click();
          break;
        case 'fnkeys':
          setHelp('fnkeys');
          break;
        case 'a11y':
          setHelp('a11y');
          break;
        default:
          break;
      }
    },
    [state.document, connect, send, canSend, dispatch],
  );

  /** Home button (logo + name). Confirms before discarding unsaved work. */
  const goHome = useCallback(() => {
    if (state.document) setUnsavedOpen(true);
    else toast('이미 홈 화면입니다');
  }, [state.document, dispatch]);

  const confirmHome = useCallback(
    (mode: 'cancel' | 'save' | 'go') => {
      if (mode === 'cancel') {
        setUnsavedOpen(false);
        return;
      }
      if (mode === 'save' && state.document) exportJson(state.document);
      reset();
      setUnsavedOpen(false);
      toast(mode === 'save' ? '저장 후 홈으로 이동했습니다' : '홈으로 이동했습니다');
    },
    [state.document, dispatch],
  );

  /** Load a document from recent/library into the canvas. */
  const loadDocument = useCallback(
    (doc: TactileDocument) => {
      dispatch({ type: 'convert/done', document: doc });
      addRecent(doc);
      setPicker(null);
      toast(`"${doc.title}"을(를) 불러왔습니다`);
    },
    [dispatch],
  );

  const move = useCallback((delta: number) => {
    setActiveIndex((i) => (i + delta + FLAT.length) % FLAT.length);
  }, []);

  return {
    open,
    openMenu,
    closeMenu,
    setOpen,
    activeIndex,
    setActiveIndex,
    move,
    items,
    sections: PRODUCT_MENU,
    run,
    goHome,
    unsavedOpen,
    confirmHome,
    picker,
    setPicker,
    loadDocument,
    help,
    setHelp,
    openProjectRef,
    triggerRef,
    unsaved: state.document !== null,
  };
}
