'use client';

import { UserCheck, FileText, Activity, Brain, ClipboardList, CheckCircle2 } from 'lucide-react';

export default function WorkflowSection() {
  const steps = [
    {
      code: 'ADMIT',
      desc: 'Initial intake and registration context ready for care teams.',
      icon: UserCheck,
      color: '#1D5BD8',
      bgColor: '#EFF6FF',
    },
    {
      code: 'UNDERSTAND',
      desc: 'Past history, active orders and notes shown in one place.',
      icon: FileText,
      color: '#E11D48',
      bgColor: '#FFE4E6',
    },
    {
      code: 'DIAGNOSE',
      desc: 'Laboratory and imaging results linked into the encounter context.',
      icon: Activity,
      color: '#D97706',
      bgColor: '#FEF3C7',
    },
    {
      code: 'DECIDE',
      desc: 'Grounded AI assistance helps assemble evidence without replacing human judgment.',
      icon: Brain,
      color: '#1D5BD8',
      bgColor: '#EFF6FF',
    },
    {
      code: 'ACT',
      desc: 'Orders, documentation and care tasks clearly visible to the right staff.',
      icon: ClipboardList,
      color: '#E11D48',
      bgColor: '#FFE4E6',
    },
    {
      code: 'FOLLOW THROUGH',
      desc: 'Discharge summaries and next-step actions stay with the patient record.',
      icon: CheckCircle2,
      color: '#D97706',
      bgColor: '#FEF3C7',
    },
  ];

  return (
    <section
      id="workflows"
      className="m-section-pad"
      style={{
        backgroundColor: '#EFECE6',
      }}
      aria-label="The Care Journey"
    >
      <div className="m-container">
        {/* Section Header */}
        <div style={{ marginBottom: 'clamp(2.5rem, 5vw, 3.5rem)' }}>
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
            THE CARE JOURNEY
          </div>

          <h2 className="m-heading-section" style={{ marginBottom: '0.85rem' }}>
            Continuity at every step.
          </h2>

          <p className="m-subheading" style={{ maxWidth: '56ch', color: '#6B7280' }}>
            A connected view follows the work from arrival through documentation and next steps.
          </p>
        </div>

        {/* Timeline Container */}
        <div style={{ position: 'relative' }}>
          {/* Connecting Line (Desktop) */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '5%',
              right: '5%',
              height: '1px',
              backgroundColor: '#DDD7CD',
              zIndex: 1,
            }}
            className="timeline-line"
          />

          {/* 6 Step Columns */}
          <div
            className="m-care-continuum-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '1.25rem',
              position: 'relative',
              zIndex: 2,
            }}
          >
            {steps.map((s) => {
              const IconComp = s.icon;
              return (
                <div
                  key={s.code}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Circular Icon on Timeline */}
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: s.bgColor,
                      border: `1.5px solid ${s.color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1rem',
                      boxShadow: '0 0 0 4px #EFECE6',
                    }}
                  >
                    <IconComp size={18} color={s.color} strokeWidth={2.2} />
                  </div>

                  {/* Title */}
                  <div
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: '#111827',
                      letterSpacing: '0.04em',
                      marginBottom: '0.45rem',
                    }}
                  >
                    {s.code}
                  </div>

                  {/* Description */}
                  <p
                    style={{
                      fontSize: '0.78rem',
                      color: '#4B5563',
                      lineHeight: 1.5,
                    }}
                  >
                    {s.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .timeline-line { display: none !important; }
        }
      `}</style>
    </section>
  );
}
