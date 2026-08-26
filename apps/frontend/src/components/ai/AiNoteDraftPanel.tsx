'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  FileText,
  AlertTriangle,
  Link2,
  RefreshCw,
  Check,
  X,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { aiService } from '@/services/ai-service';
import { clinicalService } from '@/services/clinical-service';
import { Button } from '../ui/Button/Button';
import { Badge } from '../ui/Badge/Badge';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import { Select } from '../ui/Input/Select';
import type {
  AiNoteDraftResponse,
  SoapNoteDraftOutput,
  ProgressNoteDraftOutput,
  RejectionReasonCategory,
} from 'shared';
import styles from './AiNoteDraftPanel.module.css';

type PanelState = 'idle' | 'generating' | 'ready' | 'error';

const CITATION_HREF: Record<string, (encounterId: string, sourceId: string) => string> = {
  CLINICAL_RECORD: (e, id) => `/encounters/${e}/clinical-records/${id}`,
  DIAGNOSTIC_ORDER: (_e, id) => `/diagnostics/${id}`,
  DIAGNOSTIC_RESULT: (_e, id) => `/diagnostics/${id}`,
};

const REJECTION_REASONS: { value: RejectionReasonCategory; label: string }[] = [
  { value: 'INACCURATE_CLINICAL_CONTENT', label: 'Inaccurate clinical content' },
  { value: 'MISSING_RELEVANT_CONTEXT', label: 'Missing relevant context' },
  { value: 'HALLUCINATION_SUSPECTED', label: 'Suspected fabrication' },
  { value: 'POOR_STRUCTURE', label: 'Poor structure' },
  { value: 'CLINICIAN_PREFERENCE', label: 'Clinician preference' },
];

function sourceLabel(sourceType: string): string {
  switch (sourceType) {
    case 'CLINICAL_RECORD':
      return 'Clinical record';
    case 'DIAGNOSTIC_ORDER':
      return 'Diagnostic order';
    case 'DIAGNOSTIC_RESULT':
      return 'Diagnostic result';
    default:
      return sourceType;
  }
}

/**
 * M12 HERO · M13 presentation — governed clinical AI.
 *
 * SOURCE-GROUNDED note drafting embedded in the encounter workspace:
 * every statement carries verifiable citations to authorized sources;
 * system-computed gaps are surfaced as a trust feature ("not documented");
 * the clinician explicitly accepts (binds), regenerates, or rejects with a
 * coded reason that is audited server-side. Nothing is ever auto-signed.
 */
