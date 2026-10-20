'use client';

import Link from 'next/link';

export default function Footer() {
  const navLinks = [
    { label: 'Platform', href: '#platform' },
    { label: 'Intelligence', href: '#intelligence' },
    { label: 'Workflows', href: '#workflows' },
    { label: 'Security', href: '#security' },
    { label: 'About', href: '#human-ai' },
  ];

  return (
    <footer
      style={{
        backgroundColor: '#0A0E17',
        color: '#FFFFFF',
        padding: 'clamp(3.5rem, 6vw, 5rem) 0 3rem',
        borderTop: '1px solid #1E293B',
      }}
      aria-label="Site footer"
    >
      <div className="m-container">
        {/* Top Header Row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '2rem',
            marginBottom: '3rem',
          }}
        >
          {/* Brand */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                marginBottom: '0.4rem',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--m-font-sans)',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  letterSpacing: '-0.04em',
                  color: '#FFFFFF',
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
              />
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
              Hospital AI Operating System
            </div>
          </div>

          {/* Nav Links */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.75rem',
              flexWrap: 'wrap',
            }}
          >
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{
                  fontSize: '0.8rem',
                  color: '#94A3B8',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#FFFFFF')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#94A3B8')}
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              style={{
                fontSize: '0.8rem',
                color: '#38BDF8',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Sign In →
            </Link>
          </nav>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', backgroundColor: '#1E293B', marginBottom: '2rem' }} />

        {/* Conceptual Architecture Disclaimer */}
        <p
          style={{
            fontSize: '0.72rem',
            color: '#64748B',
            lineHeight: 1.6,
            marginBottom: '1rem',
          }}
        >
          Healthcare environments are synthetic abstractions and visual illustrations. Architecture and interface designs are conceptual.
        </p>

        {/* Privacy Note */}
        <p
          style={{
            fontSize: '0.72rem',
            color: '#64748B',
            lineHeight: 1.6,
            marginBottom: '0.75rem',
          }}
        >
          <strong style={{ color: '#94A3B8' }}>Privacy</strong> · This illustrative page does not collect real patient information through a web form. The terms discussed are conceptual for your internal review.
        </p>

        {/* Terms Note */}
        <p
          style={{
            fontSize: '0.72rem',
            color: '#64748B',
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: '#94A3B8' }}>Terms</strong> · Product solutions and use cases listed here are illustrations. They are not a live clinical system and must not be used for patient care.
        </p>
      </div>
    </footer>
  );
}
