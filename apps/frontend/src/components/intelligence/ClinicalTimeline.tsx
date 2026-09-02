import React, { useEffect, useState } from 'react';
import { ClinicalTimelineResponse, TimelineEvent } from 'shared';
import { intelligenceService } from '../../services/intelligence.service';
import { Card } from '../ui';
import { Activity, FileText, ClipboardList, Stethoscope, CheckSquare } from 'lucide-react';
import { ErrorState } from '../ui/ErrorState/ErrorState';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import styles from './intelligence.module.css';

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case 'ENCOUNTER_START':
      return <Stethoscope size={16} aria-hidden="true" className={styles.eventIconStart} />;
    case 'NOTE_SIGNED':
      return <FileText size={16} aria-hidden="true" className={styles.eventIconNote} />;
    case 'ORDER_PLACED':
      return <ClipboardList size={16} aria-hidden="true" className={styles.eventIconOrder} />;
    case 'RESULT_ENTERED':
      return <Activity size={16} aria-hidden="true" className={styles.eventIconResult} />;
    case 'TASK_CREATED':
      return <CheckSquare size={16} aria-hidden="true" className={styles.eventIconTask} />;
    default:
      return <Activity size={16} aria-hidden="true" className={styles.eventIconDefault} />;
  }
}

function eventDetail(event: TimelineEvent): string | null {
  switch (event.type) {
    case 'RESULT_ENTERED':
      return `Test: ${event.metadata?.testCode as string} — ${
        event.metadata?.isCritical ? 'CRITICAL' : event.metadata?.isAbnormal ? 'Abnormal' : 'Normal'
      }`;
    case 'NOTE_SIGNED':
      return `Note: ${(event.metadata?.recordType as string)?.replace(/_/g, ' ')}`;
    case 'ORDER_PLACED':
      return `Ordered: ${event.metadata?.testName as string}`;
    case 'ENCOUNTER_START':
      return `Dept: ${event.metadata?.department as string} — ${event.metadata?.chiefComplaint as string}`;
    case 'TASK_CREATED':
      return `Task: ${event.metadata?.title as string}`;
    default:
      return null;
  }
}

export const ClinicalTimeline: React.FC<{ patientId: string }> = ({ patientId }) => {
  const [timeline, setTimeline] = useState<ClinicalTimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    intelligenceService
      .getTimeline(patientId)
      .then(setTimeline)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load timeline'))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading)
    return (
      <Card className={styles.timelineCard} aria-busy="true">
        <h3 className={styles.timelineTitle}>Clinical timeline</h3>
        <Skeleton variant="rectangular" height={120} />
      </Card>
    );

  if (error) {
    return (
      <Card className={styles.timelineCard}>
        <h3 className={styles.timelineTitle}>Clinical timeline</h3>
        <ErrorState title="Timeline unavailable" message={error} />
      </Card>
    );
  }
  if (!timeline) return null;

  return (
    <Card className={styles.timelineCard}>
      <h3 className={styles.timelineTitle}>Clinical timeline</h3>
      <ol className={styles.timeline}>
        {timeline.events.map((event: TimelineEvent) => {
          const detail = eventDetail(event);
          return (
            <li key={event.id} className={styles.timelineItem}>
              <span className={styles.eventBadge} aria-hidden="true">
                <EventIcon type={event.type} />
              </span>
              <div className={styles.eventBody}>
                <p className={styles.eventType}>{event.type.replace(/_/g, ' ').toLowerCase()}</p>
                <p className={styles.eventTime}>{new Date(event.occurredAt).toLocaleString()}</p>
                {detail && <p className={styles.eventDetail}>{detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {timeline.metadata.truncated && (
        <p className={styles.timelineTruncated}>
          Showing latest {timeline.metadata.includedEventCount} events.
        </p>
      )}
    </Card>
  );
};
