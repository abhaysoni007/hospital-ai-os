import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { Recommendation, DetectedSignal } from 'shared';
import { Button, Spinner } from '../../../components/ui';
import styles from '../intelligence.module.css';

export interface ApproveActionModalProps {
  isOpen: boolean;
  signal: DetectedSignal;
  recommendation: Recommendation;
  actorRole?: string;
  isSubmitting: boolean;
  onConfirm: (idempotencyKey: string) => void;
  onCancel: () => void;
}

export function ApproveActionModal({
  isOpen,
  signal,
  recommendation,
  actorRole,
  isSubmitting,
  onConfirm,
  onCancel,
}: ApproveActionModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      // Generate client-side idempotency key for this approval session
      const key =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `idem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setIdempotencyKey(key);

      // Focus trap
      const timer = setTimeout(() => {
        const confirmBtn = modalRef.current?.querySelector<HTMLButtonElement>(
          '#modal-confirm-approve-btn',
        );
        confirmBtn?.focus();
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
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="modal-approve-title">
      <div className={styles.modalContent} ref={modalRef}>
        <div className={styles.modalHeader}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 id="modal-approve-title" className={styles.modalTitle}>
              Authorize Operational Action
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
            You are authorizing execution of the following bounded hospital operational action:
          </p>

          <div className="bg-muted/60 p-3 rounded-lg border border-border space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Action Type:</span>
              <strong className="font-mono text-primary text-sm">
                {recommendation.actionType}
              </strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Target Signal:</span>
              <span className="font-medium text-foreground text-right truncate max-w-[260px]">
                {signal.title}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Authorizing Role:</span>
              <span className="font-medium text-foreground capitalize">
                {actorRole ?? 'Authorized Clinician'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Idempotency Key:</span>
              <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">
                {idempotencyKey}
              </span>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <strong>Proposed Rationale: </strong>
            <span>{recommendation.rationale}</span>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              <strong>Audit Guarantee:</strong> This action executes through existing authorized hospital services and records an immutable SHA-256 hash-chained entry in the audit log under your credentials.
            </span>
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
            variant="primary"
            onClick={() => onConfirm(idempotencyKey)}
            disabled={isSubmitting}
            id="modal-confirm-approve-btn"
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" />
                <span>Authorizing & Executing...</span>
              </>
            ) : (
              <span>Authorize & Execute Action</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
