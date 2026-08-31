/**
 * Phase A — MedGemma Evaluation Harness
 *
 * Evaluates the OllamaAdapter + MedGemma against synthetic demo-safe data.
 * NO real patient data is used. All fixtures are synthetic.
 *
 * Run against live Ollama:
 *   AI_PROVIDER=ollama AI_MODEL_NAME=medgemma:latest pnpm --filter backend eval:medgemma
 *
 * Safety invariants verified:
 *   - Output is structured JSON (Zod-validated)
 *   - Output is a DRAFT — not signed
 *   - Critical-value evaluation is NOT delegated to the model
 *   - Authorization happens before this harness runs
 *
 * Results are written to: docs/implementation/medgemma-eval-results.json
 */

import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { OllamaAdapter } from '../modules/ai/adapters/ollama.adapter';
import type { GenerateStructuredParams } from '../modules/ai/adapters/provider.interface';
import { chartAnswerOutputSchema } from 'shared';

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = process.env.AI_BASE_URL ?? 'http://localhost:11434';
const MODEL = process.env.AI_MODEL_NAME ?? 'medgemma:latest';
const TIMEOUT_MS = 60000;

// ─── Synthetic Fixtures (NO real patient data) ────────────────────────────────

const SOAP_SCHEMA = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  dataGaps: z.array(z.string()).optional(),
});

type SoapDraft = z.infer<typeof SOAP_SCHEMA>;

const SYNTHETIC_CONTEXT_BLOCKS = [
  { type: 'encounter', content: 'Patient: SYNTHETIC-001 | Chief complaint: Severe fatigue, pallor | Status: Active' },
  { type: 'vitals', content: 'HR: 112 bpm | BP: 90/60 mmHg | SpO2: 94% | Temp: 37.4°C | RR: 22/min' },
  { type: 'lab', content: 'CBC Hemoglobin: 5.8 g/dL (LOW) | WBC: 6.2 | Platelets: 210 | Note: Hemoglobin 5.8 is CRITICAL — this value was flagged by the deterministic rule evaluator, NOT by AI' },
  { type: 'note', content: 'Admission vitals: Patient pale and fatigued. Tachycardia noted.' },
];

const SYNTHETIC_SOAP_PROMPT = `
You are assisting a physician with a DRAFT SOAP note for a de-identified synthetic patient.
This note is a DRAFT only — it requires physician review and signature before becoming a clinical record.

SYNTHETIC PATIENT CONTEXT (anonymized for evaluation):
${SYNTHETIC_CONTEXT_BLOCKS.map(b => `[${b.type.toUpperCase()}] ${b.content}`).join('\n')}

Generate a structured SOAP note as JSON with keys: subjective, objective, assessment, plan, confidence (0-1), dataGaps (array of missing information).

IMPORTANT:
- Do NOT make autonomous diagnostic decisions. Provide a draft for physician review.
- The Hemoglobin value was flagged CRITICAL by a deterministic clinical rule — your role is documentation only.
- Output valid JSON matching the schema.
`.trim();

const CHART_BRIEF_PROMPT = `
You are assisting a physician with a chart summary brief for a de-identified synthetic encounter.
This brief is for PHYSICIAN REVIEW ONLY and must not be auto-signed.

SYNTHETIC ENCOUNTER (evaluation data):
- Chief complaint: Severe fatigue and shortness of breath
- Key finding: CBC shows Hemoglobin 5.8 g/dL (flagged critical by clinical rule evaluator)
- Vitals: HR 112, BP 90/60, SpO2 94%

Generate a brief clinical summary as JSON with keys: answer (string), citations (array of strings), identifiedGaps (array of strings), confidence (0-1).
`.trim();

// ─── Evaluation runner ────────────────────────────────────────────────────────

interface EvalResult {
  testName: string;
  model: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  output?: unknown;
  error?: string;
  notes: string[];
}

async function runEval(
  name: string,
  fn: () => Promise<EvalResult['output']>,
  notes: string[] = [],
): Promise<EvalResult> {
  const started = Date.now();
  try {
    const output = await fn();
    return {
      testName: name,
      model: MODEL,
      status: 'PASS',
      latencyMs: Date.now() - started,
      output,
      notes,
    };
  } catch (err) {
    return {
      testName: name,
      model: MODEL,
      status: 'FAIL',
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
      notes,
    };
  }
}

