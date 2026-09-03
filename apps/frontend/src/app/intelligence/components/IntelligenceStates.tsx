import React from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileWarning,
  Play,
  RotateCw,
} from 'lucide-react';
import { Button, Card, Spinner } from '../../../components/ui';

export function IdleState({
  onRunAnalysis,
  canTriggerAnalysis,
}: {
  onRunAnalysis: () => void;
  canTriggerAnalysis: boolean;
}) {
  return (
    <Card className="p-8 md:p-12 text-center border-dashed border-2 border-border/80 rounded-xl bg-card">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
          <Activity size={26} aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            Operational Intelligence Engine Standing By
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Run an on-demand analysis to detect real operational bottlenecks across your hospital operations. The system queries active orders, panic alerts, and encounters against deterministic SLA thresholds.
          </p>
        </div>

        {/* The 3 Hero Capabilities */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left pt-2">
          <div className="p-3.5 rounded-lg bg-muted/40 border border-border space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Clock size={14} className="text-blue-500" aria-hidden="true" />
              <span>Pending Diagnostic Results</span>
            </div>
            <p className="text-xs text-muted-foreground m-0">
              Detects STAT orders pending over 1–2 hours and routine tests exceeding SLA turnaround.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-muted/40 border border-border space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <AlertTriangle size={14} className="text-rose-500" aria-hidden="true" />
              <span>Critical Alerts Unacknowledged</span>
            </div>
            <p className="text-xs text-muted-foreground m-0">
              Flags panic lab values unacknowledged past the 30-minute patient safety threshold.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-muted/40 border border-border space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <FileWarning size={14} className="text-amber-500" aria-hidden="true" />
              <span>Active Encounters Without Notes</span>
            </div>
            <p className="text-xs text-muted-foreground m-0">
              Catches active inpatient encounters exceeding 2+ hours lacking signed clinical notes.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <Button
            variant="primary"
            size="lg"
            onClick={onRunAnalysis}
            disabled={!canTriggerAnalysis}
            className="gap-2 shadow-xs"
            id="idle-start-analysis-btn"
          >
            <Play size={16} aria-hidden="true" />
            <span>Initiate Operational Bottleneck Scan</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function LoadingState() {
  return (
    <Card className="p-10 md:p-14 text-center rounded-xl bg-card border border-border shadow-xs">
      <div className="max-w-md mx-auto space-y-5" aria-live="polite">
        <Spinner size="lg" className="mx-auto text-primary" />
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-foreground">
            Scanning Operational Bottlenecks
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Executing deterministic queries against active diagnostic orders, panic lab notifications, and clinical encounters...
          </p>
        </div>

        <div className="text-[11px] font-mono text-muted-foreground bg-muted/50 p-2.5 rounded border border-border space-y-1 text-left">
          <div className="text-emerald-600 dark:text-emerald-400">✓ Connected to hospital operational database</div>
          <div className="text-primary">⏳ Scanning diagnostic orders against SLA thresholds...</div>
          <div className="text-muted-foreground">⏳ Evaluating unacknowledged critical alert window (30m)...</div>
          <div className="text-muted-foreground">⏳ Grounding AI explanations with authorized evidence...</div>
        </div>
      </div>
    </Card>
  );
}

export function ZeroSignalsState({ onRecheck }: { onRecheck: () => void }) {
  return (
    <Card className="p-10 text-center rounded-xl bg-card border border-border space-y-4 shadow-xs">
      <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
        <CheckCircle2 size={28} aria-hidden="true" />
      </div>
      <div className="space-y-1 max-w-md mx-auto">
        <h2 className="text-lg font-bold text-foreground">
          Zero Operational Bottlenecks Detected
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          All active diagnostic orders, critical laboratory notifications, and inpatient encounters are currently progressing within established clinical SLA thresholds.
        </p>
      </div>
      <div>
        <Button variant="secondary" size="sm" onClick={onRecheck} className="gap-1.5 text-xs">
          <RotateCw size={12} aria-hidden="true" />
          <span>Re-evaluate Operations</span>
        </Button>
      </div>
    </Card>
  );
}

export function ErrorBanner({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <strong className="text-sm font-semibold block">Analysis Request Failed</strong>
          <p className="text-xs text-rose-800 dark:text-rose-300 m-0">{error}</p>
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onRetry} className="shrink-0 text-xs gap-1.5">
        <RotateCw size={12} aria-hidden="true" />
        <span>Retry Analysis</span>
      </Button>
    </div>
  );
}
