import React, { useEffect, useState } from 'react';
import { DiagnosticTrendResponse } from 'shared';
import { intelligenceService } from '../../services/intelligence.service';
import { LineChart } from 'lucide-react';

import { ErrorState } from '../ui/ErrorState/ErrorState';

export const DiagnosticTrend: React.FC<{ patientId: string; testCode: string }> = ({ patientId, testCode }) => {
  const [trend, setTrend] = useState<DiagnosticTrendResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    intelligenceService.getDiagnosticTrend(patientId, testCode)
      .then(setTrend)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load trend'));
  }, [patientId, testCode]);

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-3 mt-2 shadow-sm">
        <ErrorState title={`Cannot load trend for ${testCode}`} message={error} />
      </div>
    );
  }

  if (!trend || trend.points.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-md p-3 mt-2 shadow-sm">
      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-700">
        <LineChart className="h-4 w-4 text-blue-500" />
        Historical Trend ({testCode})
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {trend.points.map(pt => (
          <div key={pt.resultId} className={`flex-shrink-0 p-2 rounded-md border text-xs min-w-[100px] ${pt.isCritical ? 'bg-red-50 border-red-200 text-red-900' : pt.isAbnormal ? 'bg-orange-50 border-orange-200 text-orange-900' : 'bg-gray-50 border-gray-200'}`}>
            <div className="text-gray-500 mb-1">{new Date(pt.occurredAt).toLocaleDateString()}</div>
            <div className="font-bold text-sm">{pt.valueNumber} {pt.unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
