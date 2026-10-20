'use client';

export default function ProofStrip() {
  const items = [
    { label: 'Clinician-led decisions', dotColor: '#1D5BD8' },
    { label: 'Role-scoped access', dotColor: '#E11D48' },
    { label: 'Traceable AI outputs', dotColor: '#D97706' },
    { label: 'Interoperability-ready', dotColor: '#059669' },
  ];

  return (
    <div
      style={{
        backgroundColor: '#EFECE6',
        borderTop: '1px solid #DDD7CD',
        borderBottom: '1px solid #DDD7CD',
        padding: '1rem 0',
      }}
      aria-label="Core Guarantees"
    >
      <div className="m-container">
        <div
          className="m-proof-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1.25rem',
            alignItems: 'center',
          }}
        >
          {items.map((item) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontSize: '0.825rem',
                fontWeight: 600,
                color: '#1F2937',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: item.dotColor,
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
