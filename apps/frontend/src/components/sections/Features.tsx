'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    num: '01',
    title: 'Clinical Intelligence',
    desc: 'Real-time synthesis of clinical data from every touchpoint in the care environment — surfaced precisely when it matters.',
  },
  {
    num: '02',
    title: 'Diagnostics',
    desc: 'Integrated diagnostic information spanning imaging, laboratory, and clinical assessments in a unified analytical layer.',
  },
  {
    num: '03',
    title: 'Operations',
    desc: 'Hospital-wide operational visibility — capacity, scheduling, resource allocation, and departmental coordination.',
  },
  {
    num: '04',
    title: 'Workflows',
    desc: 'Configurable care pathways that adapt to clinical context rather than forcing clinicians to adapt to rigid systems.',
  },
  {
    num: '05',
    title: 'Security Architecture',
    desc: 'Clinical-grade access controls, audit trails, and encryption built into the system architecture from the ground up.',
  },
];

export default function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const itemsRef = useRef<(HTMLLIElement | null)[]>([]);


  useEffect(() => {
    const ctx = gsap.context(() => {
      itemsRef.current.forEach((item) => {
        if (!item) return;

        const num = item.querySelector('.feat-num');
        const title = item.querySelector('.feat-title');
        const desc = item.querySelector('.feat-desc');


        // Stagger entrance
        gsap.fromTo(
          [num, title, desc],
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.05,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: item,
              start: 'top 80%',
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const handleHover = (i: number, entering: boolean) => {
    const item = itemsRef.current[i];
    if (!item) return;

    const title = item.querySelector('.feat-title') as HTMLElement;
    const desc = item.querySelector('.feat-desc') as HTMLElement;
    const bar = item.querySelector('.feat-bar') as HTMLElement;

    if (entering) {
      gsap.to(title, { color: 'var(--m-accent-light)', x: 12, duration: 0.3, ease: 'power2.out' });
      gsap.to(desc, { opacity: 1, height: 'auto', duration: 0.4, ease: 'power2.out' });
      gsap.to(bar, { scaleX: 1, duration: 0.4, ease: 'power2.out' });
    } else {
      gsap.to(title, { color: 'var(--m-text-primary)', x: 0, duration: 0.3, ease: 'power2.out' });
      gsap.to(desc, { opacity: 0.7, duration: 0.3 });
      gsap.to(bar, { scaleX: 0, duration: 0.3, ease: 'power2.in' });
    }
  };

  return (
    <section
      ref={sectionRef}
      id="intelligence"
      className="m-section"
      style={{
        background: 'var(--m-bg-deep)',
        padding: 'clamp(6rem, 14vh, 14rem) 0',
      }}
      aria-label="Core Capabilities"
    >
      <div className="m-container">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'clamp(4rem, 8vw, 10rem)', alignItems: 'start' }}>
          {/* Left sticky label */}
          <div style={{ position: 'sticky', top: '10rem' }}>
            <div className="m-label m-label-accent" style={{ marginBottom: '2rem' }}>
              04 / CORE INTELLIGENCE
            </div>
            <h2 className="m-section-head">
              Built for
              <br />
              <span style={{ color: 'var(--m-accent-light)' }}>precision.</span>
            </h2>
          </div>

          {/* Right: feature list */}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} role="list">
            {FEATURES.map((f, i) => (
              <li
                key={f.num}
                ref={(el) => {
                  itemsRef.current[i] = el;
                }}
                style={{
                  position: 'relative',
                  borderTop: '1px solid var(--m-line)',
                  padding: 'clamp(2rem, 4vh, 3.5rem) 0',
                  cursor: 'default',
                  overflow: 'hidden',
                }}
                onMouseEnter={() => handleHover(i, true)}
                onMouseLeave={() => handleHover(i, false)}
              >
                {/* Accent bar */}
                <div
                  className="feat-bar"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '1px',
                    background: 'var(--m-accent)',
                    transformOrigin: 'left',
                    transform: 'scaleX(0)',
                  }}
                />

                <div style={{ display: 'flex', gap: '2rem', alignItems: 'baseline' }}>
                  <span
                    className="feat-num m-label"
                    style={{ color: 'var(--m-text-tertiary)', minWidth: '2.5rem' }}
                  >
                    {f.num}
                  </span>
                  <div style={{ flex: 1 }}>
                    <h3
                      className="feat-title"
                      style={{
                        fontFamily: 'var(--m-font-display)',
                        fontSize: 'clamp(1.5rem, 3vw, 3rem)',
                        fontWeight: 600,
                        letterSpacing: '-0.02em',
                        color: 'var(--m-text-primary)',
                        marginBottom: '1rem',
                        lineHeight: 1.1,
                        willChange: 'transform, color',
                      }}
                    >
                      {f.title}
                    </h3>
                    <p
                      className="feat-desc m-body"
                      style={{
                        maxWidth: '50ch',
                        opacity: 0.7,
                      }}
                    >
                      {f.desc}
                    </p>
                  </div>
                </div>
              </li>
            ))}

            {/* Last border */}
            <li style={{ borderTop: '1px solid var(--m-line)' }} />
          </ul>
        </div>
      </div>
    </section>
  );
}
