import React, { useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  BrainCircuit,
  PenLine,
  ShieldAlert,
  X,
} from 'lucide-react';
import { Button } from '../ui/Button/Button';
import styles from './LovableAI.module.css';

/* ------------------------------------------------------------- Labelling */

export function AIBadge({ label = 'AI Generated Draft', tone = 'ai' }: { label?: string; tone?: 'ai' | 'muted' }) {
  return (
    <span className={`${styles.aiBadge} ${tone === 'muted' ? styles.badgeMuted : styles.badgeAi}`}>
      <BrainCircuit size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

export type AIStateValue = 'grounded' | 'review-required' | 'human-reviewed' | 'approved' | 'committed';

const STATE_CONFIG: Record<AIStateValue, { label: string; className: string }> = {
  grounded: { label: 'Grounded in Chart', className: styles.stateGrounded },
  'review-required': { label: 'Review Required', className: styles.stateReviewRequired },
  'human-reviewed': { label: 'Human Reviewed', className: styles.stateHumanReviewed },
  approved: { label: 'Approved by Clinician', className: styles.stateApproved },
  committed: { label: 'Committed & Signed', className: styles.stateCommitted },
};

export function AIState({ state }: { state: AIStateValue }) {
  const cfg = STATE_CONFIG[state];
  return (
    <span className={`${styles.stateBadge} ${cfg.className}`}>
      <BadgeCheck size={12} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

export function HumanReviewBanner({ reviewer }: { reviewer: string }) {
  return (
    <div role="alert" className={styles.humanReviewBanner}>
      <ShieldAlert size={16} className={styles.warningIcon} aria-hidden="true" />
      <p className={styles.warningText}>
        <strong>Human review mandatory.</strong> AI suggestions are assistive drafts only. The attending clinician ({reviewer}) remains legally and clinically responsible for the permanent record.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- AI Note Draft & Review */

export function AIDraftHeader({
  generatedAt,
  model,
  state,
  children,
}: {
  generatedAt: string;
  model: string;
  state: AIStateValue;
  children?: ReactNode;
}) {
  return (
    <div className={styles.draftHeader}>
      <div className={styles.badgeGroup}>
        <AIBadge />
        <AIState state={state} />
        <span className={styles.draftMeta}>
          Generated {generatedAt} · {model}
        </span>
      </div>
      {children ? <div className={styles.headerActions}>{children}</div> : null}
    </div>
  );
}

export function AIDraftDiff({ original, edited }: { original: string; edited: string }) {
  if (original.trim() === edited.trim()) {
    return <p className={styles.diffUnchanged}>No edits made to this section.</p>;
  }
  return (
    <div className={styles.diffBox}>
      <p className={styles.diffOriginal}>{original}</p>
      <p className={styles.diffEdited}>{edited}</p>
    </div>
  );
}

export interface NoteSection {
  title: string;
  text: string;
  original: string;
}

export function AIDraftPanel({
  sections,
  onChange,
  disabled = false,
}: {
  sections: NoteSection[];
  onChange: (title: string, text: string) => void;
  disabled?: boolean;
}) {
  const [showDiff, setShowDiff] = useState(false);

  return (
    <div className={styles.draftPanel}>
      <div className={styles.panelControls}>
        <p className={styles.panelInstructions}>
          Review and edit each section. Your verified modifications replace the draft text in the permanent record.
        </p>
        <button
          type="button"
          className={styles.diffToggleBtn}
          onClick={() => setShowDiff((prev) => !prev)}
        >
          <PenLine size={14} aria-hidden="true" />
          {showDiff ? 'Hide diff' : 'Show clinician diff'}
        </button>
      </div>

      <div className={styles.sectionsList}>
        {sections.map((sec) => (
          <div key={sec.title} className={styles.sectionField}>
            <label htmlFor={`sec-${sec.title}`} className={styles.sectionLabel}>
              {sec.title}
            </label>
            <textarea
              id={`sec-${sec.title}`}
              value={sec.text}
              disabled={disabled}
              rows={sec.title === 'Plan' ? 5 : 3}
              onChange={(e) => onChange(sec.title, e.target.value)}
              className={styles.sectionTextarea}
            />
            {showDiff ? <AIDraftDiff original={sec.original} edited={sec.text} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Hard Invariant: Accept AI Draft ≠ Sign Note.
 *
 * 1. "Accept AI Draft": Copies the draft into the editable note and marks as reviewed.
 * 2. "Sign Note": Completely separate action that commits with doctor's cryptographic identity.
 */
export function AIReviewActions({
  onAcceptDraft,
  onSignNote,
  isDraftAccepted,
  isNoteSigned,
  isSigning = false,
  reviewer,
}: {
  onAcceptDraft: () => void;
  onSignNote: () => void;
  isDraftAccepted: boolean;
  isNoteSigned: boolean;
  isSigning?: boolean;
  reviewer: string;
}) {
  return (
    <div className={styles.reviewActionsContainer}>
      <div className={styles.actionStep}>
        <Button
          variant="outline"
          size="sm"
          onClick={onAcceptDraft}
          disabled={isDraftAccepted || isNoteSigned}
        >
          {isDraftAccepted ? '✓ Draft Accepted to Editor' : 'Accept AI Draft for Editing'}
        </Button>
        <span className={styles.stepHint}>Step 1: Accept draft into note editor</span>
      </div>

      <div className={styles.divider} />

      <div className={styles.actionStep}>
        <Button
          variant="primary"
          size="sm"
          onClick={onSignNote}
          disabled={!isDraftAccepted || isNoteSigned || isSigning}
          isLoading={isSigning}
        >
          {isNoteSigned ? '✓ Clinical Note Signed & Committed' : 'Sign & Commit Note'}
        </Button>
        <span className={styles.stepHint}>
          {isNoteSigned
            ? `Signed by ${reviewer}`
            : 'Step 2: Sign and write to permanent chart'}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Provenance & Evidence */

export interface EvidenceSource {
  id: string;
  source: string;
  excerpt: string;
  timestamp: string;
  confidence?: number;
}

export function AIEvidenceDrawer({
  isOpen,
  onClose,
  evidence = [],
}: {
  isOpen: boolean;
  onClose: () => void;
  evidence?: EvidenceSource[];
}) {
  if (!isOpen) return null;

  return (
    <div className={styles.drawerOverlay} onClick={onClose} aria-modal="true" role="dialog">
      <div className={styles.drawerContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.drawerHeader}>
          <div>
            <h3 className={styles.drawerTitle}>Chart Evidence & Provenance</h3>
            <p className={styles.drawerSub}>
              Statements are grounded exclusively in this patient's validated clinical chart.
            </p>
          </div>
          <button type="button" className={styles.drawerClose} onClick={onClose} aria-label="Close evidence drawer">
            <X size={18} />
          </button>
        </div>

        <ul className={styles.evidenceList}>
          {evidence.length === 0 ? (
            <li className={styles.noEvidence}>No explicit citation records attached.</li>
          ) : (
            evidence.map((item) => (
              <li key={item.id} className={styles.evidenceItem}>
                <div className={styles.evidenceTop}>
                  <span className={styles.evidenceSource}>{item.source}</span>
                  {item.confidence ? (
                    <span className={`num ${styles.confidenceBadge}`}>
                      {Math.round(item.confidence * 100)}% match
                    </span>
                  ) : null}
                </div>
                <p className={styles.evidenceExcerpt}>{item.excerpt}</p>
                <span className={styles.evidenceTimestamp}>{item.timestamp}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
