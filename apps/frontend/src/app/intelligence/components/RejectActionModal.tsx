import React, { useEffect, useRef, useState } from 'react';
import { XCircle } from 'lucide-react';
import { Recommendation, DetectedSignal } from 'shared';
import { Button, Spinner } from '../../../components/ui';
import styles from '../intelligence.module.css';

export interface RejectActionModalProps {
  isOpen: boolean;
  signal: DetectedSignal;
  recommendation: Recommendation;
  isSubmitting: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function RejectActionModal({
  isOpen,
  signal,
  recommendation,
  isSubmitting,
  onConfirm,
  onCancel,
}: RejectActionModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      const timer = setTimeout(() => {
        const textarea = modalRef.current?.querySelector<HTMLTextAreaElement>('textarea');
        textarea?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onCancel]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="modal-reject-title">
      <div className={styles.modalContent} ref={modalRef}>
        <div className={styles.modalHeader}>
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-rose-600" aria-hidden="true" />
            <h2 id="modal-reject-title" className={styles.modalTitle}>
              Decline Recommended Action
            </h2>
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-sm p-1"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <p className="text-sm">
            You are declining the proposed recommendation for <strong>{signal.title}</strong>:
          </p>

          <div className="bg-muted/60 p-3 rounded-lg border border-border text-xs">
            <span className="text-muted-foreground">Proposed Action: </span>
            <strong className="font-mono text-foreground">{recommendation.actionType}</strong>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="rejection-reason-input" className="text-xs font-semibold text-foreground">
              Clinical / Operational Reason for Declining (Optional):
            </label>
            <textarea
              id="rejection-reason-input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Patient is scheduled for transfer; order was superseded; already verbally communicated."
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              disabled={isSubmitting}
            />
            <p className="text-[11px] text-muted-foreground">
              Your decision and reason will be appended to the permanent audit record for compliance.
            </p>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => onConfirm(reason.trim() || 'Declined by human operator')}
            disabled={isSubmitting}
            id="modal-confirm-reject-btn"
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" />
                <span>Declining...</span>
              </>
            ) : (
              <span>Confirm Decline</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
