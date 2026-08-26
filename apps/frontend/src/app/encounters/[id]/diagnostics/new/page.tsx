'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../../../components/layout/AppShell/AppShell';
import { Button } from '../../../../../components/ui/Button/Button';
import { Card } from '../../../../../components/ui/Card/Card';
import { Input } from '../../../../../components/ui/Input/Input';
import { AlertBanner } from '../../../../../components/ui/Alert/AlertBanner';
import { diagnosticsService } from '../../../../../services/diagnostics-service';
import { createDiagnosticOrderSchema, type OrderPriority } from 'shared';
import styles from './new-diagnostic-order.module.css';

const TEST_CATALOG = [
  { code: 'CBC', name: 'Complete Blood Count' },
  { code: 'GLU', name: 'Glucose (venous)' },
  { code: 'K', name: 'Potassium (serum)' },
  { code: 'CREA', name: 'Creatinine (serum)' },
  { code: 'TROP', name: 'Troponin I' },
  { code: 'LFT', name: 'Liver Function Panel' },
];

const PRIORITIES: Array<{ value: OrderPriority; label: string; hint: string }> = [
  { value: 'routine', label: 'Routine', hint: 'Standard lab turnaround.' },
  { value: 'urgent', label: 'Urgent', hint: 'Prioritised above routine.' },
  { value: 'stat', label: 'STAT', hint: 'Immediate processing — life-critical.' },
];

export default function NewDiagnosticOrderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const encounterId = params?.id;

  const [testCode, setTestCode] = useState('');
  const [testName, setTestName] = useState('');
  const [priority, setPriority] = useState<OrderPriority>('routine');
  const [indication, setIndication] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const handleCatalogSelect = (code: string) => {
    const entry = TEST_CATALOG.find((t) => t.code === code);
    setTestCode(entry?.code ?? code);
    if (entry) setTestName(entry.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = {
      testCode: testCode.trim(),
      testName: testName.trim(),
      priority,
      ...(indication.trim() ? { clinicalIndication: indication.trim() } : {}),
    };
    const parsed = createDiagnosticOrderSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path.join('.')] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      await diagnosticsService.createOrder(encounterId!, parsed.data as never);
      router.push(`/encounters/${encounterId}`);
    } catch (err) {
      const apiErr = err as Error & { statusCode?: number };
      setError(
        apiErr.statusCode === 403
          ? 'You are not authorized to place diagnostic orders.'
          : apiErr.message || 'Failed to place the order.',
      );
      setSaving(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={['Operations', 'Encounters', 'Order diagnostic']}
      requiredPermission="diagnostic_order:create"
    >
      <div className={styles.container}>
        <h1 className={styles.title}>Order diagnostic</h1>

        {error && (
          <AlertBanner
            severity={error.includes('not authorized') ? 'warning' : 'critical'}
            title="Order failed"
            dismissible
            onDismiss={() => setError(null)}
          >
            {error}
          </AlertBanner>
        )}

        <Card>
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.fieldGroup}>
              <label htmlFor="catalog" className={styles.label}>
                Quick fill (common panels)
              </label>
              <select
                id="catalog"
                className={styles.select}
                value={TEST_CATALOG.some((t) => t.code === testCode) ? testCode : ''}
                onChange={(e) => handleCatalogSelect(e.target.value)}
              >
                <option value="">Type a custom test…</option>
                {TEST_CATALOG.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
              <span className={styles.hint}>
                Shortcuts that pre-fill the code and name — edit freely; the laboratory catalog is
                authoritative.
              </span>
            </div>

            <div className={styles.grid}>
              <Input
                id="testCode"
                label="Test code"
                value={testCode}
                onChange={(e) => setTestCode(e.target.value.toUpperCase())}
                maxLength={50}
                required
                error={fieldErrors.testCode}
              />
              <Input
                id="testName"
                label="Test name"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                maxLength={200}
                required
                error={fieldErrors.testName}
              />
            </div>

            <fieldset className={styles.priorityGroup}>
              <legend className={styles.label}>Priority</legend>
              <div className={styles.priorityRow} role="radiogroup" aria-label="Priority">
                {PRIORITIES.map((p) => (
                  <label
                    key={p.value}
                    className={`${styles.priorityOption} ${priority === p.value ? styles.prioritySelected : ''}`}
                  >
                    <input
                      type="radio"
                      name="priority"
                      value={p.value}
                      checked={priority === p.value}
                      onChange={() => setPriority(p.value)}
                    />
                    <span className={styles.priorityLabel}>{p.label}</span>
                    <span className={styles.priorityHint}>{p.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.fieldGroup}>
              <label htmlFor="indication" className={styles.label}>
                Clinical indication (optional)
              </label>
              <textarea
                id="indication"
                className={styles.textarea}
                value={indication}
                onChange={(e) => setIndication(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </div>

            <div className={styles.actions}>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Placing order…' : 'Place Order'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
