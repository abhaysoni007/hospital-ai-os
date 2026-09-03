/**
 * M19.2 — Hospital Intelligence Configurable Operational Thresholds
 * SOURCE OF TRUTH: docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md §6.2, §25
 *
 * NOTE: These are provisional operational demo thresholds, NOT clinically validated standards.
 * All thresholds are configurable via environment variables and must be reviewed
 * by institutional clinical governance before any real clinical deployment.
 */
export const HOSPITAL_INTELLIGENCE_THRESHOLDS = {
  /**
   * PENDING_DIAGNOSTIC_RESULT:
   * Elapsed time in hours before an active routine diagnostic order without results is flagged.
   * Default: 4 hours (demo threshold).
   */
  PENDING_DIAGNOSTIC_ROUTINE_HOURS: Number(
    process.env.INTELLIGENCE_PENDING_ROUTINE_HOURS ?? 4,
  ),

  /**
   * PENDING_DIAGNOSTIC_RESULT (STAT / Urgent):
   * Elapsed time in hours before an active STAT order without results is flagged.
   * Default: 1 hour (demo threshold).
   */
  PENDING_DIAGNOSTIC_STAT_HOURS: Number(
    process.env.INTELLIGENCE_PENDING_STAT_HOURS ?? 1,
  ),

  /**
   * CRITICAL_RESULT_UNACKNOWLEDGED:
   * Elapsed time in minutes before an unacknowledged critical lab alert is flagged.
   * Default: 30 minutes (demo threshold).
   */
  CRITICAL_RESULT_UNACKNOWLEDGED_MINUTES: Number(
    process.env.INTELLIGENCE_CRITICAL_ALERT_MINUTES ?? 30,
  ),

  /**
   * ENCOUNTER_WITHOUT_CLINICAL_RECORD:
   * Elapsed time in hours before an active encounter without a signed note is flagged.
   * Default: 2 hours (demo threshold).
   */
  ENCOUNTER_WITHOUT_NOTE_HOURS: Number(
    process.env.INTELLIGENCE_ENCOUNTER_NOTE_HOURS ?? 2,
  ),
} as const;
