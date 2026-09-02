import React, { useState } from 'react';
import { ChartBriefResponse, intelligenceService } from '../../services/intelligence.service';
import { Button } from '../ui';
import { Card } from '../ui';
import { AlertCircle, FileText, CheckCircle2, Sparkles } from 'lucide-react';
import styles from './intelligence.module.css';

export const ChartBrief: React.FC<{ patientId: string }> = ({ patientId }) => {
  const [briefResponse, setBriefResponse] = useState<ChartBriefResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await intelligenceService.generateChartBrief(patientId);
      setBriefResponse(response);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate Chart Brief.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={styles.aiCard}>
      <div className={styles.aiHeader}>
        <div>
          <h3 className={styles.aiTitle}>
            <FileText size={18} aria-hidden="true" />
            Chart Brief
          </h3>
          <p className={styles.aiKicker}>
            <Sparkles size={11} aria-hidden="true" /> AI decision support
          </p>
        </div>
        <Button onClick={handleGenerate} isLoading={loading} variant="primary" size="sm">
          {briefResponse ? 'Regenerate' : 'Generate brief'}
        </Button>
      </div>

      {error && (
        <p className={styles.aiError} role="alert">
          <AlertCircle size={14} aria-hidden="true" /> {error}
        </p>
      )}

      {briefResponse && (
        <div className={styles.aiBody}>
          <p className={styles.aiTimestamp}>
            Generated from data through{' '}
            {new Date(
              briefResponse.metadata.latestSourceTimestamp || briefResponse.metadata.generatedAt,
            ).toLocaleString()}
          </p>

          <p className={styles.aiSummary}>{briefResponse.brief.summary}</p>

          {briefResponse.brief.informationGaps &&
            briefResponse.brief.informationGaps.length > 0 && (
              <div className={styles.aiGaps}>
                <h4 className={styles.aiGapsTitle}>Missing information</h4>
                <ul>
                  {briefResponse.brief.informationGaps.map((gap) => (
                    <li key={gap}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}

          <div className={styles.aiCitations}>
            <h4 className={styles.aiCitationsTitle}>Citations</h4>
            <ul>
              {briefResponse.brief.citations.map((c, i) => (
                <li key={i}>
                  <CheckCircle2 size={13} aria-hidden="true" />
                  <span>
                    <strong>{c.sourceType}</strong>: {c.excerpt}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.aiDisclaimers}>
            {briefResponse.brief.disclaimers.map((d, i) => (
              <p key={i}>{d}</p>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
