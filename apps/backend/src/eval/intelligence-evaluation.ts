/**
 * M19.5 — Hospital Intelligence Operational Evaluation Runner
 *
 * Deterministic, reproducible evaluation harness for existing M19.0-M19.4 capabilities.
 * Exercises real production services and policies against synthetic fixtures.
 * ZERO real patient data / PHI.
 *
 * Usage:
 *   pnpm --filter backend eval:intelligence
 *
 * Output:
 *   docs/evaluation/m19-5-results.json
 */

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { runFullEvaluationBattery } from '../modules/hospital-intelligence/__tests__/m19-5-scenarios';

function getGitCommitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'UNKNOWN_GIT_SHA';
  }
}

async function main() {
  console.log('═'.repeat(70));
  console.log(' M19.5 Hospital Intelligence Operational Evaluation & Safety Gate');
  console.log(' Principle: AI recommends → Policy validates → Human authorizes → Service executes');
  console.log(' Scope: Operational workflow intelligence ONLY — Zero clinical claims');
  console.log('═'.repeat(70));
  console.log('\n[1/3] Executing Scenario Battery (A through N)...');

  const startTime = Date.now();
  const batteryReport = await runFullEvaluationBattery();
  const totalDuration = Date.now() - startTime;

  for (const s of batteryReport.scenarios) {
    const symbol = s.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`  ${symbol} Scenario ${s.scenarioId.padEnd(2)}: ${s.name} (${s.durationMs}ms)`);
    if (!s.passed) {
      console.log(`         Expected: ${s.expected}`);
      console.log(`         Observed: ${s.observed}`);
    }
  }

  console.log('\n[2/3] Verifying Ten Safety Invariants...');
  for (const inv of batteryReport.invariants) {
    const symbol = inv.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`  ${symbol} Invariant ${String(inv.invariantNumber).padStart(2)}: ${inv.name}`);
  }

  console.log('\n[3/3] Measured Evaluation Metrics (Exact Numerators/Denominators):');
  console.log('─'.repeat(70));
  console.log(
    `${'Metric'.padEnd(38)} | ${'Numerator'.padStart(9)} | ${'Denominator'.padStart(11)} | ${'Rate'.padStart(8)}`,
  );
  console.log('─'.repeat(70));

  for (const [, metric] of Object.entries(batteryReport.metrics)) {
    console.log(
      `${metric.name.padEnd(38)} | ${String(metric.numerator).padStart(9)} | ${String(metric.denominator).padStart(11)} | ${metric.percentageString.padStart(8)}`,
    );
  }
  console.log('─'.repeat(70));

  const sha = getGitCommitSha();
  const passedAll = batteryReport.summary.failedScenarios === 0 && batteryReport.summary.failedInvariants === 0;

  console.log('\n' + '═'.repeat(70));
  console.log(`Summary: ${batteryReport.summary.passedScenarios}/${batteryReport.summary.totalScenarios} Scenarios Passed | ` +
    `${batteryReport.summary.passedInvariants}/${batteryReport.summary.totalInvariants} Invariants Passed`);
  console.log(`Safety Gate Status: ${passedAll ? 'PASSED' : 'FAILED'}`);
  console.log(`Execution Time: ${totalDuration}ms | Commit: ${sha.slice(0, 10)}`);
  console.log('═'.repeat(70));

  // Write machine-readable artifact
  const outputPath = path.resolve(__dirname, '../../../../docs/evaluation/m19-5-results.json');
  const artifactPayload = {
    milestone: 'M19.5',
    title: 'Hospital Intelligence Evaluation & Safety Gate Results',
    generatedAt: batteryReport.timestamp,
    gitCommitSha: sha,
    environment: {
      testMode: 'synthetic_operational_evaluation',
      database: 'postgresql_isolated_fixtures',
      aiProvider: 'mocked_structured_orchestrator',
      phiStatus: 'ZERO_PHI_SYNTHETIC_ONLY',
    },
    safetyGateResult: passedAll ? 'PASS' : 'FAIL',
    scenarios: batteryReport.scenarios,
    safetyInvariants: batteryReport.invariants,
    metrics: batteryReport.metrics,
    summary: {
      ...batteryReport.summary,
      totalExecutionDurationMs: totalDuration,
    },
    limitations: [
      'Operational workflow intelligence evaluation ONLY.',
      'Does not claim clinical validation, diagnostic efficacy, or patient outcome improvement.',
      'All tests executed against synthetic fixtures and isolated demo data.',
    ],
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(artifactPayload, null, 2), 'utf-8');
  console.log(`\nMachine-readable evaluation results written to: ${outputPath}\n`);

  process.exit(passedAll ? 0 : 1);
}

main().catch((err) => {
  console.error('Hospital intelligence evaluation runner crashed:', err);
  process.exit(1);
});
