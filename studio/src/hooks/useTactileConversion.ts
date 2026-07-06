import { useCallback, useRef } from 'react';
import { useAppStore } from '../app/appState';
import type { TactileDocument, TactileResolution } from '../types/tactile';
import { computeQuality, convertImageToGrid } from '../utils/tactileGrid';

let docSeq = 0;

/**
 * Placeholder tactile conversion (v0).
 *
 * Produces a deterministic 60×40 grid from the image name and computes quality
 * indicators. Replace `convertImageToGrid` with the real engine later; the
 * document shape and lifecycle (converting → converted) do not change.
 */
export function useTactileConversion() {
  const { state, dispatch } = useAppStore();
  const timer = useRef<number | null>(null);

  const convert = useCallback(
    (resolution: TactileResolution = '60x40') => {
      const seed = state.sourceImageName ?? 'untitled';
      dispatch({ type: 'convert/start' });
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const cells = convertImageToGrid(seed, resolution);
        const iso = new Date().toISOString();
        const doc: TactileDocument = {
          id: `doc-${++docSeq}`,
          title: seed.replace(/\.[^.]+$/, '') || 'Untitled',
          resolution,
          cells,
          sourceImageName: seed,
          quality: computeQuality(cells, resolution),
          createdAt: iso,
          updatedAt: iso,
        };
        dispatch({ type: 'convert/done', document: doc });
      }, 700);
    },
    [dispatch, state.sourceImageName],
  );

  return { convert };
}
