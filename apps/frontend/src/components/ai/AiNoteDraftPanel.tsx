'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { aiService } from '@/services/ai-service';
import { clinicalService } from '@/services/clinical-service';
import type { AiNoteDraftResponse, SoapNoteDraftOutput, ProgressNoteDraftOutput } from 'shared';

type PanelState = 'idle' | 'generating' | 'ready' | 'error';

const CITATION_HREF: Record<string, (encounterId: string, sourceId: string) => string> = {
  CLINICAL_RECORD: (e, id) => `/encounters/${e}/clinical-records/${id}`,
  DIAGNOSTIC_ORDER: (_e, id) => `/diagnostics/${id}`,
  DIAGNOSTIC_RESULT: (_e, id) => `/diagnostics/${id}`,
};

/**
 * M12 HERO — AI note-draft side panel (ADR-018/019 UX rulings).
 * Never auto-signs; binding is an explicit clinician action.
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

  async function generate() {
    setState('generating');
    setErrorMsg('');
    try {
      const r = await aiService.draftNote(encounterId, recordType);
      setResult(r);
      setState('ready');
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const code = (err as any)?.code ?? '';
      setErrorMsg(
        code === 'AI_VALIDATION_FAILED'
          ? 'AI produced an unusable draft. You can retry or continue manually.'
          : 'AI unavailable — continue manually.',
      );
      setState('error');
    }
  }

  async function bind() {
    if (!result) return;
    setBinding(true);
    try {
      const draft = result.draft as SoapNoteDraftOutput & Partial<ProgressNoteDraftOutput>;
      const payload =
        recordType === 'soap'
          ? {
              recordType,
              content: {
                sections: draft.sections.map(({ heading, content }) => ({ heading, content })),
              },
              aiDraftId: result.interactionId,
            }
          : {
              recordType,
              content: { narrative: draft.narrative },
              aiDraftId: result.interactionId,
            };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec = await (clinicalService as any).createClinicalRecord(encounterId, payload);
      onBound?.(rec.id);
      router.push(`/encounters/${encounterId}/clinical-records/${rec.id}`);
    } catch {
      setBinding(false);
    }
  }

  return (
    <aside
      aria-label="AI draft assistant"
      style={{ border: '1px solid var(--border, #d4d4d8)', borderRadius: 8, padding: 16 }}
    >
      <h3>AI Draft Assistant</h3>
      <p>
        <strong>SOURCE-GROUNDED</strong>{' '}
        <span style={{ fontSize: 12 }}>(provenance-verified — not a clinical decision)</span>
      </p>

      {state === 'idle' && <button onClick={generate}>Draft with AI</button>}

      {state === 'generating' && <p role="status">Generating draft…</p>}

      {state === 'error' && (
        <div role="alert">
          <p>{errorMsg}</p>
          <button onClick={generate}>Retry</button>
        </div>
      )}

      {state === 'ready' && result && (
        <div>
          <p style={{ fontWeight: 600 }}>
            AI-GENERATED DRAFT — requires your review before signing.
          </p>

          {'sections' in result.draft ? (
            result.draft.sections.map((s) => (
              <section key={s.heading}>
                <h4>{s.heading}</h4>
                <p>{s.content}</p>
                <ul>
                  {s.citations.map((c, i) => (
                    <li key={i}>
                      <a href={CITATION_HREF[c.sourceType]?.(encounterId, c.sourceId) ?? '#'}>
                        [{c.sourceType.replace('DIAGNOSTIC_', 'DIAG ')} {c.sourceId.slice(0, 8)}]
                      </a>{' '}
                      <em>{c.excerpt}</em>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <p>{result.draft.narrative}</p>
          )}

          {result.computedGaps.length > 0 && (
            <div
              role="note"
              style={{ background: 'var(--warning-bg, #fef9c3)', padding: 8, borderRadius: 6 }}
            >
              <strong>SYSTEM-COMPUTED GAPS — Not documented:</strong>
              <ul>
                {result.computedGaps.map((g) => (
                  <li key={g}>{g.replace(/_/g, ' ').toLowerCase()}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={bind} disabled={binding}>
              {binding ? 'Binding…' : 'Use this draft in the clinical note'}
            </button>
            <button onClick={generate} disabled={binding}>
              Regenerate
            </button>
            <button
              onClick={() => {
                void aiService.rejectInteraction(result.interactionId, 'CLINICIAN_PREFERENCE');
                setResult(null);
                setState('idle');
              }}
              disabled={binding}
            >
              Discard
            </button>
          </div>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            Model: {result.model} · Prompt: {result.promptTemplateId}
          </p>
        </div>
      )}
    </aside>
  );
}
