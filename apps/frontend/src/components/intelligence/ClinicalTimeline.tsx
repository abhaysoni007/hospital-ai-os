import React, { useEffect, useState } from 'react';
import { ClinicalTimelineResponse, TimelineEvent } from 'shared';
import { intelligenceService } from '../../services/intelligence.service';
import { Card } from '../ui';
import { Activity, FileText, ClipboardList, Stethoscope, CheckSquare } from 'lucide-react';

const EventIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'ENCOUNTER_START': return <Stethoscope className="h-5 w-5 text-blue-500" />;
    case 'NOTE_SIGNED': return <FileText className="h-5 w-5 text-indigo-500" />;
    case 'ORDER_PLACED': return <ClipboardList className="h-5 w-5 text-orange-500" />;
    case 'RESULT_ENTERED': return <Activity className="h-5 w-5 text-green-500" />;
    case 'TASK_CREATED': return <CheckSquare className="h-5 w-5 text-gray-500" />;
    default: return <Activity className="h-5 w-5 text-gray-400" />;
  }
};

import { ErrorState } from '../ui/ErrorState/ErrorState';

export const ClinicalTimeline: React.FC<{ patientId: string }> = ({ patientId }) => {
  const [timeline, setTimeline] = useState<ClinicalTimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    intelligenceService.getTimeline(patientId)
      .then(setTimeline)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load timeline'))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <div className="p-4 text-center text-sm text-gray-500">Loading timeline...</div>;
  if (error) {
    return (
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">Clinical Timeline</h3>
        <ErrorState title="Timeline unavailable" message={error} />
      </Card>
    );
  }
  if (!timeline) return null;

  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-4">Clinical Timeline</h3>
      <div className="relative border-l border-gray-200 ml-3 space-y-6">
        {timeline.events.map((event: TimelineEvent) => (
          <div key={event.id} className="pl-6 relative">
            <div className="absolute -left-3.5 bg-white p-1 rounded-full border border-gray-200">
              <EventIcon type={event.type} />
            </div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-900">{event.type.replace('_', ' ')}</p>
                <p className="text-xs text-gray-500">{new Date(event.occurredAt).toLocaleString()}</p>
                <div className="mt-1 text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-100">
                  {event.type === 'RESULT_ENTERED' && (
                    <span>Test: {event.metadata?.testCode as string} - {event.metadata?.isCritical ? 'CRITICAL' : (event.metadata?.isAbnormal ? 'Abnormal' : 'Normal')}</span>
                  )}
                  {event.type === 'NOTE_SIGNED' && (
                    <span>Note: {event.metadata?.recordType as string}</span>
                  )}
                  {event.type === 'ORDER_PLACED' && (
                    <span>Ordered: {event.metadata?.testName as string}</span>
                  )}
                  {event.type === 'ENCOUNTER_START' && (
                    <span>Dept: {event.metadata?.department as string} - {event.metadata?.chiefComplaint as string}</span>
                  )}
                  {event.type === 'TASK_CREATED' && (
                    <span>Task: {event.metadata?.title as string}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {timeline.metadata.truncated && (
        <div className="mt-4 text-center text-xs text-gray-500">
          Showing latest {timeline.metadata.includedEventCount} events.
        </div>
      )}
    </Card>
  );
};
