'use client';

import Link from 'next/link';

interface HeroSectionProps {
  onOpenDemo?: () => void;
}

export default function HeroSection({ onOpenDemo }: HeroSectionProps) {
  return (
    <section
      id="hero"
      style={{
        paddingTop: 'clamp(6.5rem, 10vw, 8.5rem)',
        paddingBottom: 'clamp(3.5rem, 6vw, 5rem)',
        backgroundColor: '#EFECE6',
        position: 'relative',
        overflow: 'hidden',
      }}
      aria-label="MEDORA Hero"
    >
      <div className="m-container">
        <div
          className="m-grid-split"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.25fr',
            gap: 'clamp(2rem, 4vw, 3.5rem)',
            alignItems: 'center',
          }}
        >
          {/* Left Column */}
          <div>
            <div className="m-eyebrow">
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: '#1D5BD8',
                  display: 'inline-block',
                }}
              />
              HOSPITAL AI OPERATING SYSTEM
            </div>

            <h1
              className="m-heading-display"
              style={{
                fontSize: 'clamp(2.75rem, 4.8vw, 4.4rem)',
                marginBottom: '1.25rem',
                color: '#111827',
              }}
            >
              One hospital.
              <br />
              One
              <br />
              connected
              <br />
              intelligence
              <br />
              layer.
            </h1>

            <p
              className="m-subheading"
              style={{
                marginBottom: '1.75rem',
                maxWidth: '44ch',
                color: '#4B5563',
              }}
            >
              Bring patient context, clinical workflows, diagnostics and governed AI into one secure operating environment.
            </p>

            {/* CTAs */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                alignItems: 'center',
                marginBottom: '1.75rem',
              }}
            >
              <button
                onClick={onOpenDemo}
                className="m-btn-primary"
                style={{ fontSize: '0.875rem', padding: '0.7rem 1.4rem' }}
              >
                <span>Request a demo</span>
                <span aria-hidden="true">↗</span>
              </button>

              <Link
                href="/login"
                className="m-btn-secondary"
                style={{ fontSize: '0.875rem', padding: '0.7rem 1.4rem' }}
              >
                <span>Explore the platform</span>
                <span aria-hidden="true">↗</span>
              </Link>
            </div>

            {/* Micro Note */}
            <p
              style={{
                fontSize: '0.75rem',
                color: '#6B7280',
                fontWeight: 500,
              }}
            >
              SOC 2 Type II governance architecture ready
            </p>
          </div>

          {/* Right Column: EMR Workstation Mockup */}
          <div
            style={{
              borderRadius: '0.5rem',
              border: '1px solid #DDD7CD',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)',
              overflow: 'hidden',
            }}
          >
            {/* Window Header */}
            <div
              style={{
                backgroundColor: '#1E293B',
                color: '#FFFFFF',
                padding: '0.65rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--m-font-mono)',
                  fontSize: '0.72rem',
                  letterSpacing: '0.04em',
                  color: '#94A3B8',
                }}
              >
                MEDORA / CLINICAL
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontFamily: 'var(--m-font-mono)',
                  color: '#64748B',
                  textTransform: 'uppercase',
                }}
              >
                ILLUSTRATIVE WORKSTATION
              </span>
            </div>

            {/* Sub-header Banner */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                padding: '0.75rem 1rem',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.2rem' }}>
                Doctor Clinical Workspace
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.72rem', color: '#64748B' }}>
                <div>
                  <strong style={{ color: '#0F172A' }}>Avery Morgan</strong> · Inpatient (Cardiology)
                </div>
                <div>Care team: Dr. Martinez, MD (Attending)</div>
              </div>
            </div>

            {/* Split Workspace Body */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: '0.85rem',
                padding: '1rem',
                backgroundColor: '#FFFFFF',
              }}
            >
              {/* Left Inner Box */}
              <div
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: '0.375rem',
                  padding: '0.85rem',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  LATEST VITALS
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                  {['Pulse: 72 bpm', 'BP: 124/80', 'SpO2: 98%', 'Temp: 36.8°C'].map((v) => (
                    <span
                      key={v}
                      style={{
                        backgroundColor: '#F1F5F9',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        color: '#334155',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '0.25rem',
                      }}
                    >
                      {v}
                    </span>
                  ))}
                </div>

                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  CLINICAL NOTE · SOAP DRAFT
                </div>
                <div style={{ fontSize: '0.72rem', color: '#334155', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div><strong>Subjective:</strong> Chest discomfort resolved, ambulating comfortably.</div>
                  <div><strong>Objective:</strong> Lungs clear bilaterally, regular heart rate.</div>
                  <div><strong>Assessment:</strong> Post-intervention day 2, stable recovery.</div>
                  <div><strong>Plan:</strong> Continue ACE-inhibitor, discharge tomorrow.</div>
                </div>
              </div>

              {/* Right Inner Box */}
              <div
                style={{
                  border: '1px solid #BFDBFE',
                  backgroundColor: '#F0F7FF',
                  borderRadius: '0.375rem',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    SYNTHESIS &amp; CITATIONS
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#1E40AF', lineHeight: 1.4, marginBottom: '0.6rem' }}>
                    2 prior encounters analyzed. 1 active prescription. 0 allergy alerts.
                  </div>

                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                    RESULT REMINDERS
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#334155', lineHeight: 1.4 }}>
                    2 lab results returned in last 24h. Verified normal electrolytes.
                  </div>
                </div>

                <Link
                  href="/login"
                  style={{
                    backgroundColor: '#1D5BD8',
                    color: '#FFFFFF',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.5rem',
                    borderRadius: '0.25rem',
                    textAlign: 'center',
                    textDecoration: 'none',
                    display: 'block',
                    marginTop: '0.75rem',
                  }}
                >
                  Sign draft note (Reviewed)
                </Link>
              </div>
            </div>

            {/* Bottom Review Gate */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                padding: '0.5rem 1rem',
                fontSize: '0.65rem',
                color: '#64748B',
                textAlign: 'center',
                fontFamily: 'var(--m-font-mono)',
              }}
            >
              SIGN-OFF / REVIEW GATE · CLINICIAN CONTROLLED
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
