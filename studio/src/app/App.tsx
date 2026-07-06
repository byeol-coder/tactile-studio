import { useEffect, useMemo, useReducer, useRef } from 'react';
import { AppContext, initialState, reducer } from './appState';
import { AppShell } from '../components/layout/AppShell';
import { parseContext, type PreviewState, type TactileStudioContext } from '../integration/context';
import { createBridge, type StudioBridge } from '../integration/bridge';
import { parseTactileLayer } from '../integration/tactileLayer';
import { resolveContextLoad } from '../integration/load';
import { fetchImageFile, isAllowedImageSource } from '../image/loadSource';
import { planTemplateLoad } from '../templates/load';
import { onActivation, setActivationContext } from '../analytics/activation';
import { A11Y } from '../i18n/messages';
import type { CanvasStatus } from '../types/tactile';

/** Map the internal canvas status onto the hub-facing workflow state (§B). */
const PREVIEW_STATE: Partial<Record<CanvasStatus, PreviewState>> = {
  converting: 'converting',
  converted: 'reviewing',
  'send-ready': 'reviewing',
  sending: 'reviewing',
  sent: 'ready',
};

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const store = useMemo(() => ({ state, dispatch }), [state]);
  const bridgeRef = useRef<StudioBridge | null>(null);
  const lastPreview = useRef<PreviewState | null>(null);
  const loadedSig = useRef<string | null>(null);

  // Spec §B/§6: inherit the entry context from the query string on mount, and —
  // when embedded — open the live postMessage bridge to the Tactile World hub.
  useEffect(() => {
    const applyContext = (ctx: TactileStudioContext) => {
      dispatch({ type: 'context/apply', context: ctx });
      // Feed the activation metric (spec §C) its entry source/template.
      setActivationContext({ sourceType: ctx.sourceType ?? 'blank', templateId: ctx.templateId });
    };

    const ctx = parseContext(window.location.search);
    applyContext(ctx);

    const embedded = ctx.embed === true || (typeof window !== 'undefined' && window.parent !== window);
    if (!embedded) return;

    const bridge = createBridge({ parentOrigin: ctx.parentOrigin, onContext: applyContext });
    bridgeRef.current = bridge;
    bridge.ready(); // handshake: request context from the parent
    const unsubscribe = onActivation((event) => bridge.postActivation(event));
    return () => {
      unsubscribe();
      bridge.dispose();
      bridgeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Integration: load whatever the entry context provides (query or bridge),
  // by priority: tactileLayer > backgroundImage > templateId > blank. Each path
  // is validated, then routed through the same canonical document-load /
  // image-import path as manual use. Deduped by a load signature so a repeated
  // context (bridge re-send) doesn't reload. Standalone (no fields) → blank.
  useEffect(() => {
    const ctx = state.context;
    const s = A11Y[state.language];
    const load = resolveContextLoad(ctx);
    const sig = JSON.stringify(load);
    if (sig === loadedSig.current) return;
    loadedSig.current = sig;
    let cancelled = false;

    if (load.kind === 'layer') {
      const doc = parseTactileLayer(load.layer);
      if (doc) dispatch({ type: 'convert/done', document: doc });
      else dispatch({ type: 'import/error', message: s.loadLayerError });
    } else if (load.kind === 'image') {
      if (!isAllowedImageSource(load.src)) {
        dispatch({ type: 'import/error', message: s.loadImageError });
      } else {
        fetchImageFile(load.src)
          .then((file) => !cancelled && dispatch({ type: 'import/start', name: file.name, file }))
          .catch(() => !cancelled && dispatch({ type: 'import/error', message: s.loadImageError }));
      }
    } else if (load.kind === 'template') {
      // A conversion-preset templateId arms the image pipeline (no cells); every
      // other template becomes a document. Same decision as the empty-state picker.
      const plan = planTemplateLoad(load.templateId, ctx.gridSize, state.language);
      if (plan.kind === 'document') dispatch({ type: 'convert/done', document: plan.document });
      else if (plan.kind === 'preset') dispatch({ type: 'preset/arm', preset: plan.preset });
      else dispatch({ type: 'import/error', message: s.templateLoadError });
    }
    return () => {
      cancelled = true;
    };
  }, [state.context, state.language]);

  // Spec §6: mirror workflow progress to the hub; signal completion on send.
  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    const next = PREVIEW_STATE[state.canvasStatus] ?? 'draft';
    if (next === lastPreview.current) return;
    lastPreview.current = next;
    bridge.postStatus(next);
    if (next === 'ready') {
      bridge.postComplete({ returnUrl: state.context.returnUrl, assetId: state.context.assetId });
    }
  }, [state.canvasStatus, state.context.returnUrl, state.context.assetId]);

  return (
    <AppContext.Provider value={store}>
      <AppShell />
      {/* Single polite live region for screen-reader status announcements. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {state.announcement}
      </div>
    </AppContext.Provider>
  );
}