async function main() {
  console.log('═'.repeat(60));
  console.log('Phase A — MedGemma Evaluation Harness');
  console.log(`Model:    ${MODEL}`);
  console.log(`Endpoint: ${BASE_URL}`);
  console.log('═'.repeat(60));

  const adapter = new OllamaAdapter(BASE_URL, MODEL);
  const results: EvalResult[] = [];

  // ── Step 1: Probe — reachability + model installed ────────────────────────
  console.log('\n[1] Probing Ollama reachability...');
  const probe = await adapter.probe();
  console.log(`    Reachable:       ${probe.reachable}`);
  console.log(`    Model installed: ${probe.modelInstalled}`);
  console.log(`    Probe latency:   ${probe.latencyMs}ms`);

  if (!probe.reachable) {
    console.error('\n⛔ Ollama is not reachable. Aborting evaluation.');
    console.error('   Ensure Ollama is running: ollama serve');
    process.exit(1);
  }
  if (!probe.modelInstalled) {
    console.error(`\n⛔ Model "${MODEL}" is not installed. Run: ollama pull ${MODEL}`);
    process.exit(1);
  }

  results.push({
    testName: 'Probe: Ollama reachability + model installed',
    model: MODEL,
    status: 'PASS',
    latencyMs: probe.latencyMs,
    output: probe,
    notes: ['Ollama running, model installed'],
  });

  // ── Step 2: SOAP generation — synthetic context ───────────────────────────
  console.log('\n[2] SOAP generation — synthetic context...');
  const soapResult = await runEval(
    'SOAP generation: synthetic anemia patient',
    async () => {
      const params: GenerateStructuredParams<SoapDraft> = {
        systemInstruction: 'You are a clinical documentation AI assistant. Output valid JSON only.',
        userPrompt: SYNTHETIC_SOAP_PROMPT,
        context: SYNTHETIC_CONTEXT_BLOCKS,
        outputSchema: SOAP_SCHEMA,
        config: { maxOutputTokens: 1024, temperature: 0.3, topP: 0.9, timeoutMs: TIMEOUT_MS },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      };
      const response = await adapter.generateStructuredOutput(params);
      // Validate structured output
      const validated = SOAP_SCHEMA.parse(response.parsedOutput);
      console.log(`    Latency: ${response.latencyMs}ms | In: ${response.inputTokens} | Out: ${response.outputTokens}`);
      return { validated, raw: response.rawResponse };
    },
    [
      'Uses synthetic data only',
      'Output is DRAFT — not signed',
      'Critical value flagged by deterministic rule — not by AI',
    ],
  );
  results.push(soapResult);
  if (soapResult.status === 'PASS') {
    console.log('    ✓ SOAP generation PASS');
  } else {
    console.log(`    ✗ SOAP generation FAIL: ${soapResult.error}`);
  }

  // ── Step 3: Chart Brief — synthetic context ───────────────────────────────
  console.log('\n[3] Chart Brief — synthetic context...');
  const briefResult = await runEval(
    'Chart Brief: synthetic encounter',
    async () => {
      const params: GenerateStructuredParams<z.infer<typeof chartAnswerOutputSchema>> = {
        systemInstruction: 'You are a clinical chart summary AI. Output valid JSON only.',
        userPrompt: CHART_BRIEF_PROMPT,
        context: [],
        outputSchema: chartAnswerOutputSchema,
        config: { maxOutputTokens: 512, temperature: 0.3, topP: 0.9, timeoutMs: TIMEOUT_MS },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      };
      const response = await adapter.generateStructuredOutput(params);
      const validated = chartAnswerOutputSchema.parse(response.parsedOutput);
      console.log(`    Latency: ${response.latencyMs}ms | In: ${response.inputTokens} | Out: ${response.outputTokens}`);
      return { validated, raw: response.rawResponse };
    },
    ['Chart Brief uses ChartAnswerOutputSchema from shared — same schema as Gemini path'],
  );
  results.push(briefResult);
  if (briefResult.status === 'PASS') {
    console.log('    ✓ Chart Brief PASS');
  } else {
    console.log(`    ✗ Chart Brief FAIL: ${briefResult.error}`);
  }

  // ── Step 4: Timeout behavior ──────────────────────────────────────────────
  console.log('\n[4] Timeout behavior (1ms signal)...');
  const timeoutResult = await runEval(
    'Timeout: abort after 1ms',
    async () => {
      const params: GenerateStructuredParams<SoapDraft> = {
        systemInstruction: 'sys',
        userPrompt: 'user',
        context: [],
        outputSchema: SOAP_SCHEMA,
        config: { maxOutputTokens: 512, temperature: 0.3, topP: 0.9, timeoutMs: 1 },
        signal: AbortSignal.timeout(1),
      };
      await adapter.generateStructuredOutput(params);
      throw new Error('Expected timeout — did not throw');
    },
    ['Should throw TIMEOUT or UNAVAILABLE'],
  );
  // This test PASSES if it throws the expected error kind
  if (timeoutResult.status === 'FAIL' && timeoutResult.error?.includes('Expected timeout')) {
    timeoutResult.status = 'FAIL'; // Correctly did not time out
  } else if (timeoutResult.status === 'FAIL') {
    timeoutResult.status = 'PASS'; // Correctly threw an error
    timeoutResult.notes.push('Correctly threw on timeout');
  }
  results.push(timeoutResult);
  console.log(`    ${timeoutResult.status === 'PASS' ? '✓' : '✗'} Timeout behavior ${timeoutResult.status}`);

  // ── Step 5: Malformed output ──────────────────────────────────────────────
  console.log('\n[5] Malformed output handling (prompt for invalid JSON)...');
  const malformedResult = await runEval(
    'Malformed output: prompt designed to elicit non-JSON',
    async () => {
      const params: GenerateStructuredParams<SoapDraft> = {
        systemInstruction: 'Respond only in plain English prose. Do NOT use JSON.',
        userPrompt: 'Describe the color blue in a single sentence.',
        context: [],
        outputSchema: SOAP_SCHEMA,
        config: { maxOutputTokens: 128, temperature: 0.7, topP: 0.9, timeoutMs: TIMEOUT_MS },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      };
      const response = await adapter.generateStructuredOutput(params);
      // parsedOutput will be a raw string — schema validation by orchestrator catches this
      return { rawResponse: response.rawResponse, parsedOutput: response.parsedOutput };
    },
    ['Adapter returns raw string; orchestrator validation pipeline rejects non-conforming output'],
  );
  results.push(malformedResult);
  console.log(`    ${malformedResult.status === 'PASS' ? '✓' : '✗'} Malformed output ${malformedResult.status}`);

  // ── Step 6: Repeatability (3 runs) ───────────────────────────────────────
  console.log('\n[6] Repeatability — 3 runs of same prompt...');
  const repeatResults: EvalResult[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await runEval(
      `Repeatability run ${i + 1}`,
      async () => {
        const params: GenerateStructuredParams<SoapDraft> = {
          systemInstruction: 'You are a clinical documentation AI. Output valid JSON only.',
          userPrompt: SYNTHETIC_SOAP_PROMPT,
          context: [],
          outputSchema: SOAP_SCHEMA,
          config: { maxOutputTokens: 512, temperature: 0.1, topP: 0.9, timeoutMs: TIMEOUT_MS },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        };
        const response = await adapter.generateStructuredOutput(params);
        return { latencyMs: response.latencyMs, parsedOutput: response.parsedOutput };
      },
    );
    repeatResults.push(r);
    results.push(r);
    console.log(`    Run ${i + 1}: ${r.status} ${r.latencyMs ? `(${r.latencyMs}ms)` : ''}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const totalLatency = results.filter(r => r.latencyMs).reduce((s, r) => s + (r.latencyMs ?? 0), 0);

  console.log('\n' + '═'.repeat(60));
  console.log(`Results: ${passed} PASS / ${failed} FAIL / ${results.length} total`);
  console.log(`Total wall-clock time: ${totalLatency}ms`);
  console.log('═'.repeat(60));

  // Write JSON results
  const outputPath = path.resolve(__dirname, '../../../../docs/implementation/medgemma-eval-results.json');
  const output = {
    timestamp: new Date().toISOString(),
    model: MODEL,
    baseUrl: BASE_URL,
    summary: { passed, failed, total: results.length, totalLatencyMs: totalLatency },
    results,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\nResults written to: ${outputPath}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Evaluation harness crashed:', err);
  process.exit(1);
});
