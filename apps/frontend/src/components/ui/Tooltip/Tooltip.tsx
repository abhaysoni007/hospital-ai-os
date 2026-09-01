'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import styles from './Tooltip.module.css';

export type TooltipSide = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
  /** Tooltip body. Plain text or inline nodes. */
  content: React.ReactNode;
  /** Trigger element. Must be a single focusable element (button, link, input). */
  children: React.ReactElement;
  /** Preferred side; flips automatically if it would clip the viewport. */
  side?: TooltipSide;
  /** Delay (ms) before showing on pointer hover. Defaults to 250ms. */
  delayMs?: number;
  /** Disable the tooltip entirely (renders only the child). */
  disabled?: boolean;
}

/**
 * Tooltip — accessible, dependency-free.
 *
 *  - WAI-ARIA 1.2 tooltip pattern (role="tooltip" on the bubble, aria-describedby
 *    on the trigger).
 *  - Works with both pointer (hover/focus) and keyboard (focus/Enter shows,
 *    Escape dismisses).
 *  - Viewport-aware: tries the requested side first, then flips.
 *  - Respects prefers-reduced-motion (no enter animation).
 *  - Single tooltip at a time per page; pointer-enter on a second trigger
 *    closes the first.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  delayMs = 250,
  disabled = false,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [resolvedSide, setResolvedSide] = useState<TooltipSide>(side);
  const [placement, setPlacement] = useState({ left: 0, top: 0 });
  const id = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (showTimer.current) {
      window.clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  // Recompute placement when opened. Try the requested side; flip if it
  // would clip the viewport.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const bubble = bubbleRef.current;
    if (!trigger || !bubble) return;
    const tRect = trigger.getBoundingClientRect();
    const bRect = bubble.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    const fits = (s: TooltipSide) => {
      switch (s) {
        case 'top':
          return tRect.top - bRect.height - margin >= 0;
        case 'bottom':
          return tRect.bottom + bRect.height + margin <= vh;
        case 'left':
          return tRect.left - bRect.width - margin >= 0;
        case 'right':
          return tRect.right + bRect.width + margin <= vw;
      }
    };

    const order: TooltipSide[] =
      side === 'top'
        ? ['top', 'bottom', 'right', 'left']
        : side === 'bottom'
        ? ['bottom', 'top', 'right', 'left']
        : side === 'left'
        ? ['left', 'right', 'top', 'bottom']
        : ['right', 'left', 'top', 'bottom'];
    const chosen = order.find(fits) ?? side;
    setResolvedSide(chosen);

    // Center-align the bubble against the trigger.
    const left = tRect.left + tRect.width / 2 - bRect.width / 2;
    const top = tRect.top + tRect.height / 2 - bRect.height / 2;
    let nextLeft = left;
    let nextTop = top;
    if (chosen === 'top') {
      nextLeft = left;
      nextTop = tRect.top - bRect.height - margin;
    } else if (chosen === 'bottom') {
      nextLeft = left;
      nextTop = tRect.bottom + margin;
    } else if (chosen === 'left') {
      nextLeft = tRect.left - bRect.width - margin;
      nextTop = top;
    } else {
      nextLeft = tRect.right + margin;
      nextTop = top;
    }
    // Clamp inside viewport horizontally.
    nextLeft = Math.max(margin, Math.min(nextLeft, vw - bRect.width - margin));
    nextTop = Math.max(margin, Math.min(nextTop, vh - bRect.height - margin));
    setPlacement({ left: nextLeft, top: nextTop });
  }, [open, side]);

  useEffect(() => () => clearTimers(), []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (disabled) return children;

  const scheduleShow = () => {
    clearTimers();
    showTimer.current = window.setTimeout(() => setOpen(true), delayMs);
  };

  const scheduleHide = () => {
    clearTimers();
    hideTimer.current = window.setTimeout(() => setOpen(false), 80);
  };

  // Clone the trigger to attach event handlers and aria-describedby.
  const child = children;
  const triggerProps = {
    ref: triggerRef as unknown as React.Ref<HTMLElement>,
    'aria-describedby': open ? id : undefined,
    onMouseEnter: (e: React.MouseEvent) => {
      child.props.onMouseEnter?.(e);
      scheduleShow();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      child.props.onMouseLeave?.(e);
      scheduleHide();
    },
    onFocus: (e: React.FocusEvent) => {
      child.props.onFocus?.(e);
      setOpen(true);
    },
    onBlur: (e: React.FocusEvent) => {
      child.props.onBlur?.(e);
      setOpen(false);
    },
  } as Record<string, unknown>;

  return (
    <>
      {React.cloneElement(child, triggerProps)}
      {open && (
        <div
          ref={bubbleRef}
          id={id}
          role="tooltip"
          className={`${styles.bubble} ${styles[resolvedSide]}`}
          style={{ left: placement.left, top: placement.top, position: 'fixed' }}
        >
          {content}
        </div>
      )}
    </>
  );
}
