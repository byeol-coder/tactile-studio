// src/ui/recovery/RecoveryBanner.tsx
//
// Verbatim-intent port of the monolith's recovery banner (the
// `sc-if value="{{ recoverOffer }}"` block: a dark pill, top-center,
// "recover" + "dismiss" buttons). Renders nothing unless
// snapshot.recoverOffer is true. Every action also calls store.announce()
// with host-labeled text for the live region, matching the rest of this UI
// layer's convention (core never generates the message text itself).

import React from 'react';
import { useEditorStore } from '../../react/hooks/useEditorStore.js';
import type { StudioLabels } from '../../react/types/public-api.js';

export interface RecoveryBannerProps {
  labels?: StudioLabels;
}

export function RecoveryBanner({ labels }: RecoveryBannerProps) {
  const { snapshot, store } = useEditorStore();
  if (!snapshot.recoverOffer) return null;

  const title = (labels?.recoverTitle as string) || 'Unsaved work found';
  const sub = (labels?.recoverSub as string) || 'Restore your previous session?';
  const recoverLabel = (labels?.recoverBtn as string) || 'Restore';
  const dismissLabel = (labels?.recoverDismissL as string) || 'Discard';
  const recoveredMsg = (labels?.aRecovered as string) || 'Previous session restored.';

  const doRecover = () => store.restoreSession(recoveredMsg);
  const doDismiss = () => { void store.dismissRecovery(); };

  return (
    <div
      role="status"
      style={{
        // NOTE: the monolith uses position:absolute inside its own
        // known-relative canvas container. This component is meant to be
        // embedded inside an arbitrary host layout, so `fixed` (viewport-
        // relative) is used instead — it doesn't depend on the host wrapping
        // this in a position:relative ancestor. Visually identical when the
        // editor fills the viewport.
        position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 22,
        maxWidth: 560, display: 'flex', alignItems: 'center', gap: 11,
        background: '#1E1C1A', color: '#fff', borderRadius: 10, padding: '11px 12px 11px 14px',
        boxShadow: '0 8px 8px -4px rgba(10,13,18,0.04), 0 20px 24px -4px rgba(10,13,18,0.08)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 26, height: 26, borderRadius: 8, background: 'rgba(196,61,0,0.22)',
          display: 'grid', placeItems: 'center', color: 'var(--ts-primary, #C43D00)', flex: 'none',
        }}
      >
        <svg width={15} height={15} viewBox="0 0 24 24">
          <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.35, minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: 'rgba(255,255,255,0.72)' }}>{sub}</span>
      </span>
      <button
        type="button"
        onClick={doRecover}
        style={{
          flex: 'none', height: 32, padding: '0 14px', border: 'none', borderRadius: 8,
          background: 'var(--ts-primary, #C43D00)', color: '#fff', fontWeight: 800, fontSize: 12.5,
          cursor: 'pointer', marginLeft: 4,
        }}
      >
        {recoverLabel}
      </button>
      <button
        type="button"
        onClick={doDismiss}
        style={{
          flex: 'none', height: 32, padding: '0 12px', border: '1px solid rgba(255,255,255,0.28)',
          borderRadius: 8, background: 'transparent', color: '#fff', fontWeight: 700, fontSize: 12.5,
          cursor: 'pointer',
        }}
      >
        {dismissLabel}
      </button>
    </div>
  );
}
