import type { TactileDocument } from '../types/tactile';

const KEY = 'tactile-studio.recent';
const CAP = 12;

/** Read the recent-work list from localStorage (newest first). */
export function getRecent(): TactileDocument[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TactileDocument[]) : [];
  } catch {
    return [];
  }
}

/** Add/promote a document to the front of the recent list (deduped by id, capped). */
export function addRecent(doc: TactileDocument): void {
  try {
    const list = getRecent().filter((d) => d.id !== doc.id);
    list.unshift(doc);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP)));
  } catch {
    /* storage unavailable — recent history simply won't persist */
  }
}

/** Remove a single document from recent history by id. */
export function removeRecent(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(getRecent().filter((d) => d.id !== id)));
  } catch {
    /* noop */
  }
}

export function clearRecent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
