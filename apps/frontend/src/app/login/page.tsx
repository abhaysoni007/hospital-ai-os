'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  HeartPulse,
  User,
  Sparkles,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import styles from './login.module.css';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated, error, clearError } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isBusy = isSubmitting;

  const rawReturnUrl = searchParams?.get('returnUrl');
  const returnUrl =
    rawReturnUrl && rawReturnUrl.startsWith('/') && !rawReturnUrl.startsWith('//')
      ? rawReturnUrl
      : '/dashboard';

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(returnUrl);
    }
  }, [isAuthenticated, router, returnUrl]);

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'Staff email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid hospital email';
    }

    if (!password) {
      errors.password = 'Password is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password });
      router.push(returnUrl);
    } catch {
      setIsSubmitting(false);
    }
  };

  const fillDemoRole = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setFormErrors({});
    clearError();
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.mainLayout}>
        {/* Left Column: Brand Showcase */}
        <div className={styles.leftShowcase}>
          {/* Top Pill Badge */}
          <div className={styles.topPill}>
            <ShieldCheck size={14} color="#1D5BD8" />
            <span>AUDITED CLINICAL OPERATING SYSTEM</span>
          </div>

          {/* Logo & Brand Name */}
          <Link href="/" className={styles.brandLogoRow}>
            <div className={styles.brandLogoBox}>
              <HeartPulse size={26} strokeWidth={2.4} />
            </div>
            <span className={styles.brandName}>Medora</span>
          </Link>

          {/* Display Headline */}
          <h1 className={styles.heroTitle}>
            Intelligent
            <br />
            operations for
            <br />
            modern care<span className={styles.heroDot}>.</span>
          </h1>

          {/* Subtitle */}
          <p className={styles.heroSubtitle}>
            Medora provides real-time clinical workflows, automated diagnostic coordination, and
            secure AI-assisted chart documentation for authorized healthcare staff.
          </p>

          {/* Feature Cards Stack */}
          <div className={styles.featuresStack}>
            {/* Feature 1 */}
            <div className={styles.featureCard}>
              <div className={styles.featureIconBlue}>
                <User size={18} strokeWidth={2.2} />
              </div>
              <div>
                <div className={styles.featureTitle}>Role-based access control</div>
                <div className={styles.featureDesc}>
                  Server-enforced policy across seven clinical and administrative roles.
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className={styles.featureCard}>
              <div className={styles.featureIconCoral}>
                <Sparkles size={18} strokeWidth={2.2} />
              </div>
              <div>
                <div className={styles.featureTitle}>Governed clinical AI</div>
                <div className={styles.featureDesc}>
                  SOURCE-GROUNDED note drafting with verifiable citations — clinician-owned, never
                  auto-signed.
                </div>
              </div>
            </div>
          </div>

          {/* Footer Audited Note */}
          <div className={styles.footerNote}>
            — Medora · Every clinical action is audited
          </div>
        </div>

        {/* Center Bauhaus Graphic Composition */}
        <div className={styles.geometricGraphic} aria-hidden="true">
          <svg viewBox="0 0 260 480" width="100%" height="100%" fill="none">
            {/* Dot Grid Matrix (5 columns x 4 rows) */}
            <g fill="#1E293B" opacity="0.85">
              {[0, 1, 2, 3, 4].map((col) =>
                [0, 1, 2, 3].map((row) => (
                  <circle
                    key={`${col}-${row}`}
                    cx={18 + col * 12}
                    cy={132 + row * 12}
                    r="1.85"
                  />
                ))
              )}
            </g>

            {/* Vertical Drafting Axis Line */}
            <line x1="85" y1="20" x2="85" y2="465" stroke="#1E293B" strokeWidth="1.5" />

            {/* Horizontal Drafting Axis Line extending to right */}
            <line x1="10" y1="155" x2="255" y2="155" stroke="#1E293B" strokeWidth="1.5" />

            {/* Top Coral Quarter Circle (Top-Right quadrant) */}
            <path
              d="M 85 35 L 85 155 L 205 155 A 120 120 0 0 0 85 35 Z"
              fill="#E2563E"
            />

            {/* Top Mustard Yellow Circle (at intersection) */}
            <circle cx="85" cy="155" r="20" fill="#E5A83B" />

            {/* Large Royal Blue Semicircle (curving to the LEFT) */}
            <path
              d="M 85 155 A 140 140 0 0 0 85 435 Z"
              fill="#1D5BD8"
            />

            {/* Dark Navy Vertical Block (bottom left) */}
            <rect x="12" y="285" width="32" height="150" fill="#0E1726" />

            {/* Warm Stone Quarter Circle (bottom center/left) */}
            <path
              d="M 85 435 L 85 365 A 70 70 0 0 0 15 435 Z"
              fill="#D6CFC4"
            />

            {/* Bottom Mustard Yellow Circle (bottom right) */}
            <circle cx="118" cy="445" r="16" fill="#E5A83B" />

            {/* Bottom Horizontal Guide Line */}
            <line x1="85" y1="465" x2="160" y2="465" stroke="#1E293B" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Right Column: Staff Sign In Card */}
        <div className={styles.rightCardWrapper}>
          <div className={styles.loginCard}>
            {/* Multi-color Top Accent Bar */}
            <div className={styles.cardTopBar}>
              <div className={styles.topBarBlue} />
              <div className={styles.topBarCoral} />
              <div className={styles.topBarYellow} />
            </div>

            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>Staff Sign In</h2>
              <p className={styles.cardSubtitle}>
                Enter your clinical credentials to access your workspace.
              </p>

              {error && (
                <div className={styles.errorAlert} role="alert">
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <div>{error}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                {/* Staff Email */}
                <div className={styles.formGroup}>
                  <label htmlFor="staff-email" className={styles.label}>
                    Staff Email<span className={styles.labelAsterisk}>*</span>
                  </label>
                  <div className={styles.inputWrapper}>
                    <Mail size={16} className={styles.inputIcon} />
                    <input
                      id="staff-email"
                      type="email"
                      placeholder="e.g. physician@hospital.org"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      className={`${styles.textInput} ${formErrors.email ? styles.textInputError : ''}`}
                      required
                      autoComplete="email"
                      disabled={isBusy}
                    />
                  </div>
                  {formErrors.email && <div className={styles.fieldError}>{formErrors.email}</div>}
                </div>

                {/* Password */}
                <div className={styles.formGroup}>
                  <label htmlFor="staff-password" className={styles.label}>
                    Password<span className={styles.labelAsterisk}>*</span>
                  </label>
                  <div className={styles.inputWrapper}>
                    <Lock size={16} className={styles.inputIcon} />
                    <input
                      id="staff-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your secure password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (formErrors.password)
                          setFormErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      className={`${styles.textInput} ${formErrors.password ? styles.textInputError : ''}`}
                      required
                      autoComplete="current-password"
                      disabled={isBusy}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={styles.passwordToggle}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {formErrors.password && (
                    <div className={styles.fieldError}>{formErrors.password}</div>
                  )}
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={isBusy}
                  className={styles.submitButton}
                >
                  <span>{isBusy ? 'Verifying credentials...' : 'Sign in'}</span>
                  {!isBusy && <ArrowRight size={16} />}
                </button>
              </form>

              {/* Security Notice */}
              <div className={styles.securityNotice}>
                <Lock size={14} className={styles.securityNoticeIcon} />
                <p className={styles.securityNoticeText}>
                  Access to patient health information is continuously audited and monitored.
                  Sessions use short-lived tokens and are never stored on the workstation.
                </p>
              </div>

              {/* Demo Credentials Helper */}
              <div className={styles.demoBar}>
                <div className={styles.demoBarHeader}>
                  <span>DEMO CLINICAL ROLES</span>
                  <span style={{ fontSize: '0.65rem', color: '#94A3B8' }}>Click to auto-fill</span>
                </div>
                <div className={styles.demoChips}>
                  <button
                    type="button"
                    onClick={() => fillDemoRole('dr.reynolds@hospital.org', 'Physician@Pass123')}
                    className={styles.demoChip}
                  >
                    Physician
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemoRole('nurse.chen@hospital.org', 'Nurse@Pass123')}
                    className={styles.demoChip}
                  >
                    Triage Nurse
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemoRole('admin@hospital.org', 'Admin@Pass123')}
                    className={styles.demoChip}
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemoRole('lab.tech@hospital.org', 'LabTech@Pass123')}
                    className={styles.demoChip}
                  >
                    Lab Tech
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
