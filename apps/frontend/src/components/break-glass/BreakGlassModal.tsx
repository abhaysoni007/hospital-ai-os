import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button/Button';
import { AlertBanner } from '../ui/Alert/AlertBanner';
import { apiClient, ApiError } from '../../services/api-client';
import styles from './BreakGlassModal.module.css';

interface BreakGlassModalProps {
  patientId: string;
  encounterId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BreakGlassModal({
  patientId,
  encounterId,
  onSuccess,
  onCancel,
}: BreakGlassModalProps) {
  const [reason, setReason] = useState<'emergency_care' | 'patient_safety' | 'continuity_of_care'>('emergency_care');
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (justification.length < 20) {
      setError('Justification must be at least 20 characters.');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await apiClient('/break-glass/sessions', {
        method: 'POST',
        body: { patientId, encounterId, reason, justification },
      });
      // Store locally that we have an active break-glass session for this patient to show banner
      const activeSessions = JSON.parse(sessionStorage.getItem('breakGlassActive') || '{}');
      activeSessions[patientId] = Date.now() + 4 * 60 * 60 * 1000;
      sessionStorage.setItem('breakGlassActive', JSON.stringify(activeSessions));
      
      onSuccess();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to activate break-glass access.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="bg-title">
        <div className={styles.header}>
          <ShieldAlert size={24} className={styles.headerIcon} />
          <h2 id="bg-title" className={styles.title}>Emergency Access Required</h2>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.body}>
          <AlertBanner severity="warning" title="Restricted Access">
            This patient is outside your normal authorized scope. You may activate Break-Glass emergency access.
            This grants temporary read-only access and is <strong>fully audited</strong>.
          </AlertBanner>

          {error && (
            <div className={styles.errorBanner}>
              {error}
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="bg-reason">Reason</label>
            <select
              id="bg-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as 'emergency_care' | 'patient_safety' | 'continuity_of_care')}
              className={styles.input}
              disabled={loading}
            >
              <option value="emergency_care">Emergency Care</option>
              <option value="patient_safety">Patient Safety</option>
              <option value="continuity_of_care">Continuity of Care</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="bg-justification">Justification (min 20 characters)</label>
            <textarea
              id="bg-justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className={styles.input}
              rows={4}
              placeholder="Provide a detailed clinical justification for breaking the glass..."
              disabled={loading}
              required
              minLength={20}
              maxLength={2000}
            />
            <div className={styles.charCount}>
              {justification.length} / 2000
            </div>
          </div>

          <div className={styles.footer}>
            <Button variant="outline" type="button" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button variant="danger" type="submit" isLoading={loading}>
              Activate Emergency Access
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
