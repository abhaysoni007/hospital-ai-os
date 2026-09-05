'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * LoadingScreen — Branded MEDORA character reveal sequence:
 * M → ME → MED → MEDO → MEDOR → MEDORA
 * Short (≈1.8s), non-blocking, respects reduced motion.
 */
export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      onComplete();
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.to(containerRef.current, {
          opacity: 0,
          duration: 0.6,
          ease: 'power2.inOut',
          onComplete,
        });
      },
    });

    const chars = ['M', 'ME', 'MED', 'MEDO', 'MEDOR', 'MEDORA'];

    chars.forEach((text) => {
      tl.to(textRef.current, {
        duration: 0.18,
        ease: 'none',
        onStart: () => {
          if (textRef.current) textRef.current.textContent = text;
        },
      });
    });

    // Hold MEDORA briefly
    tl.to(textRef.current, { duration: 0.5 });

    // Animate the progress line
    gsap.to(lineRef.current, {
      scaleX: 1,
      duration: tl.duration() * 0.9,
      ease: 'power1.inOut',
    });

    return () => {
      tl.kill();
    };
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--m-bg-void)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3rem',
      }}
    >
      <span
        ref={textRef}
        style={{
          fontFamily: 'var(--m-font-display)',
          fontSize: 'clamp(3rem, 8vw, 8rem)',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: 'var(--m-text-primary)',
          display: 'block',
          minWidth: '6ch',
          textAlign: 'center',
        }}
      >
        M
      </span>

      {/* Progress bar */}
      <div
        style={{
          width: 'clamp(120px, 20vw, 200px)',
          height: '1px',
          background: 'var(--m-line-strong)',
          overflow: 'hidden',
        }}
      >
        <div
          ref={lineRef}
          style={{
            width: '100%',
            height: '100%',
            background: 'var(--m-accent-light)',
            transformOrigin: 'left',
            transform: 'scaleX(0)',
          }}
        />
      </div>

      {/* Label */}
      <span
        style={{
          position: 'absolute',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'var(--m-font-label)',
          fontSize: '0.65rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--m-text-tertiary)',
        }}
      >
        Initializing System
      </span>
    </div>
  );
}
