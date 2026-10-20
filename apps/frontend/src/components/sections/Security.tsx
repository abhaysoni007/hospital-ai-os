'use client';

import { Lock, ShieldCheck } from 'lucide-react';

export default function SecuritySection() {
  const pillars = [
    {
      title: 'Least-privilege access',
      desc: 'Clear boundaries ensure staff only see what is appropriate for their role.',
    },
    {
      title: 'PHI boundaries',
      desc: 'Patient information is protected with strict boundaries across clinical and administrative workflows.',
    },
    {
      title: 'Encrypted data flows',
      desc: 'Encrypted data protects information as it moves between connected systems.',
    },
    {
      title: 'Tamper-evident audit trails',
      desc: 'Traceable events create transparency around access, revisions, and approvals.',
    },
  ];

  return (
    <section
      id="security"
      className="m-section-pad"
      style={{
        backgroundColor: '#EFECE6',
      }}
      aria-label="Security and Trust Architecture"
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
          {/* Left Column: Security Pillars */}
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
              DESIGNED FOR RESPONSIBLE USE
            </div>

            <h2 className="m-heading-section" style={{ marginBottom: '1rem', maxWidth: '18ch' }}>
              Trust is engineered into the workflow.
            </h2>

            <p className="m-subheading" style={{ maxWidth: '46ch', marginBottom: '2rem' }}>
              A responsible clinical environment needs clear boundaries around who sees information, how it is used, and how access is recorded.
            </p>

            {/* 2x2 Feature Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
              }}
            >
              {pillars.map((p) => (
                <div key={p.title}>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: '#111827',
                      marginBottom: '0.35rem',
                    }}
                  >
                    {p.title}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#4B5563', lineHeight: 1.5 }}>
                    {p.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Architectural Flow Diagram Card */}
          <div
            className="m-card-white"
            style={{
              padding: 'clamp(1.5rem, 3vw, 2.25rem)',
              backgroundColor: '#FFFFFF',
              borderRadius: '0.5rem',
            }}
          >
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#6B7280',
                fontFamily: 'var(--m-font-mono)',
                textTransform: 'uppercase',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>MEDORA / SYSTEM ARCH</span>
              <span>ILLUSTRATIVE ARCHITECTURE</span>
            </div>

            {/* Step 1: Request */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '0.375rem',
                padding: '0.75rem 1rem',
                textAlign: 'center',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#1E293B',
              }}
            >
              Data access request (scoped to user role)
            </div>

            {/* Arrow */}
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.875rem', padding: '0.3rem 0' }}>
              ↓
            </div>

            {/* Step 2: Governed Kernel (Blue Highlight) */}
            <div
              style={{
                backgroundColor: '#1D5BD8',
                color: '#FFFFFF',
                borderRadius: '0.375rem',
                padding: '0.85rem 1rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                Data boundary + Role-based access control
              </div>
            </div>

            {/* Arrow */}
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.875rem', padding: '0.3rem 0' }}>
              ↓
            </div>

            {/* Step 3: Split Services */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '0.375rem',
                  padding: '0.75rem',
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                }}
              >
                <Lock size={14} color="#64748B" />
                <span>Encrypted flow</span>
              </div>
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '0.375rem',
                  padding: '0.75rem',
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                }}
              >
                <ShieldCheck size={14} color="#059669" />
                <span>Audit event</span>
              </div>
            </div>

            {/* Arrow */}
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.875rem', padding: '0.3rem 0' }}>
              ↓
            </div>

            {/* Step 4: Storage */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '0.375rem',
                padding: '0.75rem 1rem',
                textAlign: 'center',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#1E293B',
              }}
            >
              Action gate + Clinician approval
            </div>

            <div
              style={{
                fontSize: '0.68rem',
                color: '#6B7280',
                textAlign: 'center',
                marginTop: '0.85rem',
              }}
            >
              All platform interactions are traceable and accountable
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
