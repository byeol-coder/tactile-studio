import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useAppStore } from '../../app/appState';
import { A11Y } from '../../i18n/messages';
import { useImageImport } from '../../hooks/useImageImport';
import { useDotPadConnection } from '../../hooks/useDotPadConnection';
import { QuickActionChip } from '../actions/QuickActionChip';
import { TemplateLibraryModal } from '../product/TemplateLibraryModal';
import { CommandGenerationPanel } from '../product/CommandGenerationPanel';
import { resolveTemplateResolution, templateToDocument } from '../../templates/load';
import { toPendingConversionPreset, type TactileTemplateDefinition } from '../../templates/catalog';
import styles from './EmptyState.module.css';

/** First screen: guides the user to import an image (file picker + drag & drop). */
export function EmptyState() {
  const { state, dispatch } = useAppStore();
  const s = A11Y[state.language];
  const { importFile, acceptAttr, acceptedHint } = useImageImport();
  const { connect } = useDotPadConnection();
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [dragover, setDragover] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const pendingPreset = state.pendingConversionPreset;

  // When a conversion preset is armed (via the picker or the entry context) and
  // the picker is closed, move focus to the import area so the next step —
  // import an image — is obvious for keyboard/screen-reader users.
  useEffect(() => {
    if (pendingPreset && !templatesOpen) cardRef.current?.focus();
  }, [pendingPreset, templatesOpen]);

  const loadTemplate = (t: TactileTemplateDefinition) => {
    if (t.assetType === 'conversion-preset') {
      // Presets arm the image pipeline — they never create a document. Confirm
      // first only if switching would abandon existing work (empty state → none).
      const pending = toPendingConversionPreset(t);
      if (!pending) {
        dispatch({ type: 'import/error', message: s.templateLoadError });
        setTemplatesOpen(false);
        return;
      }
      if (state.document && !window.confirm(s.templateReplaceConfirm)) return;
      dispatch({ type: 'preset/arm', preset: pending });
      setTemplatesOpen(false);
      // Focus is moved to the import card by the effect above, once the preset
      // is armed and the picker has closed.
      return;
    }
    // Empty state has no document; replacing an existing one confirms first.
    if (state.document && !window.confirm(s.templateReplaceConfirm)) return;
    const resolution = resolveTemplateResolution(t, state.context.gridSize);
    const doc = templateToDocument(t, resolution, state.language);
    if (doc) {
      dispatch({ type: 'convert/done', document: doc });
      dispatch({ type: 'announce', message: s.templateLoaded(t.title[state.language]) });
    } else {
      dispatch({ type: 'import/error', message: s.templateLoadError });
    }
    setTemplatesOpen(false);
  };

  const openPicker = () => inputRef.current?.click();

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragover(false);
    importFile(e.dataTransfer.files?.[0]);
  };

  const hasError = !!state.importError;

  return (
    <div className={styles.wrap}>
      <div
        ref={cardRef}
        className={`${styles.card} ${dragover ? styles.dragover : ''} ${hasError ? styles.error : ''}`}
        role="button"
        tabIndex={0}
        aria-label="이미지 가져오기 — 클릭하거나 파일을 끌어다 놓으세요"
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragover(true);
        }}
        onDragLeave={() => setDragover(false)}
        onDrop={onDrop}
      >
        <span className={styles.plus} aria-hidden="true">
          ＋
        </span>
        <span className={styles.title}>새 촉각그래픽 만들기</span>
        <span className={`${styles.hint} ${hasError ? styles.hintError : ''}`}>
          {hasError ? state.importError : `이미지를 끌어다 놓거나 클릭해서 선택 · ${acceptedHint}`}
        </span>
        <input
          ref={inputRef}
          className={styles.hiddenInput}
          type="file"
          accept={acceptAttr}
          onChange={(e) => importFile(e.target.files?.[0])}
        />
      </div>

      {pendingPreset && (
        <div className={styles.presetBanner}>
          <span className={styles.presetDot} aria-hidden="true" />
          {s.conversionPresetActive(pendingPreset.title[state.language])}
        </div>
      )}

      <div className={styles.chips}>
        <QuickActionChip label="이미지로 촉각그래픽 만들기" primary onClick={openPicker} />
        <QuickActionChip label={s.startFromTemplate} onClick={() => setTemplatesOpen(true)} />
        <QuickActionChip label={s.createFromCommand} onClick={() => setCommandOpen(true)} />
        <QuickActionChip label="Dot Pad 연결 테스트" onClick={connect} />
      </div>

      {templatesOpen && <TemplateLibraryModal onSelect={loadTemplate} onClose={() => setTemplatesOpen(false)} />}
      {commandOpen && (
        <CommandGenerationPanel
          onClose={() => setCommandOpen(false)}
          onUseImage={openPicker}
        />
      )}

      <p className={styles.guide}>
        1. 이미지를 추가하세요 → 2. AI가 60×40 촉각그래픽으로 변환합니다 → 3. 품질 확인 후 Dot Pad로 전송하세요
      </p>
    </div>
  );
}
