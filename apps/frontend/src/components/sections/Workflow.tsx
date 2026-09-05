'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  { code: 'ADMIT', num: '01', desc: 'Patient arrives. MEDORA immediately begins contextualizing their history, alerts, and care pathway.' },
  { code: 'UNDERSTAND', num: '02', desc: 'Clinical context assembles. Relevant history, diagnostics, and prior encounters surface automatically.' },
  { code: 'DIAGNOSE', num: '03', desc: 'Diagnostic intelligence connects clinical signals, lab data, and imaging into coherent clinical pictures.' },
  { code: 'DECIDE', num: '04', desc: 'Decision support surfaces without intrusion. The clinician decides. MEDORA ensures nothing is missed.' },
  { code: 'ACT', num: '05', desc: 'Orders, workflows, and care team coordination proceed with precision and minimal friction.' },
  { code: 'FOLLOW THROUGH', num: '06', desc: 'Discharge, monitoring, and follow-up are built into the care continuum — not bolted on afterward.' },
];

export default function WorkflowSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const track = trackRef.current;
      if (!track) return;

      // Horizontal pinned scroll
      const totalWidth = track.scrollWidth - window.innerWidth;

      gsap.to(track, {
        x: -totalWidth,
        ease: 'none',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: `+=${totalWidth + window.innerHeight}`,
          scrub: 1,
          pin: true,
          anticipatePin: 1,
        },
      });

      // Individual step reveals
      stepsRef.current.forEach((step) => {
        if (!step) return;
        const num = step.querySelector('.step-num');
        const code = step.querySelector('.step-code');
        const desc = step.querySelector('.step-desc');
        const line = step.querySelector('.step-line');

        gsap.fromTo(
          [line, num, code, desc],
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.08,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: step,
              start: 'left 70%',
              containerAnimation: gsap.getTweensOf(track)[0] as gsap.core.Tween,
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="workflows"
      className="m-section m-vh"
      style={{
        background: 'var(--m-bg-void)',
        overflow: 'hidden',
      }}
      aria-label="Clinical Workflow"
    >
      {/* Fixed label */}
      <div
        style={{
          position: 'absolute',
          top: 'clamp(1.5rem, 3vh, 3rem)',
          left: 'clamp(1.5rem, 4vw, 5rem)',
          zIndex: 10,
        }}
      >
        <div className="m-label m-label-accent">05 / Workflows</div>
      </div>

      {/* Horizontal track */}
      <div
        ref={trackRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          height: '100vh',
          width: 'max-content',
          paddingLeft: 'clamp(1.5rem, 4vw, 5rem)',
          gap: '4vw',
        }}
      >
        {/* Title card */}
        <div
          style={{
            minWidth: 'min(60vw, 700px)',
            paddingRight: '4vw',
            flexShrink: 0,
          }}
        >
          <h2 className="m-section-head">
            The care
            <br />
            <span style={{ color: 'var(--m-accent-light)' }}>continuum</span>
          </h2>
          <p className="m-body" style={{ maxWidth: '40ch', marginTop: '2rem' }}>
            MEDORA connects every stage of the patient journey into a continuous
            intelligent workflow — from first contact to final follow-through.
          </p>
        </div>

        {/* Step cards */}
        {STEPS.map((step, i) => (
          <div
            key={step.code}
            ref={(el) => {
              stepsRef.current[i] = el;
            }}
            style={{
              minWidth: 'clamp(280px, 28vw, 400px)',
              borderTop: '1px solid var(--m-line)',
              padding: 'clamp(2rem, 4vh, 4rem) 0',
              paddingRight: '3rem',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
            }}
          >
            <div
              className="step-line"
              style={{ width: '2rem', height: '1px', background: 'var(--m-accent)' }}
            />

            <div
              className="step-num m-label"
              style={{ color: 'var(--m-text-tertiary)' }}
            >
              {step.num}
            </div>

            <div
              className="step-code"
              style={{
                fontFamily: 'var(--m-font-display)',
                fontSize: 'clamp(1.8rem, 3.5vw, 3.5rem)',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                color: 'var(--m-text-primary)',
                lineHeight: 1,
              }}
            >
              {step.code}
            </div>

            <p className="step-desc m-body" style={{ fontSize: '0.9rem', maxWidth: '30ch' }}>
              {step.desc}
            </p>
          </div>
        ))}

        {/* End spacer */}
        <div style={{ minWidth: 'clamp(1.5rem, 4vw, 5rem)', flexShrink: 0 }} />
      </div>
    </section>
  );
}
