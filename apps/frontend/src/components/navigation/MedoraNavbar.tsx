'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import gsap from 'gsap';

const NAV_ITEMS = [
  { num: '01', label: 'PLATFORM', href: '#platform' },
  { num: '02', label: 'INTELLIGENCE', href: '#intelligence' },
  { num: '03', label: 'WORKFLOWS', href: '#workflows' },
  { num: '04', label: 'SECURITY', href: '#security' },
  { num: '05', label: 'ABOUT', href: '#about' },
  { num: '06', label: 'CONTACT', href: '#contact' },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLLIElement | null)[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Animate menu open/close
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const items = itemsRef.current.filter(Boolean);

    if (menuOpen) {
      // Lock body scroll
      document.body.style.overflow = 'hidden';

      // Open sequence
      const tl = gsap.timeline();
      tl.set(overlay, { display: 'flex' })
        .to(overlay, {
          opacity: 1,
          duration: 0.5,
          ease: 'power2.inOut',
        })
        .fromTo(
          items,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            stagger: 0.08,
            ease: 'power3.out',
          },
          '-=0.2'
        );
    } else {
      document.body.style.overflow = '';

      // Close sequence
      const tl = gsap.timeline();
      tl.to(items, {
        y: -40,
        opacity: 0,
        duration: 0.4,
        stagger: 0.05,
        ease: 'power2.in',
      })
        .to(
          overlay,
          {
            opacity: 0,
            duration: 0.4,
            ease: 'power2.inOut',
          },
          '-=0.2'
        )
        .set(overlay, { display: 'none' });
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      {/* Fixed Navbar */}
      <nav
        aria-label="MEDORA main navigation"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.5rem clamp(1.5rem, 4vw, 5rem)',
          background: scrolled
            ? 'rgba(6, 10, 16, 0.85)'
            : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(240,244,240,0.06)' : '1px solid transparent',
          transition: 'background 0.5s, border-color 0.5s, backdrop-filter 0.5s',
          pointerEvents: 'auto',
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            fontFamily: 'var(--m-font-label)',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--m-text-primary)',
            textDecoration: 'none',
          }}
          data-cursor-label="HOME"
        >
          MEDORA
        </Link>

        {/* Menu Toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          style={{
            fontFamily: 'var(--m-font-label)',
            fontSize: '0.7rem',
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--m-text-secondary)',
            background: 'none',
            border: 'none',
            cursor: 'none',
            padding: '0.5rem 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            transition: 'color 0.3s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--m-text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--m-text-secondary)';
          }}
        >
          {/* Hamburger Lines */}
          <span
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
            }}
          >
            <span
              style={{
                width: menuOpen ? '20px' : '24px',
                height: '1px',
                background: 'currentColor',
                display: 'block',
                transition: 'width 0.3s, transform 0.3s',
                transform: menuOpen ? 'rotate(45deg) translate(4px, 4px)' : 'none',
                transformOrigin: 'left',
              }}
            />
            <span
              style={{
                width: '24px',
                height: '1px',
                background: 'currentColor',
                display: 'block',
                transition: 'opacity 0.3s',
                opacity: menuOpen ? 0 : 1,
              }}
            />
            <span
              style={{
                width: menuOpen ? '20px' : '24px',
                height: '1px',
                background: 'currentColor',
                display: 'block',
                transition: 'width 0.3s, transform 0.3s',
                transform: menuOpen ? 'rotate(-45deg) translate(4px, -4px)' : 'none',
                transformOrigin: 'left',
              }}
            />
          </span>
          {menuOpen ? 'CLOSE' : 'MENU'}
        </button>
      </nav>

      {/* Fullscreen Navigation Overlay */}
      <div
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        style={{
          display: 'none',
          opacity: 0,
          position: 'fixed',
          inset: 0,
          background: 'rgba(4, 7, 12, 0.97)',
          backdropFilter: 'blur(24px)',
          zIndex: 999,
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: 'clamp(3rem, 6vh, 6rem) clamp(1.5rem, 4vw, 5rem)',
          overflow: 'hidden',
        }}
        onClick={(e) => {
          if (e.target === overlayRef.current) closeMenu();
        }}
      >
        {/* Decorative horizontal line */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: '1px',
            background: 'var(--m-line)',
            pointerEvents: 'none',
          }}
        />

        {/* Label top-right */}
        <div
          style={{
            position: 'absolute',
            top: 'clamp(1.5rem, 3vh, 3rem)',
            right: 'clamp(1.5rem, 4vw, 5rem)',
            fontFamily: 'var(--m-font-label)',
            fontSize: '0.65rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--m-text-tertiary)',
          }}
        >
          INTELLIGENT HEALTHCARE SYSTEM
        </div>

        {/* Navigation items */}
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            width: '100%',
          }}
          role="list"
        >
          {NAV_ITEMS.map((item, i) => (
            <li
              key={item.num}
              ref={(el) => {
                itemsRef.current[i] = el;
              }}
              style={{
                borderTop: '1px solid var(--m-line)',
                padding: 'clamp(0.75rem, 2vh, 1.5rem) 0',
              }}
            >
              <a
                href={item.href}
                onClick={closeMenu}
                data-cursor-label="ENTER"
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '2rem',
                  textDecoration: 'none',
                  color: 'var(--m-text-primary)',
                  cursor: 'none',
                }}
                onMouseEnter={(e) => {
                  const num = e.currentTarget.querySelector('.nav-num') as HTMLElement;
                  const label = e.currentTarget.querySelector('.nav-label') as HTMLElement;
                  gsap.to(label, {
                    x: 24,
                    color: 'var(--m-accent-light)',
                    duration: 0.3,
                    ease: 'power2.out',
                  });
                  gsap.to(num, { opacity: 1, duration: 0.3 });
                }}
                onMouseLeave={(e) => {
                  const num = e.currentTarget.querySelector('.nav-num') as HTMLElement;
                  const label = e.currentTarget.querySelector('.nav-label') as HTMLElement;
                  gsap.to(label, {
                    x: 0,
                    color: 'var(--m-text-primary)',
                    duration: 0.4,
                    ease: 'power3.out',
                  });
                  gsap.to(num, { opacity: 0.4, duration: 0.3 });
                }}
              >
                <span
                  className="nav-num"
                  style={{
                    fontFamily: 'var(--m-font-label)',
                    fontSize: 'clamp(0.65rem, 1vw, 0.75rem)',
                    letterSpacing: '0.1em',
                    color: 'var(--m-text-tertiary)',
                    opacity: 0.4,
                    minWidth: '2.5rem',
                  }}
                >
                  {item.num}
                </span>
                <span
                  className="nav-label"
                  style={{
                    fontFamily: 'var(--m-font-display)',
                    fontSize: 'clamp(2.5rem, 6vw, 7rem)',
                    fontWeight: 700,
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                    willChange: 'transform',
                  }}
                >
                  {item.label}
                </span>
              </a>
            </li>
          ))}
        </ul>

        {/* Footer row */}
        <div
          style={{
            borderTop: '1px solid var(--m-line)',
            paddingTop: '1.5rem',
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--m-font-label)',
              fontSize: '0.65rem',
              letterSpacing: '0.1em',
              color: 'var(--m-text-tertiary)',
              textTransform: 'uppercase',
            }}
          >
            MEDORA OS — v1.0
          </span>
          <a
            href="#contact"
            onClick={closeMenu}
            style={{
              fontFamily: 'var(--m-font-label)',
              fontSize: '0.65rem',
              letterSpacing: '0.1em',
              color: 'var(--m-accent-light)',
              textTransform: 'uppercase',
              textDecoration: 'none',
              cursor: 'none',
            }}
          >
            REQUEST ACCESS →
          </a>
        </div>
      </div>
    </>
  );
}
