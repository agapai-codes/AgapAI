import type { IncidentReport, UrgencyLevel } from '../types/incident';

/** Urgency weight scale — higher = more urgent */
export const URGENCY_WEIGHTS: Record<UrgencyLevel, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * Sort incidents by urgency severity (descending), then by most recent timestamp.
 * HIGH (3) > MEDIUM (2) > LOW (1).
 * Tie-breaker: newest first.
 */
export function sortByUrgencySeverity(a: IncidentReport, b: IncidentReport): number {
  const weightA = URGENCY_WEIGHTS[a.urgency] ?? 0;
  const weightB = URGENCY_WEIGHTS[b.urgency] ?? 0;
  if (weightA !== weightB) return weightB - weightA;
  return new Date(b.timeReported).getTime() - new Date(a.timeReported).getTime();
}

/**
 * Sort incidents for queue display: urgency severity desc, then timestamp desc.
 * Safe for direct use in React sorted lists.
 */
export function sortIncidentsForQueue(incidents: IncidentReport[]): IncidentReport[] {
  return [...incidents].sort(sortByUrgencySeverity);
}
