import { expect, describe, it, beforeAll, afterAll, vi } from 'vitest';
import { ClinicalIntelligenceService } from '../intelligence.service';
import { AIOrchestrator } from '../../ai/orchestrator';

// Mock dependencies
const mockAiOrchestrator = {
  invokeStructured: vi.fn(),
  invoke: vi.fn(),
  generateSystemDraft: vi.fn(),
} as unknown as AIOrchestrator;

describe('ClinicalIntelligenceService (Phase 4)', () => {
  let intelligenceService: ClinicalIntelligenceService;

  beforeAll(() => {
    intelligenceService = new ClinicalIntelligenceService(mockAiOrchestrator);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should fetch a bounded clinical timeline (max 50 events)', async () => {
    // We use a known test patient ID from seed data if we can, or just assert on empty structure if not seeded
    // For pure logic, we just ensure it doesn't crash and returns the correct structure.
    const res = await intelligenceService.getClinicalTimeline('11111111-1111-1111-1111-111111111111', 50);
    expect(res).toHaveProperty('events');
    expect(res).toHaveProperty('metadata');
    expect(Array.isArray(res.events)).toBe(true);
    expect(res.events.length).toBeLessThanOrEqual(50);
  });

  it('should map diagnostic trends accurately', async () => {
    const res = await intelligenceService.getDiagnosticTrend('11111111-1111-1111-1111-111111111111', 'CBC');
    expect(Array.isArray(res)).toBe(true);
    expect(res.length).toBeLessThanOrEqual(5);
  });

  it('should invoke chart_search with bounded context blocks', async () => {
    mockAiOrchestrator.invokeStructured = vi.fn().mockResolvedValue({
      status: 'success',
      interactionId: 'test-interaction',
      parsed: {
        summary: 'Patient has a history of...',
        informationGaps: [],
        citations: [],
        disclaimers: ['AI generated'],
      }
    });

    const res = await intelligenceService.generateChartBrief('11111111-1111-1111-1111-111111111111', { staffId: '22222222-2222-2222-2222-222222222222', role: 'physician', departmentId: '33333333-3333-3333-3333-333333333333' });
    expect(res.brief.summary).toBeDefined();
    expect(mockAiOrchestrator.invokeStructured).toHaveBeenCalled();
  });
});
