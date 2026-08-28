import React, { useState } from 'react';
import { ChartBriefResponse, intelligenceService } from '../../services/intelligence.service';
import { Button } from '../ui';
import { Card } from '../ui';
import { AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

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
    <Card className="p-4 border border-purple-200 bg-purple-50/30">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 text-purple-900">
            <FileText className="h-5 w-5" />
            Chart Brief
          </h3>
          <p className="text-xs font-medium text-purple-700 mt-1 uppercase tracking-wider">
            AI DECISION SUPPORT
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={loading} variant="primary">
          {loading ? 'Generating...' : 'Generate Brief'}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md mb-4 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {briefResponse && (
        <div className="space-y-4">
          <div className="text-sm text-gray-500 italic">
            Generated from data through {new Date(briefResponse.metadata.latestSourceTimestamp || briefResponse.metadata.generatedAt).toLocaleString()}
          </div>
          
          <div className="bg-white p-4 rounded-md border border-gray-100 shadow-sm whitespace-pre-wrap text-sm text-gray-800">
            {briefResponse.brief.summary}
          </div>

          {briefResponse.brief.informationGaps && briefResponse.brief.informationGaps.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md">
              <h4 className="text-xs font-semibold text-yellow-800 uppercase mb-2">Missing Information</h4>
              <ul className="list-disc pl-5 text-sm text-yellow-700">
                {briefResponse.brief.informationGaps.map(gap => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white border border-gray-200 p-3 rounded-md">
             <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2">Citations</h4>
             <ul className="space-y-2">
                {briefResponse.brief.citations.map((c, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2 items-start">
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>
                      <strong className="text-gray-800">{c.sourceType}</strong>: {c.excerpt}
                    </span>
                  </li>
                ))}
             </ul>
          </div>
          
          <div className="text-xs text-gray-400 mt-4 border-t pt-2">
            {briefResponse.brief.disclaimers.map((d, i) => (
              <p key={i}>{d}</p>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
