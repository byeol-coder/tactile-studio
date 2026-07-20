// src/ui/dialogs/ImportDialog.tsx
//
// Two import paths:
//  - Asset file (.json/.dtms): parseLibraryAssetPages (Phase 3 codec, pure
//    JSON parsing + DTMS decode) -> EditorStore.loadPages.
//  - Image file (png/jpg/etc.): decode to RGBA (real browser canvas step,
//    injectable for tests — see browser-image-decoder.ts) -> a pointer-drag
//    crop rectangle over a preview -> codecs/image's imgToCells (already
//    pure and parity-tested against the shipped algorithm, Phase 3) ->
//    EditorStore.loadPages (mode 'new' page, matching the corpus-search
//    load pattern).
//
// DEFERRED (documented): auto BANA check display, braille-language
// detection UI for imported assets.

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { parseLibraryAssetPages } from '../../codecs/library-asset-v1/library-asset-v1.js';
import { imgToCells, CONV_PRESETS, type ConvOptions } from '../../codecs/image/image.js';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import type { StudioLabels, ImageProcessingService } from '../../react/types/public-api.js';
import { useFocusTrap } from './useFocusTrap.js';
import { decodeImageFileInBrowser, type DecodedImage } from './browser-image-decoder.js';

export interface ImportDialogProps {
  open: boolean;
  labels?: StudioLabels;
  onClose(): void;
  /** Overrides the real browser image decoder — for tests only. */
  decodeImageFile?: (file: File) => Promise<DecodedImage>;
  /** Optional host override for the conversion algorithm. Defaults to the
   *  local, pure, already-parity-tested codecs/image imgToCells — most
   *  hosts never need to provide this. */
  imageProcessing?: ImageProcessingService;
}

type CropRect = { x: number; y: number; w: number; h: number };
type ImageConversionPreview = { cells: Uint8Array; removedDots: number };

