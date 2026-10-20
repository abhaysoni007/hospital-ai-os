'use client';

import Link from 'next/link';

interface FinalCTAProps {
  onOpenDemo?: () => void;
}

export default function FinalCTA({ onOpenDemo }: FinalCTAProps) {
  return (
    <section
      id="contact"
      style={{
        backgroundColor: '#1D5BD8',
        color: '#FFFFFF',
        padding: 'clamp(4.5rem, 8vw, 7rem) 0',
        position: 'relative',
        overflow: 'hidden',
      }}
      aria-label="Call to action"
    >
      <div className="m-container" style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ maxWidth: '680px' }}>
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#BFDBFE',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '0.85rem',
            }}
          >
            A CLEARER WAY FORWARD
          </div>

          <h2
            className="m-heading-display"
            style={{
              fontSize: 'clamp(2.5rem, 4.5vw, 4rem)',
              color: '#FFFFFF',
              letterSpacing: '-0.035em',
              lineHeight: 1.05,
              marginBottom: '1.25rem',
            }}
          >
            Give every care team a
            <br />
            clearer picture.
          </h2>

          <p
            style={{
              fontSize: '1rem',
              color: '#DBEAFE',
              lineHeight: 1.6,
              marginBottom: '2rem',
              maxWidth: '52ch',
            }}
          >
            For hospital teams exploring a more connected operating environment, start with a walk-through of the MEDORA concept. Get in touch through your MEDORA representative to arrange a demo.
          </p>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.85rem',
              alignItems: 'center',
              marginBottom: '1.75rem',
            }}
          >
            <button
              onClick={onOpenDemo}
              className="m-btn-white"
            >
              <span>Request a demo</span>
              <span aria-hidden="true">↗</span>
            </button>

            <Link
              href="/login"
              className="m-btn-ghost-white"
            >
              <span>Enter MEDORA</span>
              <span aria-hidden="true">↗</span>
            </Link>
          </div>

          {/* Footnote from PDF */}
          <p
            style={{
              fontSize: '0.72rem',
              color: 'rgba(255, 255, 255, 0.7)',
              lineHeight: 1.5,
              maxWidth: '58ch',
            }}
          >
            *Illustrative concept showing potential user flows and system interactions. Final system capabilities and specifications subject to clinical partner agreements and ongoing development.
          </p>
        </div>
      </div>
    </section>
  );
}
