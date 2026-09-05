'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function FinalCTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Slow background reveal
      gsap.fromTo(
        bgRef.current,
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.5,
          ease: 'power4.inOut',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
        }
      );

      // Headline
      const headInner = headRef.current ? Array.from(headRef.current.querySelectorAll('.m-reveal-inner')) : [];
      gsap.fromTo(
        headInner,
        { y: '105%' },
        {
          y: '0%',
          duration: 1.4,
          stagger: 0.12,
          ease: 'power4.out',
          scrollTrigger: { trigger: headRef.current, start: 'top 75%' },
          delay: 0.3,
        }
      );

      // CTA button
      gsap.fromTo(
        ctaRef.current,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: { trigger: ctaRef.current, start: 'top 85%' },
          delay: 0.6,
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Magnetic hover
  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) * 0.35;
    const dy = (e.clientY - cy) * 0.35;
    gsap.to(e.currentTarget, { x: dx, y: dy, duration: 0.3, ease: 'power2.out' });
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    gsap.to(e.currentTarget, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
  };

  return (
    <section
      ref={sectionRef}
      id="contact"
      className="m-section"
      style={{
        background: 'var(--m-bg-void)',
        padding: 'clamp(10rem, 22vh, 22rem) 0',
        position: 'relative',
        overflow: 'hidden',
      }}
      aria-label="Call to action"
    >
      {/* Radial glow behind CTA */}
      <div
        ref={bgRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '60vw',
          height: '60vw',
          maxWidth: '800px',
          maxHeight: '800px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(61,122,92,0.08) 0%, transparent 70%)',
          transformOrigin: 'center',
          zIndex: 0,
        }}
        aria-hidden="true"
      />

      <div className="m-container" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <div className="m-label m-label-accent" style={{ marginBottom: '3rem', justifyContent: 'center', display: 'flex' }}>
          09 / Begin
        </div>

        <h2
          ref={headRef}
          style={{
            fontFamily: 'var(--m-font-display)',
            fontSize: 'clamp(2.5rem, 6vw, 7rem)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 0.95,
            color: 'var(--m-text-primary)',
            marginBottom: 'clamp(4rem, 8vh, 8rem)',
          }}
        >
          <div className="m-reveal-mask"><span className="m-reveal-inner" style={{ display: 'block' }}>The next generation</span></div>
          <div className="m-reveal-mask"><span className="m-reveal-inner" style={{ display: 'block' }}>of healthcare</span></div>
          <div className="m-reveal-mask">
            <span className="m-reveal-inner" style={{ display: 'block', color: 'var(--m-accent-light)' }}>starts here.</span>
          </div>
        </h2>

        {/* Magnetic CTA */}
        <Link
          ref={ctaRef}
          href="/login"
          data-cursor-label="ENTER"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '1.5rem',
            padding: '1.25rem 3rem',
            border: '1px solid var(--m-accent)',
            color: 'var(--m-text-primary)',
            fontFamily: 'var(--m-font-label)',
            fontSize: '0.75rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            opacity: 0,
            willChange: 'transform',
            transition: 'background 0.3s, border-color 0.3s, color 0.3s',
            cursor: 'none',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = 'var(--m-accent-dim)';
            (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--m-accent-light)';
          }}
          onMouseLeave={(e) => {
            handleMouseLeave(e);
            (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
            (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--m-accent)';
          }}
        >
          ENTER MEDORA
          <span style={{ fontSize: '1.2em' }}>→</span>
        </Link>

        {/* Below CTA: subtle tagline */}
        <p
          className="m-label"
          style={{
            marginTop: '3rem',
            color: 'var(--m-text-tertiary)',
          }}
        >
          Intelligent healthcare infrastructure
        </p>
      </div>
    </section>
  );
}
