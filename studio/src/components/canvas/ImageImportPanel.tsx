import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../app/appState';
import { A11Y } from '../../i18n/messages';
import { RESOLUTION_DIMS, type TactileResolution } from '../../types/tactile';
import { imageFileToGrayscale } from '../../image/rasterize';
import { activeCoords, grayscaleToCells } from '../../image/convert';
import { Button } from '../ui/Button';
import styles from './ImageImportPanel.module.css';

/**
 * Phase 2 image import: upload → grayscale → threshold/dither → tactile grid,
 * with a live preview. "변환 적용" commits the result through the canonical
 * `document/convert-image` path (one undoable command).
 */
export function ImageImportPanel() {
  const { state, dispatch } = useAppStore();
  const s = A11Y[state.language];
  const file = state.importedFile;
  const pendingPreset = state.pendingConversionPreset;

  const [resolution, setResolution] = useState<TactileResolution>('60x40');
  const [threshold, setThreshold] = useState(pendingPreset?.preset.threshold ?? 128);
  const [dither, setDither] = useState(pendingPreset?.preset.dither ?? false);
  const [invert, setInvert] = useState(pendingPreset?.preset.invert ?? false);
  const [gray, setGray] = useState<Uint8ClampedArray | null>(null);
  const [loading, setLoading] = useState(false);

  // Pre-fill the conversion controls from an armed image-conversion preset. Runs
  // when a preset arrives (e.g. selected in the template picker before import).
  useEffect(() => {
    if (!pendingPreset) return;
    setThreshold(pendingPreset.preset.threshold);
    setDither(pendingPreset.preset.dither);
    setInvert(pendingPreset.preset.invert);
  }, [pendingPreset]);

  const { width, height } = RESOLUTION_DIMS[resolution];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Rasterize the file to grayscale once per (file, resolution).
  useEffect(() => {
    if (!file) return;
    let alive = true;
    setLoading(true);
    setGray(null);
    imageFileToGrayscale(file, width, height)
      .then((g) => alive && setGray(g))
      .catch(() => alive && setGray(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [file, width, height]);

  // Re-threshold cheaply as the sliders move (no re-decode).
  const previewCells = useMemo(
    () =>
      gray
        ? grayscaleToCells(gray, width, height, {
            threshold,
            dither: dither ? 'floyd-steinberg' : 'none',
            invert,
          })
        : null,
    [gray, width, height, threshold, dither, invert],
  );

  // Draw the preview as dots (canvas — cheap even for 96×64).
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !previewCells) return;
    const cell = 5;
    cv.width = width * cell;
    cv.height = height * cell;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#faf9f7';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < previewCells.length; i++) {
      if (!previewCells[i]) continue;
      const x = (i % width) * cell + cell / 2;
      const y = Math.floor(i / width) * cell + cell / 2;
      ctx.beginPath();
      ctx.arc(x, y, cell * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [previewCells, width, height]);

  const apply = () => {
    if (!previewCells) return;
    dispatch({ type: 'document/convert-image', resolution, active: activeCoords(previewCells, width) });
  };

  return (
    <div className={styles.panel}>
      <span className={styles.file}>{state.sourceImageName}</span>

      {pendingPreset && (
        <span className={styles.presetTag}>{s.conversionPresetActive(pendingPreset.title[state.language])}</span>
      )}

      <div className={styles.controls}>
        <label className={styles.field}>
          {s.imageResolution}
          <select value={resolution} onChange={(e) => setResolution(e.target.value as TactileResolution)}>
            <option value="60x40">60×40</option>
            <option value="96x64">96×64</option>
          </select>
        </label>
        <label className={styles.field}>
          {s.imageThreshold}: {threshold}
          <input type="range" min={0} max={255} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
        </label>
        <label className={`${styles.field} ${styles.inline}`}>
          <input type="checkbox" checked={dither} onChange={(e) => setDither(e.target.checked)} />
          {s.imageDither}
        </label>
        <label className={`${styles.field} ${styles.inline}`}>
          <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
          {s.imageInvert}
        </label>
      </div>

      <div className={styles.previewWrap}>
        {loading ? (
          <span className={styles.hint}>{s.imageConverting}</span>
        ) : (
          <canvas ref={canvasRef} className={styles.preview} role="img" aria-label={s.imagePreview} />
        )}
      </div>

      <Button variant="primary" disabled={!previewCells} onClick={apply}>
        {s.imageApply}
      </Button>
    </div>
  );
}