export function AiNoteDraftPanel({
  encounterId,
  recordType = 'soap',
  onBound,
}: {
  encounterId: string;
  recordType?: 'soap' | 'progress_note';
  onBound?: (recordId: string) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<PanelState>('idle');
  const [result, setResult] = useState<AiNoteDraftResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [binding, setBinding] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<RejectionReasonCategory>(
    'INACCURATE_CLINICAL_CONTENT',
  );

  async function generate() {
    setState('generating');
    setErrorMsg('');
    try {
      const r = await aiService.draftNote(encounterId, recordType);
      setResult(r);
      setState('ready');
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      setErrorMsg(
        code === 'AI_VALIDATION_FAILED'
          ? 'The draft failed provenance validation and was discarded by the system — nothing was saved. You can retry or continue documenting manually.'
          : 'AI assistance is temporarily unavailable. Your documentation continues normally without it.',
      );
      setState('error');
    }
  }

  async function bind() {
    if (!result) return;
    setBinding(true);
    try {
      const draft = result.draft as SoapNoteDraftOutput & Partial<ProgressNoteDraftOutput>;
      // The server validated this draft against the strict AI schema (exactly
      // the four SOAP headings), so the tuple shape is guaranteed upstream.
      const payload: Parameters<typeof clinicalService.createClinicalRecord>[1] =
        recordType === 'soap'
          ? {
              recordType,
              content: {
                sections: draft.sections.map(({ heading, content }) => ({
                  heading,
                  content,
                })) as SoapNoteDraftOutput['sections'],
              },
              aiDraftId: result.interactionId,
            }
          : {
              recordType,
              content: { narrative: draft.narrative ?? '' },
              aiDraftId: result.interactionId,
            };
      const rec = await clinicalService.createClinicalRecord(encounterId, payload);
      onBound?.(rec.data.id);
      router.push(`/encounters/${encounterId}/clinical-records/${rec.data.id}`);
    } catch {
      setBinding(false);
      setState('error');
      setErrorMsg(
        'The draft could not be attached to the chart. Nothing was lost — you can retry or copy the content manually.',
      );
    }
  }

  async function confirmDiscard() {
    if (!result) return;
    const interactionId = result.interactionId;
    setResult(null);
    setDiscardOpen(false);
    setState('idle');
    try {
      await aiService.rejectInteraction(interactionId, rejectReason);
    } catch {
      /* rejection audit is best-effort client-side; server keeps authoritative state */
    }
  }

  const citations =
    result && 'sections' in result.draft
      ? result.draft.sections.flatMap((s) => s.citations)
      : ((result?.draft as ProgressNoteDraftOutput | undefined)?.citations ?? []);

  // Unique citation list for the sources panel.
  const uniqueSources = Array.from(
    new Map(citations.map((c) => [`${c.sourceType}:${c.sourceId}`, c])).values(),
  );

  return (
    <div className={styles.panel} aria-label="AI clinical assistance">
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerIcon}>
          <Sparkles size={16} aria-hidden="true" />
        </span>
        <div className={styles.headerTitles}>
          <h3 className={styles.title}>
            AI-drafted {recordType === 'soap' ? 'SOAP note' : 'progress note'}
          </h3>
          <div className={styles.badgeRow}>
            <Badge variant="ai-assist" size="sm">
              <ShieldCheck size={11} aria-hidden="true" /> SOURCE-GROUNDED
            </Badge>
            <Badge variant="neutral" size="sm">
              Clinician-owned
            </Badge>
          </div>
        </div>
      </div>

      {/* IDLE */}
      {state === 'idle' && (
        <div className={styles.body}>
          <p className={styles.lede}>
            Commission a draft from the authorized context of this encounter. Every statement will
            carry citations to real records, and missing information is reported honestly — never
            invented.
          </p>
          <Button
            variant="primary"
            size="md"
            iconLeft={<Sparkles size={15} />}
            onClick={() => void generate()}
          >
            Draft with AI
          </Button>
          <p className={styles.microcopy}>
            Generation is audited and consumes governed budget. You review everything before it
            touches the chart.
          </p>
        </div>
      )}

      {/* GENERATING */}
      {state === 'generating' && (
        <div className={styles.body} role="status" aria-live="polite">
          <p className={styles.lede}>Assembling authorized context and generating the draft…</p>
          <Skeleton variant="text" height={14} width="90%" />
          <Skeleton variant="text" height={14} width="75%" />
          <Skeleton variant="text" height={14} width="82%" />
        </div>
      )}

      {/* ERROR */}
      {state === 'error' && (
        <div className={styles.body} role="alert">
          <div className={styles.errorBox}>
            <TriangleAlert size={16} aria-hidden="true" />
            <p>{errorMsg}</p>
          </div>
          <div className={styles.actionRow}>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<RefreshCw size={13} />}
              onClick={() => void generate()}
            >
              Retry draft
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setState('idle')}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* READY */}
      {state === 'ready' && result && (
        <div className={styles.body}>
          <p className={styles.reviewNotice}>
            AI-generated draft — requires your review before signing. Accepting copies it into a
            draft clinical record under your name.
          </p>

          {/* Draft document */}
          {'sections' in result.draft ? (
            <article className={styles.noteDoc}>
              {result.draft.sections.map((s) => (
                <section key={s.heading} className={styles.noteSection}>
                  <h4 className={styles.noteHeading}>{s.heading}</h4>
                  <p className={styles.noteContent}>{s.content}</p>
                  {s.citations.length > 0 && (
                    <div className={styles.chipRow}>
                      {s.citations.map((c, i) => {
                        const href = CITATION_HREF[c.sourceType]?.(encounterId, c.sourceId);
                        return href ? (
                          <a key={i} className={styles.citationChip} href={href}>
                            <Link2 size={10} aria-hidden="true" />
                            {sourceLabel(c.sourceType)}
                          </a>
                        ) : null;
                      })}
                    </div>
                  )}
                </section>
              ))}
            </article>
          ) : (
            <article className={styles.noteDoc}>
              <h4 className={styles.noteHeading}>Narrative</h4>
              <p className={styles.noteContent}>{result.draft.narrative}</p>
              <div className={styles.chipRow}>
                {citations.map((c, i) => {
                  const href = CITATION_HREF[c.sourceType]?.(encounterId, c.sourceId);
                  return href ? (
                    <a key={i} className={styles.citationChip} href={href}>
                      <Link2 size={10} aria-hidden="true" />
                      {sourceLabel(c.sourceType)}
                    </a>
                  ) : null;
                })}
              </div>
            </article>
          )}

          {/* Sources panel */}
          {uniqueSources.length > 0 && (
            <details className={styles.sourcesPanel} open>
              <summary className={styles.summaryRow}>
                <FileText size={13} aria-hidden="true" />
                Sources ({uniqueSources.length})
              </summary>
              <ul className={styles.sourceList}>
                {uniqueSources.map((c) => {
                  const href = CITATION_HREF[c.sourceType]?.(encounterId, c.sourceId);
                  return (
                    <li key={`${c.sourceType}:${c.sourceId}`} className={styles.sourceItem}>
                      <span className={styles.sourceType}>{sourceLabel(c.sourceType)}</span>
                      <span className={styles.sourceExcerpt}>“{c.excerpt}”</span>
                      {href && (
                        <a
                          className={styles.sourceLink}
                          href={href}
                          aria-label={`Open ${sourceLabel(c.sourceType)}`}
                        >
                          Open source
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </details>
          )}

          {/* Documented gaps — trust feature */}
          {result.computedGaps.length > 0 ? (
            <div className={styles.gapsPanel} role="note">
              <div className={styles.gapsHeader}>
                <AlertTriangle size={14} aria-hidden="true" />
                Not documented in this encounter
                <span className={styles.gapsHint}>
                  system-computed — the draft cannot cite what does not exist
                </span>
              </div>
              <ul className={styles.gapList}>
                {result.computedGaps.map((g) => (
                  <li key={g}>{g.replace(/_/g, ' ').toLowerCase()}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className={styles.gapsClear} role="status">
              <Check size={13} aria-hidden="true" /> No documentation gaps detected in the
              authorized context.
            </div>
          )}

          {/* Actions */}
          {!discardOpen ? (
            <div className={styles.actionRow}>
              <Button
                variant="primary"
                size="md"
                iconLeft={<Check size={15} />}
                isLoading={binding}
                onClick={() => void bind()}
              >
                Use this draft
              </Button>
              <Button
                variant="outline"
                size="md"
                iconLeft={<RefreshCw size={14} />}
                disabled={binding}
                onClick={() => void generate()}
              >
                Regenerate
              </Button>
              <Button
                variant="ghost"
                size="md"
                iconLeft={<X size={14} />}
                disabled={binding}
                onClick={() => setDiscardOpen(true)}
              >
                Discard
              </Button>
            </div>
          ) : (
            <div
              className={styles.discardPanel}
              role="group"
              aria-label="Discard draft with reason"
            >
              <Select
                id="reject-reason"
                label="Why are you discarding this draft? (audited)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value as RejectionReasonCategory)}
                options={REJECTION_REASONS}
              />
              <div className={styles.actionRow}>
                <Button variant="ghost" size="sm" onClick={() => setDiscardOpen(false)}>
                  Keep draft
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  iconLeft={<X size={13} />}
                  onClick={() => void confirmDiscard()}
                >
                  Discard &amp; report reason
                </Button>
              </div>
            </div>
          )}

          {/* Provenance footer */}
          <footer className={styles.provenance}>
            Provenance: model {result.model} · prompt {result.promptTemplateId} ·{' '}
            {(result.latencyMs / 1000).toFixed(1)}s · grounded
          </footer>
        </div>
      )}
    </div>
  );
}
