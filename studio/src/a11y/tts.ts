import type { Language } from '../i18n/messages';

/**
 * Optional Korean/English TTS via the Web Speech API (spec §4).
 *
 * Rules honoured here:
 * - aria-live is the always-on channel; TTS is strictly optional/parallel.
 * - `speak()` cancels any in-flight utterance before speaking the newest one,
 *   so rapid cursor movement can never build up a long speech queue.
 * - Gracefully no-ops (never throws) when speechSynthesis is unavailable or the
 *   browser blocks speech.
 */
export interface SpeakOptions {
  enabled: boolean;
  lang: Language;
}

const BCP47: Record<Language, string> = { ko: 'ko-KR', en: 'en-US' };

/** Whether the Web Speech synthesis API is usable in this environment. */
export function isTtsAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

/**
 * Speak `text` if TTS is enabled and available. Always cancels prior speech
 * first (replace-not-queue). Best-effort: any failure is swallowed so a11y
 * never depends on speech succeeding.
 */
export function speak(text: string, { enabled, lang }: SpeakOptions): void {
  if (!enabled || !text) return;
  if (!isTtsAvailable()) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel(); // drop any stale/queued utterance → at most one pending
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = BCP47[lang];
    synth.speak(utterance);
  } catch {
    // Browser may block speech (autoplay policy, etc.); a11y still has aria-live.
  }
}

/** Stop any current speech (e.g. when TTS is turned off or canvas blurs). */
export function stopSpeaking(): void {
  if (!isTtsAvailable()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* no-op */
  }
}
