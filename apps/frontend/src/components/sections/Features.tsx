'use client';

import Link from 'next/link';

export default function FeaturesSection() {
  return (
    <section
      id="intelligence"
      className="m-section-pad"
      style={{
        backgroundColor: '#EFECE6',
      }}
      aria-label="One Connected Platform"
    >
      <div className="m-container">
        {/* Section Header */}
        <div style={{ marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
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
            ONE CONNECTED PLATFORM
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: '1.5rem',
            }}
          >
            <h2
              className="m-heading-section"
              style={{
                maxWidth: '18ch',
              }}
            >
              Built for the work behind every decision.
            </h2>

            <p
              className="m-subheading"
              style={{
                maxWidth: '44ch',
                color: '#6B7280',
              }}
            >
              Five connected areas bring clinical documentation, results, patient history, hospital flow and accountability into focus.
            </p>
          </div>
        </div>

        {/* Bento Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Row 1: 2 Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {/* Card 1: Governed AI Scribe */}
            <div
              className="m-card-white"
              style={{
                padding: 'clamp(1.5rem, 3vw, 2rem)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  01 / DOCUMENTATION
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#111827', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                  Governed AI Scribe
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#4B5563', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                  Turn encounter notes into a shareable draft with verifiable sources. The clinician edits, approves and signs the final copy.
                </p>
              </div>

              {/* Preview */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '0.375rem',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#111827' }}>
                    Subjective draft · Generated note
                  </span>
                  <span style={{ fontSize: '0.68rem', backgroundColor: '#FEF3C7', color: '#B45309', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', fontWeight: 600 }}>
                    Clinician approval needed
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#4B5563', lineHeight: 1.45, marginBottom: '0.75rem' }}>
                  Referenced vitals (09:14) · Chest examination consistent with stable recovery.
                </div>
                <Link
                  href="/login"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#1D5BD8',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  Review draft note →
                </Link>
              </div>
            </div>

            {/* Card 2: Critical Result Review */}
            <div
              className="m-card-white"
              style={{
                padding: 'clamp(1.5rem, 3vw, 2rem)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  02 / RESULTS
                </div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#111827', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                  Critical Result Review
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#4B5563', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                  Escalate flagged results into an explicit acknowledgement workflow with noticed reviews and clear responsibility visible.
                </p>
              </div>

              {/* Preview */}
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '0.375rem',
                  padding: '1rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991B1B', marginBottom: '0.4rem' }}>
                  Electrolyte panel · abnormal values
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#7F1D1D', marginBottom: '0.25rem' }}>
                  <span>Potassium: 5.8 mmol/L</span>
                  <span style={{ fontWeight: 600 }}>Action required</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#7F1D1D', marginBottom: '0.75rem' }}>
                  <span>Troponin: 0.04 ng/mL</span>
                  <span style={{ fontWeight: 600 }}>Action required</span>
                </div>
                <Link
                  href="/login"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#DC2626',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  Acknowledge critical result →
                </Link>
              </div>
            </div>
          </div>

          {/* Row 2: 3 Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {/* Card 3: Patient Timeline */}
            <div
              className="m-card-white"
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  03 / HISTORY
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', marginBottom: '0.4rem' }}>
                  Patient Timeline
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#4B5563', lineHeight: 1.5, marginBottom: '1rem' }}>
                  See encounters, observations and relevant history in one chronological view instead of searching 5 system tabs.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ fontWeight: 600, color: '#111827' }}>Clinic consultation</span>
                  <span style={{ color: '#6B7280' }}>Today · 10:30</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ fontWeight: 600, color: '#111827' }}>OPD encounter</span>
                  <span style={{ color: '#6B7280' }}>14 May 2024</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ fontWeight: 600, color: '#111827' }}>Specialist visit</span>
                  <span style={{ color: '#6B7280' }}>12 Jan 2024</span>
                </div>
              </div>
            </div>

            {/* Card 4: Hospital Operations */}
            <div
              className="m-card-white"
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  04 / OPERATIONS
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', marginBottom: '0.4rem' }}>
                  Hospital Operations
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#4B5563', lineHeight: 1.5, marginBottom: '1rem' }}>
                  Track capacity, operational spending and in-ward movements so care leaders can understand today&apos;s flow.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid #F1F5F9', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: '#6B7280' }}>ED arrivals</span>
                  <span style={{ fontWeight: 700, color: '#111827' }}>12 arriving</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: '#6B7280' }}>Bed occupancy</span>
                  <span style={{ fontWeight: 700, color: '#111827' }}>84% occupied</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: '#6B7280' }}>Staff on duty</span>
                  <span style={{ fontWeight: 700, color: '#111827' }}>18 on floor</span>
                </div>
              </div>
            </div>

            {/* Card 5: Audit & Access (Dark Navy) */}
            <div
              className="m-card-dark"
              style={{
                padding: '1.5rem',
                backgroundColor: '#121A29',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                  05 / ACCOUNTABILITY
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.4rem' }}>
                  Audit &amp; Access
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#94A3B8', lineHeight: 1.5, marginBottom: '1rem' }}>
                  Make access visible and the sequence of review events inspectable when a team needs to understand what happened.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem', fontFamily: 'var(--m-font-mono)', fontSize: '0.7rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38BDF8' }}>
                  <span>Event chain</span>
                  <span>Signed audit</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#E2E8F0' }}>
                  <span>10:14 · Review</span>
                  <span>Clinician verified</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#E2E8F0' }}>
                  <span>09:14 · AI Draft</span>
                  <span>System generated</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
