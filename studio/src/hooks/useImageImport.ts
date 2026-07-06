import { useCallback } from 'react';
import { useAppStore } from '../app/appState';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
export const ACCEPTED_HINT = 'PNG · JPG · WEBP · SVG';
const MAX_BYTES = 20 * 1024 * 1024;

/** Validate + accept a single imported image file. */
export function useImageImport() {
  const { dispatch } = useAppStore();

  const importFile = useCallback(
    (file: File | null | undefined): boolean => {
      if (!file) return false;
      if (!ACCEPTED.includes(file.type)) {
        dispatch({
          type: 'import/error',
          message: `지원하지 않는 형식입니다. (${ACCEPTED_HINT})`,
        });
        return false;
      }
      if (file.size > MAX_BYTES) {
        dispatch({ type: 'import/error', message: '파일이 너무 큽니다. (최대 20MB)' });
        return false;
      }
      dispatch({ type: 'import/start', name: file.name, file });
      return true;
    },
    [dispatch],
  );

  return { importFile, acceptedHint: ACCEPTED_HINT, acceptAttr: ACCEPTED.join(',') };
}
