'use client';

import { ArrowRight } from 'lucide-react';

export default function HumanAISection() {
  const flowSteps = [
    'clinical sources',
    'governed synthesis',
    'review by clinician',
    'signed record',
  ];

  return (
    <section
      id="human-ai"
      className="m-section-pad"
      style={{
        backgroundColor: '#111827',
        color: '#FFFFFF',
      }}
      aria-label="Human and AI Responsibility"
    >
      <div className="m-container">
        {/* Header Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: 'clamp(2rem, 5vw, 4rem)',
            alignItems: 'flex-end',
            marginBottom: 'clamp(2.5rem, 5vw, 3.5rem)',
          }}
          className="m-grid-split"
        >
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#38BDF8',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '0.75rem',
              }}
            >
              MISSION · 01
            </div>

            <h2
              className="m-heading-section"
              style={{
                color: '#FFFFFF',
                maxWidth: '16ch',
              }}
            >
              Intelligence with a human hand on the record.
            </h2>
          </div>

          <p
            style={{
              fontSize: '0.95rem',
              color: '#9CA3AF',
              lineHeight: 1.65,
              fontWeight: 400,
            }}
          >
            Useful AI helps teams prepare and review information. It does not make autonomous clinical decisions.
          </p>
        </div>

        {/* 2 Comparison Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem',
            marginBottom: '2.5rem',
          }}
        >
          {/* Card 1: Accountability */}
          <div
            style={{
              backgroundColor: '#182234',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '0.5rem',
              padding: 'clamp(1.5rem, 3vw, 2.25rem)',
            }}
          >
            <div
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#94A3B8',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '0.6rem',
              }}
            >
              01 / ACCOUNTABILITY
            </div>

            <h3
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
                marginBottom: '0.75rem',
              }}
            >
              The clinician makes the call
            </h3>

            <p style={{ color: '#9CA3AF', fontSize: '0.875rem', lineHeight: 1.6 }}>
              Clinicians remain responsible for decisions and clinical documentation. They review, correct and approve content before it becomes a signed record.
            </p>
          </div>

          {/* Card 2: Assistance */}
          <div
            style={{
              backgroundColor: '#182234',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '0.5rem',
              padding: 'clamp(1.5rem, 3vw, 2.25rem)',
            }}
          >
            <div
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#38BDF8',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '0.6rem',
              }}
            >
              02 / ASSISTANCE
            </div>

            <h3
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
                marginBottom: '0.75rem',
              }}
            >
              AI brings the context together
            </h3>

            <p style={{ color: '#9CA3AF', fontSize: '0.875rem', lineHeight: 1.6 }}>
              AI can draft, summarize, surface trends and flag missing documentation with source-grounded references for a person to verify.
            </p>
          </div>
        </div>

        {/* Bottom Connected Step Flow */}
        <div
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            paddingTop: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          {flowSteps.map((step, idx) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '180px' }}>
              <div
                style={{
                  backgroundColor: '#182234',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '0.375rem',
                  padding: '0.75rem 1rem',
                  color: '#F8FAFC',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  width: '100%',
                  textAlign: 'center',
                  textTransform: 'lowercase',
                }}
              >
                {step}
              </div>
              {idx < flowSteps.length - 1 && (
                <ArrowRight size={16} color="#64748B" style={{ flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
