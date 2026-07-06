import { describe, expect, it, vi } from 'vitest';
import { createBridge, type BridgeHost } from '../bridge';
import type { TactileStudioContext } from '../context';

const PARENT = 'https://tactileworld.org';

/** A fake host that captures posts and lets us fire inbound messages. */
function fakeHost() {
  let listener: ((e: MessageEvent) => void) | null = null;
  const posts: { message: unknown; targetOrigin: string }[] = [];
  const host: BridgeHost = {
    addEventListener: (_t, l) => {
      listener = l;
    },
    removeEventListener: (_t, l) => {
      if (listener === l) listener = null;
    },
    postToParent: (message, targetOrigin) => posts.push({ message, targetOrigin }),
  };
  const fire = (origin: string, data: unknown) => listener?.({ origin, data } as MessageEvent);
  return { host, posts, fire, hasListener: () => listener !== null };
}

function ctxMessage(context: TactileStudioContext) {
  return { type: 'tactile-studio/context', context };
}

describe('createBridge — inbound context', () => {
  it('applies context from the allowlisted parent origin', () => {
    const onContext = vi.fn();
    const { host, fire } = fakeHost();
    createBridge({ parentOrigin: PARENT, onContext, host });
    fire(PARENT, ctxMessage({ lang: 'en', sourceType: 'library' }));
    expect(onContext).toHaveBeenCalledWith({ lang: 'en', sourceType: 'library' });
  });

  it('ignores messages from a non-allowlisted origin', () => {
    const onContext = vi.fn();
    const { host, fire } = fakeHost();
    createBridge({ parentOrigin: PARENT, onContext, host });
    fire('https://evil.example', ctxMessage({ lang: 'en' }));
    expect(onContext).not.toHaveBeenCalled();
  });

  it('ignores an allowlisted origin that is not the declared parent', () => {
    const onContext = vi.fn();
    const { host, fire } = fakeHost();
    // parent is byeol-coder; a message from tactileworld (also allowlisted) is rejected
    createBridge({ parentOrigin: 'https://byeol-coder.github.io', onContext, host });
    fire(PARENT, ctxMessage({ lang: 'ko' }));
    expect(onContext).not.toHaveBeenCalled();
  });

  it('ignores non-context payloads', () => {
    const onContext = vi.fn();
    const { host, fire } = fakeHost();
    createBridge({ parentOrigin: PARENT, onContext, host });
    fire(PARENT, { type: 'something-else' });
    expect(onContext).not.toHaveBeenCalled();
  });
});

describe('createBridge — outbound', () => {
  it('posts ready/status/activation/complete only to the parent origin', () => {
    const { host, posts } = fakeHost();
    const bridge = createBridge({ parentOrigin: PARENT, onContext: () => {}, host });
    expect(bridge.canPost).toBe(true);
    bridge.ready();
    bridge.postStatus('reviewing');
    bridge.postComplete({ returnUrl: 'https://tactileworld.org/hub', assetId: 'a1' });
    expect(posts).toHaveLength(3);
    expect(posts.every((p) => p.targetOrigin === PARENT)).toBe(true);
    expect(posts[0].message).toEqual({ type: 'tactile-studio/ready' });
    expect(posts[1].message).toEqual({ type: 'tactile-studio/status', state: 'reviewing' });
    expect(posts[2].message).toMatchObject({ type: 'tactile-studio/complete', returnUrl: 'https://tactileworld.org/hub', assetId: 'a1' });
  });

  it('never posts when the parent origin is not allowlisted', () => {
    const { host, posts } = fakeHost();
    const bridge = createBridge({ parentOrigin: 'https://evil.example', onContext: () => {}, host });
    expect(bridge.canPost).toBe(false);
    bridge.ready();
    bridge.postStatus('ready');
    expect(posts).toHaveLength(0);
  });

  it('still listens for context even without a postable parent', () => {
    const onContext = vi.fn();
    const { host, fire } = fakeHost();
    createBridge({ onContext, host }); // no parentOrigin
    fire(PARENT, ctxMessage({ lang: 'en' })); // allowlisted origin
    expect(onContext).toHaveBeenCalledWith({ lang: 'en' });
  });
});

describe('createBridge — dispose', () => {
  it('removes the message listener', () => {
    const onContext = vi.fn();
    const { host, fire, hasListener } = fakeHost();
    const bridge = createBridge({ parentOrigin: PARENT, onContext, host });
    expect(hasListener()).toBe(true);
    bridge.dispose();
    expect(hasListener()).toBe(false);
    fire(PARENT, ctxMessage({ lang: 'en' }));
    expect(onContext).not.toHaveBeenCalled();
  });
});
