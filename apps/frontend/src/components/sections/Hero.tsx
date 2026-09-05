'use client';

import { useEffect, useRef, lazy, Suspense } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Lazy load the heavy 3D component
const MedoraCore = lazy(() => import('../three/MedoraCore'));

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const scrollIndRef = useRef<HTMLDivElement>(null);
  const coreWrapRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.2 });

      // Hero entrance
      tl.fromTo(
        headlineRef.current,
        { y: 80, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.4, ease: 'power4.out' }
      )
        .fromTo(
          subRef.current,
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, ease: 'power3.out' },
          '-=0.8'
        )
        .fromTo(
          scrollIndRef.current,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out' },
          '-=0.5'
        )
        .fromTo(
          coreWrapRef.current,
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: 1.8, ease: 'power2.out' },
          0.4
        );

      // Scroll choreography
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=300%',
          scrub: 1.2,
          pin: true,
          anticipatePin: 1,
        },
      });

      // Phase 2: headline starts moving
      scrollTl
        .to(headlineRef.current, {
          y: '-15vh',
          opacity: 0.7,
          scale: 0.95,
          duration: 0.3,
        })
        // Phase 3: 3D core becomes dominant
        .to(
          coreWrapRef.current,
          {
            scale: 1.15,
            opacity: 1,
            duration: 0.3,
          },
          '<'
        )
        // Phase 4: typography separates
        .to(headlineRef.current, {
          x: '-8vw',
          opacity: 0.5,
          duration: 0.3,
        })
        // Phase 5: camera through object (simulated via scale)
        .to(
          coreWrapRef.current,
          {
            scale: 1.4,
            opacity: 0.8,
            duration: 0.3,
          },
          '<'
        )
        // Phase 6: transition out
        .to([headlineRef.current, subRef.current, scrollIndRef.current, coreWrapRef.current], {
          opacity: 0,
          duration: 0.15,
        });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="m-section m-vh"
      style={{
        background: 'var(--m-bg-void)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        overflow: 'hidden',
      }}
      aria-label="MEDORA Hero"
    >
      {/* 3D Core — fills right half + bleeds into center */}
      <div
        ref={coreWrapRef}
        className="m-canvas-wrapper"
        style={{
          position: 'absolute',
          top: '-10%',
          right: '-10%',
          width: '75%',
          height: '120%',
          zIndex: 1,
          opacity: 0,
        }}
      >
        <Suspense fallback={null}>
          <MedoraCore
            style={{ width: '100%', height: '100%' }}
          />
        </Suspense>
      </div>

      {/* Gradient scrim over 3D so text is readable */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(105deg, var(--m-bg-void) 35%, rgba(6,10,16,0.6) 60%, transparent 80%)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <div
        className="m-container"
        style={{
          position: 'relative',
          zIndex: 3,
          paddingBottom: 'clamp(5rem, 10vh, 8rem)',
        }}
      >
        {/* Top label */}
        <div ref={labelRef} className="m-label m-label-accent" style={{ marginBottom: '2rem' }}>
          Intelligent Healthcare System
        </div>

        {/* Main headline */}
        <h1
          ref={headlineRef}
          className="m-hero-type"
          style={{
            maxWidth: '100%',
            opacity: 0,
            willChange: 'transform, opacity',
          }}
        >
          MEDORA
        </h1>

        {/* Subtitle */}
        <p
          ref={subRef}
          style={{
            fontFamily: 'var(--m-font-body)',
            fontSize: 'clamp(0.9rem, 1.8vw, 1.25rem)',
            fontWeight: 300,
            color: 'var(--m-text-secondary)',
            letterSpacing: '0.01em',
            lineHeight: 1.6,
            marginTop: '2rem',
            maxWidth: '42ch',
            opacity: 0,
            willChange: 'transform, opacity',
          }}
        >
          The intelligent operating system
          <br />
          for modern healthcare.
        </p>
      </div>

      {/* Bottom edge — scroll indicator + section label */}
      <div
        style={{
          position: 'absolute',
          bottom: 'clamp(1.5rem, 3vh, 3rem)',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          padding: '0 clamp(1.5rem, 4vw, 5rem)',
          zIndex: 4,
        }}
      >
        {/* Scroll indicator */}
        <div
          ref={scrollIndRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            opacity: 0,
          }}
        >
          <div
            style={{
              width: '1px',
              height: '48px',
              background: 'var(--m-line-strong)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '40%',
                background: 'var(--m-accent-light)',
                animation: 'scrollLine 2s ease-in-out infinite',
              }}
            />
          </div>
          <span className="m-label" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
            SCROLL
          </span>
        </div>

        {/* Section label */}
        <span className="m-label">01 / HERO</span>
      </div>

      {/* Scroll line animation */}
      <style>{`
        @keyframes scrollLine {
          0% { top: -40%; }
          100% { top: 100%; }
        }
      `}</style>
    </section>
  );
}
