import { describe, it, expect } from 'vitest';
import { sortByUrgencySeverity, URGENCY_WEIGHTS, sortIncidentsForQueue } from '../utils/queueSorting';
import type { IncidentReport } from '../types/incident';

function makeIncident(overrides: Partial<IncidentReport> = {}): IncidentReport {
  return {
    id: 'test-1',
    type: 'MEDICAL',
    urgency: 'MEDIUM',
    condition: 'Test incident',
    injuriesSymptoms: [],
    vitals: { conscious: null, breathing: null, bleeding: null },
    peopleCount: 1,
    location: { landmarkText: 'Test Location', coordinates: [124.24, 8.23], confidenceScore: 90 },
    hazards: [],
    relevantContext: '',
    timeReported: new Date().toISOString(),
    aiTriage: { assessedUrgency: 'MEDIUM', confidence: 0.8, contributingFactors: [], rationaleNote: 'Test' },
    status: 'PENDING',
    assignedUnits: [],
    relatedReportIds: [],
    ...overrides,
  };
}

describe('URGENCY_WEIGHTS', () => {
  it('CRITICAL has highest weight', () => {
    expect(URGENCY_WEIGHTS.CRITICAL).toBeGreaterThan(URGENCY_WEIGHTS.HIGH);
    expect(URGENCY_WEIGHTS.HIGH).toBeGreaterThan(URGENCY_WEIGHTS.MEDIUM);
    expect(URGENCY_WEIGHTS.MEDIUM).toBeGreaterThan(URGENCY_WEIGHTS.LOW);
  });

  it('contains exactly 4 tiers', () => {
    expect(Object.keys(URGENCY_WEIGHTS)).toHaveLength(4);
  });
});

describe('sortByUrgencySeverity', () => {
  it('sorts HIGH before MEDIUM', () => {
    const high = makeIncident({ id: 'high-1', urgency: 'HIGH' });
    const med = makeIncident({ id: 'med-1', urgency: 'MEDIUM' });
    expect(sortByUrgencySeverity(high, med)).toBeLessThan(0);
  });

  it('sorts MEDIUM before LOW', () => {
    const med = makeIncident({ id: 'med-1', urgency: 'MEDIUM' });
    const low = makeIncident({ id: 'low-1', urgency: 'LOW' });
    expect(sortByUrgencySeverity(med, low)).toBeLessThan(0);
  });

  it('same urgency sorts by most recent first', () => {
    const older = makeIncident({ id: 'old', urgency: 'HIGH', timeReported: '2026-01-01T00:00:00Z' });
    const newer = makeIncident({ id: 'new', urgency: 'HIGH', timeReported: '2026-09-13T00:00:00Z' });
    expect(sortByUrgencySeverity(newer, older)).toBeLessThan(0);
  });
});

describe('sortIncidentsForQueue', () => {
  it('returns sorted copy without mutating original', () => {
    const incidents = [
      makeIncident({ id: 'low', urgency: 'LOW' }),
      makeIncident({ id: 'high', urgency: 'HIGH' }),
      makeIncident({ id: 'med', urgency: 'MEDIUM' }),
    ];
    const sorted = sortIncidentsForQueue(incidents);
    expect(sorted[0].urgency).toBe('HIGH');
    expect(sorted[1].urgency).toBe('MEDIUM');
    expect(sorted[2].urgency).toBe('LOW');
    expect(incidents[0].urgency).toBe('LOW'); // original unchanged
  });
});