export function ImportDialog({ open, labels, onClose, decodeImageFile = decodeImageFileInBrowser, imageProcessing }: ImportDialogProps) {
  const { store } = useEditorStore();
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<{ decoded: DecodedImage; previewUrl: string; fileName: string } | null>(null);
  const [crop, setCrop] = useState<CropRect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const [preset, setPreset] = useState<keyof typeof CONV_PRESETS>('balanced');
  const [invert, setInvert] = useState(false);
  // Tactile detail level (monolith's "촉각 디테일 정도" slider, 10-90/step 1,
  // default 50 — matches the shipped range exactly). React's onChange on a
  // range input already fires continuously while dragging (it normalizes to
  // the native 'input' event, not 'change'), so this doesn't need the
  // separate onInput fix the monolith needed (ba211bb) -- correct by
  // construction here, not a bug to port.
  const [threshold, setThreshold] = useState(50);
  const dragRef = useRef<{ x0: number; y0: number } | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useFocusTrap<HTMLDivElement>(open);

  // The preview and the committed page share one conversion result, so the
  // author can judge exactly what will be loaded into the editor.
  const conversion = useMemo<ImageConversionPreview | null>(() => {
    if (!image) return null;
    const selectedCrop = crop.w > 0.02 && crop.h > 0.02 ? crop : null;
    return imageProcessing
      ? imageProcessing.convert(image.decoded.data, image.decoded.width, image.decoded.height, 60, 40, { preset, threshold, invert }, selectedCrop)
      : imgToCells(image.decoded.data, image.decoded.width, image.decoded.height, 60, 40, { preset, threshold, invert } as ConvOptions, selectedCrop);
  }, [image, crop, preset, threshold, invert, imageProcessing]);

  const close = useCallback(() => {
    if (image) URL.revokeObjectURL(image.previewUrl);
    setImage(null);
    setError(null);
    onClose();
  }, [image, onClose]);

  if (!open) return null;

  const handleAssetFile = async (file: File) => {
    setError(null);
    let obj: unknown = null;
    try { obj = JSON.parse(await file.text()); } catch { obj = null; }
    if (!obj) {
      setError((labels?.aAssetBadFmt as string) || 'Not a supported tactile asset file (DTMS or library JSON).');
      return;
    }
    const parsed = parseLibraryAssetPages(obj);
    if (!parsed) {
      setError((labels?.aAssetBadFmt as string) || 'Not a supported tactile asset file (DTMS or library JSON).');
      return;
    }
    store.loadPages(parsed.pages.map((p) => p.cells), parsed.title || file.name.replace(/\.[^.]+$/, ''));
    close();
  };

  const handleImageFile = async (file: File) => {
    setError(null);
    try {
      const decoded = await decodeImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImage({ decoded, previewUrl, fileName: file.name });
      setCrop({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
      setThreshold(50);
    } catch (e: any) {
      setError(e?.message || 'Failed to decode image file.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) void handleImageFile(file);
    else void handleAssetFile(file);
  };

  const evNorm = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const el = previewRef.current!;
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  };

  const onCropPointerDown = (e: React.PointerEvent) => {
    const { x, y } = evNorm(e);
    dragRef.current = { x0: x, y0: y };
    setCrop({ x, y, w: 0, h: 0 });
  };
  const onCropPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { x, y } = evNorm(e);
    const { x0, y0 } = dragRef.current;
    setCrop({ x: Math.min(x0, x), y: Math.min(y0, y), w: Math.abs(x - x0), h: Math.abs(y - y0) });
  };
  const onCropPointerUp = () => { dragRef.current = null; };

  const commitImage = () => {
    if (!image || !conversion) return;
    store.loadPages([conversion.cells], image.fileName.replace(/\.[^.]+$/, ''));
    close();
  };

  return (
    <div role="presentation" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
      <div ref={containerRef} role="dialog" aria-modal="true" aria-label={(labels?.impAssetTitle as string) || 'Import tactile asset'} style={{ background: 'var(--ts-bg, #FFFFFF)', borderRadius: 12, padding: 20, minWidth: 320, maxWidth: 420 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{(labels?.impAssetTitle as string) || 'Import tactile asset'}</div>

        {!image && (
          <>
            <p style={{ fontSize: 13, marginBottom: 12 }}>{(labels?.impAssetSub as string) || 'Load a TGIL / DTMS / library file (.json/.dtms), or an image to convert.'}</p>
            <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px dashed var(--ts-line, #CEC6BA)', borderRadius: 10, background: '#FCFAF7' }}>
              <div style={{ fontSize: 12, color: 'var(--ts-muted, #675F56)' }}>Drop an image or tactile asset here, or choose a file below.</div>
              <label>
                <div style={{ fontSize: 12, marginBottom: 4 }}>{(labels?.impAssetChoose as string) || 'Asset file (.json/.dtms)'}</div>
                <input
                  type="file"
                  accept=".json,.dtms,application/json"
                  aria-label={(labels?.impAssetChoose as string) || 'Choose asset file'}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAssetFile(f); e.currentTarget.value = ''; }}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, marginBottom: 4 }}>{(labels?.impImageChoose as string) || 'Image file'}</div>
                <input
                  type="file"
                  accept="image/*"
                  aria-label={(labels?.impImageChoose as string) || 'Choose image file'}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.currentTarget.value = ''; }}
                />
              </label>
            </div>
          </>
        )}

        {image && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 5 }}>Original · crop</div>
                <div
                  ref={previewRef}
                  onPointerDown={onCropPointerDown}
                  onPointerMove={onCropPointerMove}
                  onPointerUp={onCropPointerUp}
                  style={{ position: 'relative', width: '100%', height: 180, backgroundImage: `url(${image.previewUrl})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', border: '1px solid var(--ts-line, #ECE6DC)', borderRadius: 8, touchAction: 'none', cursor: 'crosshair' }}
                  aria-label={(labels?.impCropLabel as string) || 'Drag to select a crop region'}
                  role="img"
                >
                  <div
                    data-testid="crop-rect"
                    style={{
                      position: 'absolute', left: `${crop.x * 100}%`, top: `${crop.y * 100}%`,
                      width: `${crop.w * 100}%`, height: `${crop.h * 100}%`,
                      border: '2px dashed var(--ts-primary, #C43D00)', background: 'rgba(196,61,0,0.1)', pointerEvents: 'none',
                    }}
                  />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 5 }}>Tactile result · 60 × 40</div>
                <div data-testid="tactile-preview" data-dot-count={conversion?.cells.reduce((total, cell) => total + cell, 0) || 0} role="img" aria-label={`Tactile conversion preview, ${conversion?.cells.reduce((total, cell) => total + cell, 0) || 0} raised dots`} style={{ display: 'grid', gridTemplateColumns: 'repeat(60, minmax(0, 1fr))', gap: 1, height: 180, padding: 6, overflow: 'hidden', border: '1px solid var(--ts-line, #ECE6DC)', borderRadius: 8, background: '#F8F5F0' }}>
                  {conversion && Array.from(conversion.cells, (cell, i) => <span key={i} aria-hidden="true" style={{ borderRadius: '50%', minWidth: 0, background: cell ? 'var(--ts-ink, #26221F)' : 'transparent' }} />)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 12 }}>
                {(labels?.impConvPreset as string) || 'Preset'}{' '}
                <select value={preset} onChange={(e) => setPreset(e.target.value as keyof typeof CONV_PRESETS)} aria-label={(labels?.impConvPreset as string) || 'Preset'}>
                  {Object.keys(CONV_PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12 }}>
                <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
                {' '}{(labels?.impConvInvert as string) || 'Invert'}
              </label>
            </div>

            <label style={{ display: 'block', fontSize: 12 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{(labels?.threshold as string) || 'Tactile detail level'}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: '#B93E15' }}>{threshold}</span>
              </span>
              <input
                type="range"
                min={10}
                max={90}
                step={1}
                value={threshold}
                onChange={(e) => setThreshold(+e.target.value)}
                aria-label={(labels?.threshold as string) || 'Tactile detail level'}
                style={{ display: 'block', width: '100%', marginTop: 6 }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setImage(null)}>{(labels?.back as string) || 'Back'}</button>
              <button type="button" onClick={commitImage}>{(labels?.impConvert as string) || 'Convert'}</button>
            </div>
          </div>
        )}

        {error && <div role="alert" style={{ color: 'var(--ts-danger, #DA120D)', fontSize: 12, marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={close}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
