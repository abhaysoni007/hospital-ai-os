'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const LINES = [
  'Healthcare is complex.',
  'MEDORA makes the',
  'complexity intelligent.',
];

export default function IntroductionSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const linesRef = useRef<(HTMLDivElement | null)[]>([]);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Label reveal
      gsap.fromTo(
        labelRef.current,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.8,
          scrollTrigger: {
            trigger: labelRef.current,
            start: 'top 85%',
          },
        }
      );

      // Staggered masked line reveals
      linesRef.current.forEach((line, i) => {
        if (!line) return;
        const inner = line.querySelector('.m-reveal-inner');
        gsap.fromTo(
          inner,
          { y: '105%' },
          {
            y: '0%',
            duration: 1.1,
            ease: 'power4.out',
            scrollTrigger: {
              trigger: line,
              start: 'top 82%',
            },
            delay: i * 0.08,
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="introduction"
      className="m-section"
      style={{
        background: 'var(--m-bg-void)',
        padding: 'clamp(8rem, 18vh, 18rem) 0',
      }}
      aria-label="Introduction"
    >
      <div className="m-container">
        <div ref={labelRef} className="m-label m-label-accent" style={{ marginBottom: '4rem', opacity: 0 }}>
          02 / Introduction
        </div>

        {LINES.map((line, i) => (
          <div
            key={i}
            ref={(el) => {
              linesRef.current[i] = el;
            }}
            className="m-reveal-mask"
            style={{
              marginBottom: i < LINES.length - 1 ? '0.15em' : 0,
            }}
          >
            <span
              className="m-reveal-inner m-section-head"
              style={{
                display: 'block',
                color: i === 2 ? 'var(--m-accent-light)' : 'var(--m-text-primary)',
              }}
            >
              {line}
            </span>
          </div>
        ))}

        {/* Supporting text */}
        <p
          className="m-body"
          style={{
            maxWidth: '55ch',
            marginTop: 'clamp(3rem, 6vh, 5rem)',
            paddingLeft: 'clamp(0px, 4vw, 8rem)',
          }}
        >
          From clinical workflows to operational intelligence — MEDORA brings
          coherence to the inherent complexity of modern hospital systems,
          without introducing friction into the care process.
        </p>
      </div>
    </section>
  );
}
