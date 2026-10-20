'use client';

export default function IntroductionSection() {
  return (
    <section
      id="platform"
      className="m-section-pad"
      style={{
        backgroundColor: '#EFECE6',
      }}
      aria-label="The Fragmentation Problem"
    >
      <div className="m-container">
        <div
          className="m-grid-split"
          style={{
            display: 'grid',
            gridTemplateColumns: '1.15fr 1fr',
            gap: 'clamp(2.5rem, 5vw, 4.5rem)',
            alignItems: 'center',
          }}
        >
          {/* Left: Problem Statement */}
          <div>
            <div className="m-eyebrow m-eyebrow-coral">
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: '#E11D48',
                  display: 'inline-block',
                }}
              />
              THE FRAGMENTATION PROBLEM
            </div>

            <h2
              className="m-heading-section"
              style={{
                marginBottom: '1.25rem',
                maxWidth: '18ch',
              }}
            >
              Clinical context shouldn&apos;t live in silos.
            </h2>

            <p
              className="m-subheading"
              style={{
                maxWidth: '46ch',
                marginBottom: '1.5rem',
              }}
            >
              Patient records, laboratory results and operational systems often tell separate parts of the same story. MEDORA brings relevant context into a shared working view, helping teams find what matters while clinical responsibility stays firmly with the people delivering care.
            </p>
          </div>

          {/* Right: Circular Connected Node Graph from PDF */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #DDD7CD',
              borderRadius: '0.5rem',
              padding: 'clamp(1.5rem, 3vw, 2.5rem)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              viewBox="0 0 380 320"
              style={{ width: '100%', height: 'auto', maxHeight: '320px' }}
              aria-label="Connected Context Diagram"
            >
              {/* Lines */}
              <line x1="190" y1="160" x2="110" y2="85" stroke="#CBD5E1" strokeWidth="1.2" strokeDasharray="3 3" />
              <line x1="190" y1="160" x2="285" y2="95" stroke="#CBD5E1" strokeWidth="1.2" strokeDasharray="3 3" />
              <line x1="190" y1="160" x2="110" y2="235" stroke="#CBD5E1" strokeWidth="1.2" strokeDasharray="3 3" />
              <line x1="190" y1="160" x2="280" y2="230" stroke="#CBD5E1" strokeWidth="1.2" strokeDasharray="3 3" />
              <line x1="190" y1="160" x2="190" y2="265" stroke="#CBD5E1" strokeWidth="1.2" strokeDasharray="3 3" />

              {/* Central Nucleus Node */}
              <circle cx="190" cy="160" r="46" fill="#1D5BD8" />
              <text x="190" y="156" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="700" fontFamily="Plus Jakarta Sans, sans-serif">
                CONNECTED
              </text>
              <text x="190" y="170" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="700" fontFamily="Plus Jakarta Sans, sans-serif">
                CONTEXT
              </text>

              {/* Satellite Node: Patient (Top Left) */}
              <circle cx="110" cy="85" r="28" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.2" />
              <text x="110" y="89" textAnchor="middle" fill="#1E293B" fontSize="9.5" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">
                Patient
              </text>

              {/* Satellite Node: Labs (Top Right - Amber) */}
              <circle cx="285" cy="95" r="30" fill="#D97706" />
              <text x="285" y="99" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">
                Labs
              </text>

              {/* Satellite Node: Operations (Bottom Left - Coral) */}
              <circle cx="110" cy="235" r="30" fill="#E11D48" />
              <text x="110" y="239" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">
                Operations
              </text>

              {/* Satellite Node: Notes (Bottom Right) */}
              <circle cx="280" cy="230" r="28" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.2" />
              <text x="280" y="234" textAnchor="middle" fill="#1E293B" fontSize="9.5" fontWeight="600" fontFamily="Plus Jakarta Sans, sans-serif">
                Notes
              </text>

              {/* Satellite Node: System (Bottom Center - Small Dark Navy) */}
              <circle cx="190" cy="265" r="20" fill="#0F172A" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
