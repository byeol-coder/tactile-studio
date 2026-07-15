// src/ui/tooltip/Tooltip.tsx
//
// Verbatim port of the monolith's showTip()/hideTip() custom tooltip
// positioning (not a native title="" attribute): a small fixed-position
// bubble, placed above the trigger by default, flipping to below when
// there's no room above (r.top < 60) or flipping back when 'bottom' would
// overflow the viewport bottom. Delayed show (320ms on hover, 90ms on
// keyboard focus — "focusFast"), immediate hide, horizontally clamped so
// the bubble never runs off-screen.
//
// Wraps a single focusable child (typically an IconButton) and manages its
// own hover/focus state — no shared context needed since only one tooltip
// is ever visible at a time in practice.

import React, { useRef, useState, useCallback, cloneElement, isValidElement } from 'react';

export interface TooltipProps {
  label: string;
  keyHint?: string;
  desc?: string;
  place?: 'top' | 'bottom';
  children: React.ReactElement;
}

interface TipState {
  label: string;
  key: string;
  desc: string;
  top: number;
  left: number;
  place: 'top' | 'bottom';
}

const SHOW_DELAY_HOVER = 320;
const SHOW_DELAY_FOCUS = 90;

export function Tooltip({ label, keyHint = '', desc = '', place: placeProp = 'top', children }: TooltipProps) {
  const [tip, setTip] = useState<TipState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((el: HTMLElement, focusFast: boolean) => {
    const r = el.getBoundingClientRect();
    let place = placeProp;
    if (place === 'top' && r.top < 60) place = 'bottom';
    else if (place === 'bottom' && r.bottom > window.innerHeight - 60) place = 'top';
    const top = place === 'bottom' ? r.bottom + 10 : r.top - 10;
    const left = Math.max(70, Math.min(r.left + r.width / 2, window.innerWidth - 70));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setTip({ label, key: keyHint, desc, top, left, place }), focusFast ? SHOW_DELAY_FOCUS : SHOW_DELAY_HOVER);
  }, [label, keyHint, desc, placeProp]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTip(null);
  }, []);

  if (!isValidElement(children)) return children;

  const child = cloneElement(children as React.ReactElement<any>, {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { (children.props as any).onMouseEnter?.(e); show(e.currentTarget, false); },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { (children.props as any).onMouseLeave?.(e); hide(); },
    onFocus: (e: React.FocusEvent<HTMLElement>) => { (children.props as any).onFocus?.(e); show(e.currentTarget, true); },
    onBlur: (e: React.FocusEvent<HTMLElement>) => { (children.props as any).onBlur?.(e); hide(); },
    title: undefined, // suppress the native tooltip — this custom bubble replaces it
  });

  return (
    <>
      {child}
      {tip && (
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            top: tip.top,
            left: tip.left,
            transform: tip.place === 'bottom' ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            zIndex: 200,
            pointerEvents: 'none',
            background: 'var(--ts-ink, #1E1C1A)',
            color: '#FFFFFF',
            fontSize: 12,
            padding: '4px 8px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            maxWidth: 220,
          }}
        >
          {tip.label}{tip.key ? ` (${tip.key})` : ''}
          {tip.desc && <div style={{ opacity: 0.8, fontWeight: 400, whiteSpace: 'normal' }}>{tip.desc}</div>}
        </div>
      )}
    </>
  );
}
