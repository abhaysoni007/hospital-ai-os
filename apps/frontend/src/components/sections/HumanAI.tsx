'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function HumanAISection() {
  const sectionRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Split entry — left from left, right from right
      gsap.fromTo(
        leftRef.current,
        { x: '-8%', opacity: 0 },
        {
          x: '0%',
          opacity: 1,
          duration: 1.2,
          ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 65%' },
        }
      );

      gsap.fromTo(
        rightRef.current,
        { x: '8%', opacity: 0 },
        {
          x: '0%',
          opacity: 1,
          duration: 1.2,
          ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 65%' },
          delay: 0.1,
        }
      );

      // Divider fades and converges
      gsap.fromTo(
        dividerRef.current,
        { scaleY: 0 },
        {
          scaleY: 1,
          duration: 1,
          ease: 'power4.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 60%' },
        }
      );

      // Headline
      if (headRef.current) {
        const headInner = headRef.current.querySelectorAll('.m-reveal-inner');
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
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="about"
      className="m-section"
      style={{
        background: 'var(--m-bg-mid)',
        padding: 'clamp(8rem, 18vh, 18rem) 0',
      }}
      aria-label="Human and AI partnership"
    >
      <div className="m-container">
        <div className="m-label m-label-accent" style={{ marginBottom: '4rem' }}>
          08 / Human + AI
        </div>

        <h2
          ref={headRef}
          className="m-section-head"
          style={{ marginBottom: 'clamp(5rem, 10vh, 10rem)', maxWidth: '24ch' }}
        >
          <div className="m-reveal-mask"><span className="m-reveal-inner">Intelligence that</span></div>
          <div className="m-reveal-mask"><span className="m-reveal-inner">works with</span></div>
          <div className="m-reveal-mask"><span className="m-reveal-inner" style={{ color: 'var(--m-accent-light)' }}>people.</span></div>
        </h2>

        {/* Split panel */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1px 1fr',
            gap: '0',
            alignItems: 'start',
          }}
        >
          {/* Left — Human */}
          <div ref={leftRef} style={{ paddingRight: 'clamp(2rem, 5vw, 6rem)', opacity: 0 }}>
            <div
              style={{
                fontFamily: 'var(--m-font-label)',
                fontSize: '0.65rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--m-text-tertiary)',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <span style={{ width: '2rem', height: '1px', background: 'var(--m-line-strong)', display: 'inline-block' }} />
              CLINICAL EXPERTISE
            </div>

            <div
              style={{
                fontFamily: 'var(--m-font-display)',
                fontSize: 'clamp(1.5rem, 3vw, 3.5rem)',
                fontWeight: 600,
                color: 'var(--m-text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: '2rem',
                lineHeight: 1.1,
              }}
            >
              The clinician
              <br />
              decides.
            </div>

            <p className="m-body">
              MEDORA augments clinical judgment — it does not replace it. The
              system surfaces what matters, when it matters, without
              interrupting the human relationship at the center of care.
            </p>

            {/* Attributes */}
            {['Contextual awareness', 'Non-intrusive support', 'Clinician-first design'].map((item) => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginTop: '1.5rem',
                  fontFamily: 'var(--m-font-label)',
                  fontSize: '0.7rem',
                  letterSpacing: '0.08em',
                  color: 'var(--m-text-secondary)',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--m-accent)', flexShrink: 0 }} />
                {item.toUpperCase()}
              </div>
            ))}
          </div>

          {/* Divider */}
          <div
            ref={dividerRef}
            style={{
              background: 'var(--m-line-strong)',
              height: '100%',
              minHeight: '400px',
              transformOrigin: 'top',
              transform: 'scaleY(0)',
            }}
          />

          {/* Right — AI */}
          <div ref={rightRef} style={{ paddingLeft: 'clamp(2rem, 5vw, 6rem)', opacity: 0 }}>
            <div
              style={{
                fontFamily: 'var(--m-font-label)',
                fontSize: '0.65rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--m-text-tertiary)',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <span style={{ width: '2rem', height: '1px', background: 'var(--m-line-strong)', display: 'inline-block' }} />
              MACHINE INTELLIGENCE
            </div>

            <div
              style={{
                fontFamily: 'var(--m-font-display)',
                fontSize: 'clamp(1.5rem, 3vw, 3.5rem)',
                fontWeight: 600,
                color: 'var(--m-accent-light)',
                letterSpacing: '-0.02em',
                marginBottom: '2rem',
                lineHeight: 1.1,
              }}
            >
              MEDORA
              <br />
              synthesizes.
            </div>

            <p className="m-body">
              Across thousands of simultaneous signals — clinical, diagnostic,
              operational, and historical — MEDORA maintains coherence so
              clinical teams can focus on what only humans can do.
            </p>

            {/* Attributes */}
            {['Cross-system synthesis', 'Real-time signal processing', 'Adaptive to context'].map((item) => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginTop: '1.5rem',
                  fontFamily: 'var(--m-font-label)',
                  fontSize: '0.7rem',
                  letterSpacing: '0.08em',
                  color: 'var(--m-text-secondary)',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--m-accent-light)', flexShrink: 0 }} />
                {item.toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
