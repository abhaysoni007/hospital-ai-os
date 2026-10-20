'use client';

export default function MetricsSection() {
  return (
    <section
      id="metrics"
      className="m-section-pad"
      style={{
        backgroundColor: '#EFECE6',
      }}
      aria-label="Hospital Operations Attention"
    >
      <div className="m-container">
        <div
          className="m-grid-split"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.05fr 1fr',
            gap: 'clamp(2.5rem, 5vw, 4.5rem)',
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
              FROM THE WARD TO THE CHIEF HOSPITAL
            </div>

            <h2 className="m-heading-section" style={{ marginBottom: '1rem', maxWidth: '18ch' }}>
              See the work that needs attention.
            </h2>

            <p className="m-subheading" style={{ maxWidth: '46ch', color: '#4B5563' }}>
              Reduce context switching by bringing pending work, critical signals, and operational flow into a shared view, helping care teams see what is waiting, what has changed, and where to look next.
            </p>
          </div>

          {/* Right Column: 4-Quadrant Operations Card from PDF */}
          <div
            className="m-card-dark"
            style={{
              padding: 'clamp(1.25rem, 2.5vw, 1.75rem)',
              backgroundColor: '#121A29',
              borderRadius: '0.5rem',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.68rem',
                fontFamily: 'var(--m-font-mono)',
                color: '#94A3B8',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                marginBottom: '1rem',
              }}
            >
              <span>MEDORA / HOSPITAL OPERATIONS</span>
              <span>ILLUSTRATIVE · SYNTHETIC DATA</span>
            </div>

            {/* 4 Quadrants Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
              }}
            >
              {/* Quadrant 1: Today's Flow */}
              <div style={{ backgroundColor: '#182234', borderRadius: '0.375rem', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38BDF8', marginBottom: '0.5rem' }}>
                  Today&apos;s flow
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', color: '#E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Active patients</span>
                    <span style={{ fontWeight: 700 }}>42</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Waiting</span>
                    <span style={{ fontWeight: 700 }}>12</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Triage high</span>
                    <span style={{ fontWeight: 700 }}>3</span>
                  </div>
                </div>
              </div>

              {/* Quadrant 2: Pending Review */}
              <div style={{ backgroundColor: '#182234', borderRadius: '0.375rem', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38BDF8', marginBottom: '0.5rem' }}>
                  Pending review
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', color: '#E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Lab results</span>
                    <span style={{ fontWeight: 700 }}>7</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Radiology</span>
                    <span style={{ fontWeight: 700 }}>4</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#FCA5A5' }}>
                    <span>Critical alerts</span>
                    <span style={{ fontWeight: 700, color: '#EF4444' }}>2</span>
                  </div>
                </div>
              </div>

              {/* Quadrant 3: Clinical Signals */}
              <div style={{ backgroundColor: '#182234', borderRadius: '0.375rem', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38BDF8', marginBottom: '0.5rem' }}>
                  Clinical signals
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', color: '#E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Abnormal vitals</span>
                    <span style={{ fontWeight: 700 }}>5</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Review needed</span>
                    <span style={{ fontWeight: 700 }}>8</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Overdue notes</span>
                    <span style={{ fontWeight: 700 }}>3</span>
                  </div>
                </div>
              </div>

              {/* Quadrant 4: Work Queues */}
              <div style={{ backgroundColor: '#182234', borderRadius: '0.375rem', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38BDF8', marginBottom: '0.5rem' }}>
                  Work queues
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem', color: '#E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Unsigned notes</span>
                    <span style={{ fontWeight: 700 }}>11</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Awaiting consult</span>
                    <span style={{ fontWeight: 700 }}>4</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Discharge ready</span>
                    <span style={{ fontWeight: 700 }}>2</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
