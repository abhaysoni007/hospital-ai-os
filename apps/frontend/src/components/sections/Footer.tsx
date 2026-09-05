'use client';

import Link from 'next/link';

const NAV_LINKS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Intelligence', href: '#intelligence' },
  { label: 'Workflows', href: '#workflows' },
  { label: 'Security', href: '#security' },
];

export default function Footer() {
  return (
    <footer
      style={{
        background: 'var(--m-bg-deep)',
        borderTop: '1px solid var(--m-line)',
        padding: 'clamp(4rem, 8vh, 8rem) 0 clamp(2rem, 4vh, 4rem)',
      }}
      aria-label="Site footer"
    >
      <div className="m-container">
        {/* Main row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '4rem',
            alignItems: 'end',
            marginBottom: 'clamp(3rem, 6vh, 6rem)',
          }}
        >
          {/* Brand */}
          <div>
            <div
              style={{
                fontFamily: 'var(--m-font-display)',
                fontSize: 'clamp(2.5rem, 5vw, 6rem)',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                color: 'var(--m-text-primary)',
                lineHeight: 0.9,
                marginBottom: '1.5rem',
              }}
            >
              MEDORA
            </div>
            <p
              style={{
                fontFamily: 'var(--m-font-label)',
                fontSize: '0.7rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--m-text-tertiary)',
                maxWidth: '35ch',
              }}
            >
              THE INTELLIGENT OPERATING SYSTEM FOR MODERN HEALTHCARE
            </p>
          </div>

          {/* Navigation */}
          <nav aria-label="Footer navigation">
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end' }}>
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    style={{
                      fontFamily: 'var(--m-font-label)',
                      fontSize: '0.7rem',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--m-text-secondary)',
                      textDecoration: 'none',
                      transition: 'color 0.3s',
                      cursor: 'none',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.color = 'var(--m-text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.color = 'var(--m-text-secondary)';
                    }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href="/login"
                  style={{
                    fontFamily: 'var(--m-font-label)',
                    fontSize: '0.7rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--m-accent-light)',
                    textDecoration: 'none',
                    cursor: 'none',
                  }}
                >
                  Enter Platform →
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: '1px solid var(--m-line)',
            paddingTop: '2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--m-font-label)',
              fontSize: '0.65rem',
              letterSpacing: '0.08em',
              color: 'var(--m-text-tertiary)',
            }}
          >
            © {new Date().getFullYear()} MEDORA. All rights reserved.
          </span>

          <div style={{ display: 'flex', gap: '2rem' }}>
            {['Privacy', 'Terms', 'HIPAA'].map((item) => (
              <a
                key={item}
                href="#"
                style={{
                  fontFamily: 'var(--m-font-label)',
                  fontSize: '0.65rem',
                  letterSpacing: '0.08em',
                  color: 'var(--m-text-tertiary)',
                  textDecoration: 'none',
                  cursor: 'none',
                  transition: 'color 0.3s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--m-text-secondary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--m-text-tertiary)';
                }}
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
