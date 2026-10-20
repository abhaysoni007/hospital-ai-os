'use client';

import { useState } from 'react';
import Link from 'next/link';

interface RequestDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RequestDemoModal({ isOpen, onClose }: RequestDemoModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    workEmail: '',
    hospitalOrganization: '',
    role: 'Chief Medical Officer (CMO)',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '1.25rem',
          maxWidth: '540px',
          width: '100%',
          padding: 'clamp(1.75rem, 4vw, 2.5rem)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            fontSize: '1.25rem',
            color: '#64748B',
            cursor: 'pointer',
            padding: '0.25rem',
          }}
          aria-label="Close modal"
        >
          ✕
        </button>

        {!submitted ? (
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#2563EB',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '0.5rem',
              }}
            >
              HOSPITAL AI OS · CLINICAL DEMO
            </div>
            <h3
              style={{
                fontSize: '1.65rem',
                fontWeight: 800,
                color: '#0F172A',
                marginBottom: '0.5rem',
                letterSpacing: '-0.02em',
              }}
            >
              Experience MEDORA
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '1.75rem', lineHeight: 1.5 }}>
              Schedule a personalized walkthrough of the doctor clinical workspace, governed AI note drafting, and critical diagnostic panic alert loops.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  placeholder="Dr. Jordan Hayes"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Hospital / Health System Email
                </label>
                <input
                  required
                  type="email"
                  placeholder="jhayes@stjudehealth.org"
                  value={formData.workEmail}
                  onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Hospital Name
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Memorial Medical Center"
                    value={formData.hospitalOrganization}
                    onChange={(e) => setFormData({ ...formData, hospitalOrganization: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    Primary Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.85rem',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <option>Chief Medical Officer (CMO)</option>
                    <option>Chief Information Officer (CIO)</option>
                    <option>Hospital Managing Director</option>
                    <option>Department Head / Physician</option>
                    <option>Health IT / Informatics</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="m-btn-primary"
                style={{ width: '100%', padding: '0.85rem', marginTop: '0.5rem', fontSize: '0.95rem' }}
              >
                Schedule Private Walkthrough →
              </button>
            </form>

            <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.8rem', color: '#64748B' }}>
              Already have credentials?{' '}
              <Link href="/login" onClick={onClose} style={{ color: '#2563EB', fontWeight: 700 }}>
                Sign in to Live EMR
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                marginBottom: '1rem',
              }}
            >
              ✓
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem' }}>
              Request Received
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#64748B', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Thank you, {formData.name}. Our clinical deployment team will contact you within 24 hours with your sandbox credentials.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <Link
                href="/login"
                className="m-btn-primary"
                onClick={onClose}
              >
                Enter Demo Platform Now →
              </Link>
              <button
                onClick={onClose}
                className="m-btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
