'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface MedoraNavbarProps {
  onOpenDemo?: () => void;
}

export default function MedoraNavbar({ onOpenDemo }: MedoraNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Platform', href: '#platform' },
    { label: 'Intelligence', href: '#intelligence' },
    { label: 'Workflows', href: '#workflows' },
    { label: 'Security', href: '#security' },
    { label: 'About', href: '#human-ai' },
  ];

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backgroundColor: scrolled ? 'rgba(239, 236, 230, 0.95)' : '#EFECE6',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: scrolled ? '1px solid #DDD7CD' : '1px solid transparent',
        transition: 'all 0.2s ease',
      }}
    >
      <div className="m-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4.25rem' }}>
        {/* Brand Logo */}
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            textDecoration: 'none',
          }}
          aria-label="MEDORA"
        >
          <span
            style={{
              fontFamily: 'var(--m-font-sans)',
              fontSize: '1.25rem',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              color: '#111827',
            }}
          >
            MEDORA
          </span>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#E11D48',
              display: 'inline-block',
              marginLeft: '2px',
            }}
            aria-hidden="true"
          />
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '2rem',
          }}
          className="desktop-nav"
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              style={{
                fontSize: '0.85rem',
                fontWeight: 500,
                color: '#4B5563',
                textDecoration: 'none',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#111827')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#4B5563')}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '1.25rem',
          }}
          className="desktop-actions"
        >
          <Link
            href="/login"
            style={{
              fontSize: '0.85rem',
              fontWeight: 500,
              color: '#374151',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <span>Explore platform</span>
            <span aria-hidden="true">→</span>
          </Link>

          <button
            onClick={onOpenDemo}
            className="m-btn-primary"
            style={{
              fontSize: '0.825rem',
              padding: '0.55rem 1rem',
              borderRadius: '0.375rem',
            }}
          >
            <span>Request a demo</span>
            <span aria-hidden="true">↗</span>
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Menu'}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width: '2.5rem',
            height: '2.5rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          className="mobile-toggle"
        >
          <span
            style={{
              width: '1.25rem',
              height: '2px',
              backgroundColor: '#111827',
              marginBottom: '4px',
              transition: 'all 0.2s ease',
              transform: mobileMenuOpen ? 'rotate(45deg) translate(3px, 4px)' : 'none',
            }}
          />
          <span
            style={{
              width: '1.25rem',
              height: '2px',
              backgroundColor: '#111827',
              transition: 'all 0.2s ease',
              opacity: mobileMenuOpen ? 0 : 1,
            }}
          />
          <span
            style={{
              width: '1.25rem',
              height: '2px',
              backgroundColor: '#111827',
              marginTop: '4px',
              transition: 'all 0.2s ease',
              transform: mobileMenuOpen ? 'rotate(-45deg) translate(3px, -4px)' : 'none',
            }}
          />
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          style={{
            backgroundColor: '#EFECE6',
            borderBottom: '1px solid #DDD7CD',
            padding: '1.25rem clamp(1.25rem, 3.5vw, 2.5rem) 1.75rem',
          }}
        >
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: '#111827',
                  textDecoration: 'none',
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #DDD7CD' }}>
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="m-btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Explore platform →
            </Link>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                if (onOpenDemo) onOpenDemo();
              }}
              className="m-btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Request a demo ↗
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 860px) {
          .desktop-nav { display: flex !important; }
          .desktop-actions { display: flex !important; }
          .mobile-toggle { display: none !important; }
        }
      `}</style>
    </header>
  );
}
