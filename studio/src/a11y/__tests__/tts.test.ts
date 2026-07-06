import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTtsAvailable, speak } from '../tts';

/** Minimal speechSynthesis mock that models a pending-utterance queue. */
class MockSynth {
  queue: unknown[] = [];
  maxPending = 0;
  cancelCalls = 0;
  throwOnSpeak = false;
  cancel() {
    this.cancelCalls++;
    this.queue = [];
  }
  speak(u: unknown) {
    if (this.throwOnSpeak) throw new Error('blocked by browser');
    this.queue.push(u);
    this.maxPending = Math.max(this.maxPending, this.queue.length);
  }
}

function installTts(synth: MockSynth) {
  vi.stubGlobal('window', {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: class {
      lang = '';
      constructor(public text: string) {}
    },
  });
  // tts.ts references bare `window.SpeechSynthesisUtterance` and `window`.
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      lang = '';
      constructor(public text: string) {}
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tts availability', () => {
  it('reports unavailable and never throws when speechSynthesis is missing', () => {
    vi.stubGlobal('window', {});
    expect(isTtsAvailable()).toBe(false);
    expect(() => speak('안녕', { enabled: true, lang: 'ko' })).not.toThrow();
  });
});

describe('speak', () => {
  let synth: MockSynth;
  beforeEach(() => {
    synth = new MockSynth();
    installTts(synth);
  });

  it('does nothing when disabled', () => {
    speak('12행 5열, 볼록', { enabled: false, lang: 'ko' });
    expect(synth.queue).toHaveLength(0);
    expect(synth.cancelCalls).toBe(0);
  });

  it('sets the right BCP-47 language', () => {
    speak('row 1', { enabled: true, lang: 'en' });
    expect((synth.queue[0] as { lang: string }).lang).toBe('en-US');
    synth.cancel();
    speak('1행', { enabled: true, lang: 'ko' });
    expect((synth.queue[0] as { lang: string }).lang).toBe('ko-KR');
  });

  it('cancels before every speak so rapid movement never queues up', () => {
    for (let i = 0; i < 25; i++) {
      speak(`${i}행 1열, 오목`, { enabled: true, lang: 'ko' });
    }
    expect(synth.cancelCalls).toBe(25);
    expect(synth.maxPending).toBe(1); // never more than one pending utterance
    expect(synth.queue).toHaveLength(1);
  });

  it('never throws if the browser blocks speech', () => {
    synth.throwOnSpeak = true;
    expect(() => speak('막힘', { enabled: true, lang: 'ko' })).not.toThrow();
  });
});
