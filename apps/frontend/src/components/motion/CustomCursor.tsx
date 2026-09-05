'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';

interface CursorState {
  label: string;
  isLink: boolean;
  is3D: boolean;
  isDrag: boolean;
}

/**
 * CustomCursor — Premium desktop cursor with inertia, outer ring,
 * magnetic behavior on CTAs, and contextual labels.
 * Automatically hidden on touch devices.
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<CursorState>({
    label: '',
    isLink: false,
    is3D: false,
    isDrag: false,
  });

  const posRef = useRef({ x: 0, y: 0 });


  const updateState = useCallback(() => {}, []);

  useEffect(() => {
    // Only enable on pointer devices
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!mediaQuery.matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let animFrame: number;
    let ringX = 0;
    let ringY = 0;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    function onMouseMove(e: MouseEvent) {
      posRef.current = { x: e.clientX, y: e.clientY };
      if (!visible) setVisible(true);

      // Dot follows cursor instantly
      gsap.set(dot, { x: e.clientX, y: e.clientY });
    }

    function animateRing() {
      ringX = lerp(ringX, posRef.current.x, 0.12);
      ringY = lerp(ringY, posRef.current.y, 0.12);
      gsap.set(ring, { x: ringX, y: ringY });
      animFrame = requestAnimationFrame(animateRing);
    }

    function onMouseOver(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const link = target.closest('a, button, [data-cursor]');
      if (link) {
        const label = link.getAttribute('data-cursor-label') || '';
        const is3D = link.hasAttribute('data-cursor-3d');
        setState({ label, isLink: true, is3D, isDrag: false });
        gsap.to(ring, {
          scale: label ? 1.8 : 1.5,
          duration: 0.3,
          ease: 'power2.out',
        });
      }
    }

    function onMouseOut(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const link = target.closest('a, button, [data-cursor]');
      if (link) {
        setState({ label: '', isLink: false, is3D: false, isDrag: false });
        gsap.to(ring, { scale: 1, duration: 0.3, ease: 'power2.out' });
      }
    }

    function onMouseLeave() {
      setVisible(false);
    }

    function onMouseEnter() {
      setVisible(true);
    }

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseover', onMouseOver, { passive: true });
    document.addEventListener('mouseout', onMouseOut, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave, { passive: true });
    document.addEventListener('mouseenter', onMouseEnter, { passive: true });

    animFrame = requestAnimationFrame(animateRing);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseover', onMouseOver);
      document.removeEventListener('mouseout', onMouseOut);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
      cancelAnimationFrame(animFrame);
    };
  }, [visible, updateState]);

  // Magnetic effect for CTAs
  useEffect(() => {
    const magnetics = document.querySelectorAll('[data-magnetic]');

    const handlers: Array<{ el: Element; move: (e: MouseEvent) => void; leave: () => void }> = [];

    magnetics.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const strength = parseFloat(htmlEl.dataset.magnetic || '0.3');

      function onMove(e: MouseEvent) {
        const rect = htmlEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) * strength;
        const dy = (e.clientY - cy) * strength;
        gsap.to(htmlEl, { x: dx, y: dy, duration: 0.3, ease: 'power2.out' });
      }

      function onLeave() {
        gsap.to(htmlEl, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      }

      htmlEl.addEventListener('mousemove', onMove);
      htmlEl.addEventListener('mouseleave', onLeave);
      handlers.push({ el, move: onMove, leave: onLeave });
    });

    return () => {
      handlers.forEach(({ el, move, leave }) => {
        el.removeEventListener('mousemove', move);
        el.removeEventListener('mouseleave', leave);
      });
    };
  }, []);

  return (
    <>
      {/* Dot */}
      <div
        ref={dotRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: 'var(--m-text-primary)',
          pointerEvents: 'none',
          zIndex: 'var(--m-z-cursor)' as unknown as number,
          transform: 'translate(-50%, -50%)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s',
          mixBlendMode: 'difference',
        }}
      />

      {/* Ring */}
      <div
        ref={ringRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '1px solid rgba(240, 244, 240, 0.4)',
          pointerEvents: 'none',
          zIndex: 9998,
          transform: 'translate(-50%, -50%)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {state.label && (
          <span
            ref={labelRef}
            style={{
              fontFamily: 'var(--m-font-label)',
              fontSize: '9px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              color: 'var(--m-text-primary)',
              whiteSpace: 'nowrap',
              position: 'absolute',
              top: '110%',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            {state.label}
          </span>
        )}
      </div>
    </>
  );
}
