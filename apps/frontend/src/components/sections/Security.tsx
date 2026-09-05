'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function SecuritySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const linesRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Slow grid reveal
      gsap.fromTo(
        gridRef.current,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 2,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%' },
        }
      );

      // Headline reveal
      const headInner = headRef.current ? Array.from(headRef.current.querySelectorAll('.m-reveal-inner')) : [];
      gsap.fromTo(
        headInner,
        { y: '105%' },
        {
          y: '0%',
          duration: 1.2,
          stagger: 0.1,
          ease: 'power4.out',
          scrollTrigger: { trigger: headRef.current, start: 'top 75%' },
        }
      );

      // Fact lines stagger
      gsap.fromTo(
        linesRef.current.filter(Boolean),
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: { trigger: linesRef.current[0], start: 'top 80%' },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const secFacts = [
    { label: 'ACCESS CONTROL', value: 'Role-based, context-aware' },
    { label: 'AUDIT', value: 'Complete clinical audit trails' },
    { label: 'ENCRYPTION', value: 'At rest and in transit' },
    { label: 'ARCHITECTURE', value: 'Security-first by design' },
  ];

  return (
    <section
      ref={sectionRef}
      id="security"
      className="m-section"
      style={{
        background: 'var(--m-bg-void)',
        padding: 'clamp(8rem, 18vh, 18rem) 0',
        position: 'relative',
        overflow: 'hidden',
      }}
      aria-label="Security"
    >
      {/* Animated geometric grid background */}
      <div
        ref={gridRef}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(61,122,92,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(61,122,92,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          opacity: 0,
          zIndex: 0,
        }}
        aria-hidden="true"
      />

      {/* Corner decorations */}
      {[
        { top: '10%', left: '5%' },
        { top: '10%', right: '5%' },
        { bottom: '10%', left: '5%' },
        { bottom: '10%', right: '5%' },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...pos,
            width: '40px',
            height: '40px',
            borderTop: i < 2 ? '1px solid var(--m-accent-dim)' : 'none',
            borderBottom: i >= 2 ? '1px solid var(--m-accent-dim)' : 'none',
            borderLeft: i % 2 === 0 ? '1px solid var(--m-accent-dim)' : 'none',
            borderRight: i % 2 === 1 ? '1px solid var(--m-accent-dim)' : 'none',
            zIndex: 1,
          }}
          aria-hidden="true"
        />
      ))}

      <div className="m-container" style={{ position: 'relative', zIndex: 2 }}>
        <div className="m-label m-label-accent" style={{ marginBottom: '4rem' }}>
          07 / Security
        </div>

        <h2
          ref={headRef}
          className="m-section-head"
          style={{ marginBottom: 'clamp(4rem, 8vh, 8rem)', maxWidth: '18ch' }}
        >
          <div className="m-reveal-mask"><span className="m-reveal-inner">Built for</span></div>
          <div className="m-reveal-mask"><span className="m-reveal-inner" style={{ color: 'var(--m-accent-light)' }}>trust.</span></div>
        </h2>

        <p
          className="m-body"
          style={{
            maxWidth: '55ch',
            marginBottom: 'clamp(4rem, 8vh, 8rem)',
            borderLeft: '2px solid var(--m-accent-dim)',
            paddingLeft: '2rem',
          }}
        >
          Security is not a feature in MEDORA. It is the architecture. Every
          access point, every data flow, every clinical interaction is governed
          by a security model designed for the highest-stakes environment in
          software — healthcare.
        </p>

        {/* Fact grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0' }}>
          {secFacts.map((fact, i) => (
            <div
              key={fact.label}
              ref={(el) => {
                linesRef.current[i] = el;
              }}
              style={{
                padding: '2rem',
                borderTop: '1px solid var(--m-line)',
                borderRight: i < secFacts.length - 1 ? '1px solid var(--m-line)' : 'none',
              }}
            >
              <div className="m-label" style={{ color: 'var(--m-text-tertiary)', marginBottom: '1rem' }}>
                {fact.label}
              </div>
              <div
                style={{
                  fontFamily: 'var(--m-font-body)',
                  fontSize: '1rem',
                  fontWeight: 400,
                  color: 'var(--m-text-primary)',
                }}
              >
                {fact.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
