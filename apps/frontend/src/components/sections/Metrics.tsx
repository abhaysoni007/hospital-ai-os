'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const METRICS = [
  {
    value: 50,
    prefix: '< ',
    suffix: 'ms',
    label: 'DECISION RETRIEVAL LATENCY',
    desc: 'Sub-second contextual clinical intelligence query response across live hospital EHR streams.',
    coord: 'LAT.01 / FAST-PATH',
  },
  {
    value: 99.99,
    prefix: '',
    suffix: '%',
    decimals: 2,
    label: 'ARCHITECTURAL RELIABILITY',
    desc: 'High-availability clinical uptime SLA with zero single point of failure in critical care routes.',
    coord: 'SLA.02 / FAULT-TOLERANT',
  },
  {
    value: 120,
    prefix: '',
    suffix: '+',
    label: 'INTEGRATED SUBSYSTEMS',
    desc: 'Unified FHIR, DICOM, HL7, and sensor telemetry pipeline normalizing clinical encounters.',
    coord: 'SYS.03 / PROTOCOL-AGNOSTIC',
  },
  {
    value: 100,
    prefix: '',
    suffix: '%',
    label: 'CONTEXTUAL INTEGRITY',
    desc: 'Deterministic provenance tracking on every inference, observation, and algorithmic alert.',
    coord: 'VER.04 / AUDIT-VERIFIED',
  },
];

export default function MetricsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const numberRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Metric count-up animation
      METRICS.forEach((metric, index) => {
        const numEl = numberRefs.current[index];
        if (!numEl) return;

        const obj = { val: 0 };
        gsap.to(obj, {
          val: metric.value,
          duration: 2,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: numEl,
            start: 'top 85%',
            once: true,
          },
          onUpdate: () => {
            if (metric.decimals) {
              numEl.innerText = obj.val.toFixed(metric.decimals);
            } else {
              numEl.innerText = Math.round(obj.val).toString();
            }
          },
        });
      });

      // Grid line animations
      if (gridRef.current) {
        gsap.fromTo(
          gridRef.current.children,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: gridRef.current,
              start: 'top 80%',
              once: true,
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="metrics"
      className="m-section"
      aria-label="MEDORA system metrics and operational scale"
      style={{
        position: 'relative',
        padding: 'clamp(6rem, 12vh, 12rem) clamp(1.5rem, 4vw, 5rem)',
        background: 'var(--m-bg-void)',
        borderTop: '1px solid var(--m-line)',
        borderBottom: '1px solid var(--m-line)',
        overflow: 'hidden',
      }}
    >
      {/* Subtle blueprint grid overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(240, 244, 240, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(240, 244, 240, 0.02) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }}
      />

      {/* Section Tag */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 'clamp(3rem, 6vh, 6rem)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--m-font-mono)',
            fontSize: '0.7rem',
            letterSpacing: '0.15em',
            color: 'var(--m-accent)',
            textTransform: 'uppercase',
          }}
        >
          06 / SYSTEM SPECIFICATIONS & SCALE
        </span>
        <span
          style={{
            fontFamily: 'var(--m-font-mono)',
            fontSize: '0.65rem',
            letterSpacing: '0.1em',
            color: 'var(--m-text-tertiary)',
            textTransform: 'uppercase',
          }}
        >
          BENCHMARKED TELEMETRY
        </span>
      </div>

      {/* Main architectural grid */}
      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1px',
          background: 'var(--m-line)',
          border: '1px solid var(--m-line)',
        }}
      >
        {METRICS.map((m, i) => (
          <div
            key={m.label}
            style={{
              background: 'var(--m-bg-void)',
              padding: 'clamp(2rem, 4vw, 3.5rem) clamp(1.5rem, 3vw, 2.5rem)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              transition: 'background 0.4s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(255, 255, 255, 0.015)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'var(--m-bg-void)';
            }}
          >
            {/* Coordinate label */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--m-font-mono)',
                fontSize: '0.6rem',
                letterSpacing: '0.12em',
                color: 'var(--m-text-tertiary)',
                marginBottom: '2rem',
              }}
            >
              <span>{m.coord}</span>
              <span style={{ color: 'var(--m-accent)' }}>+</span>
            </div>

            {/* Metric Value */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div
                style={{
                  fontFamily: 'var(--m-font-display)',
                  fontSize: 'clamp(3rem, 6vw, 5.5rem)',
                  fontWeight: 700,
                  lineHeight: 0.95,
                  letterSpacing: '-0.04em',
                  color: 'var(--m-text-primary)',
                  display: 'flex',
                  alignItems: 'baseline',
                }}
              >
                {m.prefix && (
                  <span
                    style={{
                      fontFamily: 'var(--m-font-mono)',
                      fontSize: '0.45em',
                      fontWeight: 400,
                      color: 'var(--m-accent)',
                      marginRight: '0.2rem',
                    }}
                  >
                    {m.prefix}
                  </span>
                )}
                <span
                  ref={(el) => {
                    numberRefs.current[i] = el;
                  }}
                >
                  0
                </span>
                {m.suffix && (
                  <span
                    style={{
                      fontFamily: 'var(--m-font-mono)',
                      fontSize: '0.45em',
                      fontWeight: 400,
                      color: 'var(--m-accent)',
                      marginLeft: '0.2rem',
                    }}
                  >
                    {m.suffix}
                  </span>
                )}
              </div>
            </div>

            {/* Metric Meta */}
            <div>
              <div
                style={{
                  fontFamily: 'var(--m-font-label)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  color: 'var(--m-text-primary)',
                  marginBottom: '0.5rem',
                }}
              >
                {m.label}
              </div>
              <p
                style={{
                  fontFamily: 'var(--m-font-body)',
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                  color: 'var(--m-text-secondary)',
                  margin: 0,
                }}
              >
                {m.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
