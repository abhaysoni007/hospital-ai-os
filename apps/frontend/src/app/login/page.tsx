'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HeartPulse, ShieldCheck, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button/Button';
import { Input } from '../../components/ui/Input/Input';
import { PasswordInput } from '../../components/ui/Input/PasswordInput';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});
  const { login, isAuthenticated, isLoading, error, clearError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
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

    try {
      await login({ email, password });
      router.push('/dashboard');
    } catch {
      // Handled in AuthContext
    }
  };

  return (
    <div className={styles.pageContainer}>
      {/* Left Brand Panel */}
      <div className={styles.brandPanel}>
        <div className={styles.brandContent}>
          <div className={styles.brandBadge}>
            <ShieldCheck size={16} />
            <span>HIPAA-Compliant Clinical Operating System</span>
          </div>

          <div className={styles.brandLogoRow}>
            <div className={styles.brandLogoBox}>
              <HeartPulse size={32} />
            </div>
            <span className={styles.brandName}>Hospital AI OS</span>
          </div>

          <h1 className={styles.brandHeroTitle}>Intelligent operations for modern care.</h1>

          <p className={styles.brandHeroSubtitle}>
            Hospital AI OS provides real-time clinical workflows, automated diagnostic coordination,
            and secure AI-assisted chart documentation for authorized healthcare staff.
          </p>

          <div className={styles.brandFeatures}>
            <div className={styles.featureCard}>
              <span className={styles.featureTitle}>Role-Based Access Control</span>
              <span className={styles.featureDesc}>
                Static policy enforcement across 7 clinical and administrative roles.
              </span>
            </div>
            <div className={styles.featureCard}>
              <span className={styles.featureTitle}>Mission Control Telemetry</span>
              <span className={styles.featureDesc}>
                Real-time vitals, STAT lab alerts, and centralized encounter tracking.
              </span>
            </div>
          </div>
        </div>

        <div className={styles.brandFooter}>
          <span>Phase 4 Authenticated Shell • Version 1.0</span>
        </div>
      </div>

      {/* Right Login Form Container */}
      <div className={styles.formPanel}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Staff Sign In</h2>
            <p className={styles.formSubtitle}>
              Enter your clinical credentials to access your workspace.
            </p>
          </div>

          {error && (
            <div className={styles.errorAlert} role="alert">
              <AlertCircle size={18} className={styles.errorAlertIcon} />
              <div className={styles.errorAlertText}>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            <Input
              label="Staff Email"
              type="email"
              placeholder="e.g. physician@hospital.org"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: undefined }));
              }}
              error={formErrors.email}
              iconLeft={<Mail size={16} />}
              required
              autoComplete="email"
              disabled={isLoading}
            />

            <PasswordInput
              label="Password"
              placeholder="Enter your secure password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (formErrors.password)
                  setFormErrors((prev) => ({ ...prev, password: undefined }));
              }}
              error={formErrors.password}
              iconLeft={<Lock size={16} />}
              required
              autoComplete="current-password"
              disabled={isLoading}
            />

            <div className={styles.formOptions}>
              <label className={styles.rememberCheckbox}>
                <input type="checkbox" className={styles.checkboxInput} />
                <span>Remember this workstation</span>
              </label>
              <a href="#help" className={styles.forgotLink} tabIndex={0}>
                Need Help?
              </a>
            </div>

            <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isLoading}>
              Sign In to Station
            </Button>
          </form>

          <div className={styles.securityNotice}>
            <Lock size={14} className={styles.securityNoticeIcon} />
            <p>
              Access to patient health information (PHI) is continuously audited and monitored under
              HIPAA and HITECH regulations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
