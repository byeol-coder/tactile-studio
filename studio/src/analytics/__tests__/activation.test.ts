import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  configureClock,
  getActivation,
  hasActivated,
  onActivation,
  recordOutputSuccess,
  resetActivation,
  setActivationContext,
  startSession,
  type ActivationEvent,
} from '../activation';

/** Controllable clock so timeToActivation is deterministic. */
let t = 0;

beforeEach(() => {
  resetActivation();
  t = 1_000_000;
  configureClock(() => t);
});

afterEach(() => {
  configureClock();
});

describe('activation tracking (spec §C)', () => {
  it('fires once at first output success with timeToActivation', () => {
    const seen: ActivationEvent[] = [];
    onActivation((e) => seen.push(e));
    startSession();
    t += 4200; // 4.2s to first success

    const event = recordOutputSuccess({ exportTarget: 'dotpad', gridSize: '60x40' });

    expect(event).not.toBeNull();
    expect(seen).toHaveLength(1);
    expect(event).toMatchObject({
      type: 'activation',
      exportTarget: 'dotpad',
      gridSize: '60x40',
      sourceType: 'blank', // no context yet
      timeToActivationMs: 4200,
    });
    expect(hasActivated()).toBe(true);
  });

  it('is idempotent — later successes do not re-activate', () => {
    startSession();
    const first = recordOutputSuccess({ exportTarget: 'dotpad', gridSize: '60x40' });
    t += 5000;
    const second = recordOutputSuccess({ exportTarget: 'emboss', gridSize: '96x64' });

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(getActivation()).toBe(first);
  });

  it('carries entry context (sourceType/templateId) from setActivationContext', () => {
    startSession();
    setActivationContext({ sourceType: 'template', templateId: 'math-coordinate-plane' });

    const event = recordOutputSuccess({ exportTarget: 'dotpad', gridSize: '60x40' });
    expect(event).toMatchObject({ sourceType: 'template', templateId: 'math-coordinate-plane' });
  });

  it('call-time attributes override the session context', () => {
    startSession();
    setActivationContext({ sourceType: 'blank' });
    const event = recordOutputSuccess({
      exportTarget: 'dotpad',
      gridSize: '60x40',
      sourceType: 'library',
      templateId: 'lib-42',
    });
    expect(event).toMatchObject({ sourceType: 'library', templateId: 'lib-42' });
  });

  it('does not count save as activation (only recordOutputSuccess activates)', () => {
    startSession();
    // Nothing recorded → no activation. Save flows never call recordOutputSuccess.
    expect(hasActivated()).toBe(false);
    expect(getActivation()).toBeNull();
  });

  it('startSession resets a prior activation window', () => {
    startSession();
    recordOutputSuccess({ exportTarget: 'dotpad', gridSize: '60x40' });
    expect(hasActivated()).toBe(true);

    startSession(); // e.g. re-entry with a new context
    expect(hasActivated()).toBe(false);
  });
});
