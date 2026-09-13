import { describe, it, expect } from 'vitest';
import {
  toIncidentType,
  toUrgencyLevel,
  incidentToReport,
  reportToIncident,
  URGENCY_PRIORITY,
  canTransition,
  nextStatus,
  STATUS_ORDER,
} from '../types/incident';
import type { Incident, IncidentReport } from '../types/incident';

describe('toIncidentType', () => {
  it('maps FIRE correctly', () => {
    expect(toIncidentType('FIRE')).toBe('FIRE');
    expect(toIncidentType('fire')).toBe('FIRE');
  });

  it('maps DISASTER to NATURAL_DISASTER', () => {
    expect(toIncidentType('DISASTER')).toBe('NATURAL_DISASTER');
    expect(toIncidentType('disaster')).toBe('NATURAL_DISASTER');
  });

  it('maps HAZARDOUS to FIRE (closest match)', () => {
    expect(toIncidentType('HAZARDOUS')).toBe('FIRE');
  });

  it('maps MISSING_PERSON to MEDICAL (closest match)', () => {
    expect(toIncidentType('MISSING_PERSON')).toBe('MEDICAL');
  });

  it('defaults to MEDICAL for unknown types', () => {
    expect(toIncidentType('UNKNOWN')).toBe('MEDICAL');
    expect(toIncidentType('')).toBe('MEDICAL');
  });
});

describe('toUrgencyLevel', () => {
  it('maps CRITICAL to HIGH', () => {
    expect(toUrgencyLevel('CRITICAL')).toBe('HIGH');
    expect(toUrgencyLevel('critical')).toBe('HIGH');
  });

  it('preserves HIGH', () => {
    expect(toUrgencyLevel('HIGH')).toBe('HIGH');
    expect(toUrgencyLevel('high')).toBe('HIGH');
  });

  it('preserves MEDIUM', () => {
    expect(toUrgencyLevel('MEDIUM')).toBe('MEDIUM');
  });

  it('preserves LOW', () => {
    expect(toUrgencyLevel('LOW')).toBe('LOW');
  });

  it('defaults to LOW for unknown values, MEDIUM for empty/undefined', () => {
    expect(toUrgencyLevel('UNKNOWN')).toBe('LOW');
    expect(toUrgencyLevel(undefined)).toBe('MEDIUM');
    expect(toUrgencyLevel('')).toBe('MEDIUM');
  });
});

describe('URGENCY_PRIORITY', () => {
  it('HIGH has highest priority', () => {
    expect(URGENCY_PRIORITY.HIGH).toBeGreaterThan(URGENCY_PRIORITY.MEDIUM);
    expect(URGENCY_PRIORITY.MEDIUM).toBeGreaterThan(URGENCY_PRIORITY.LOW);
  });

  it('does not contain CRITICAL', () => {
    expect(URGENCY_PRIORITY).not.toHaveProperty('CRITICAL');
  });
});

describe('incidentToReport', () => {
  it('converts Incident to IncidentReport correctly', () => {
    const incident: Incident = {
      id: 'test-1',
      type: 'MEDICAL',
      location: 'Test Location',
      description: 'Test description',
      coordinates: { lng: 124.24, lat: 8.23 },
      status: 'PENDING',
      timestamp: '2026-09-13T00:00:00Z',
      reporter: 'Test User',
      urgency: 'HIGH',
      urgency_reason: 'Test reason',
      people_affected: 2,
      condition: 'Test condition',
      consciousness: false,
      breathing: true,
      bleeding: true,
      hazards: ['fire'],
      transcript: 'Test transcript',
    };

    const report = incidentToReport(incident, 'Custom rationale');

    expect(report.id).toBe('test-1');
    expect(report.type).toBe('MEDICAL');
    expect(report.urgency).toBe('HIGH');
    expect(report.condition).toBe('Test condition');
    expect(report.peopleCount).toBe(2);
    expect(report.location.landmarkText).toBe('Test Location');
    expect(report.location.coordinates).toEqual([124.24, 8.23]);
    expect(report.vitals.conscious).toBe(false);
    expect(report.vitals.breathing).toBe(true);
    expect(report.vitals.bleeding).toBe(true);
    expect(report.aiTriage.rationaleNote).toBe('Custom rationale');
    expect(report.voiceReport?.transcriptionText).toBe('Test transcript');
    expect(report.hazards).toEqual(['fire']);
  });

  it('uses default values for missing fields', () => {
    const incident: Incident = {
      id: 'test-2',
      type: 'FIRE',
      location: 'Location',
      description: 'Desc',
      coordinates: { lng: 0, lat: 0 },
      status: 'PENDING',
      timestamp: '2026-01-01T00:00:00Z',
      reporter: 'User',
    };

    const report = incidentToReport(incident);
    expect(report.condition).toBe('Desc');
    expect(report.peopleCount).toBe(1);
    expect(report.aiTriage.rationaleNote).toBe('Standard assessment');
    expect(report.vitals.conscious).toBeNull();
  });
});

describe('canTransition', () => {
  it('allows PENDING -> REVIEWING', () => {
    expect(canTransition('PENDING', 'REVIEWING')).toBe(true);
  });

  it('allows PENDING -> DISPATCHED', () => {
    expect(canTransition('PENDING', 'DISPATCHED')).toBe(true);
  });

  it('allows PENDING -> RESOLVED', () => {
    expect(canTransition('PENDING', 'RESOLVED')).toBe(true);
  });

  it('disallows RESOLVED -> any', () => {
    expect(canTransition('RESOLVED', 'PENDING')).toBe(false);
    expect(canTransition('RESOLVED', 'DISPATCHED')).toBe(false);
  });

  it('disallows backwards transitions', () => {
    expect(canTransition('DISPATCHED', 'PENDING')).toBe(false);
    expect(canTransition('ARRIVED', 'EN_ROUTE')).toBe(false);
  });
});

describe('nextStatus', () => {
  it('returns REVIEWING after PENDING', () => {
    expect(nextStatus('PENDING')).toBe('REVIEWING');
  });

  it('returns DISPATCHED after PRIORITIZED', () => {
    expect(nextStatus('PRIORITIZED')).toBe('DISPATCHED');
  });

  it('returns null after RESOLVED', () => {
    expect(nextStatus('RESOLVED')).toBeNull();
  });
});

describe('STATUS_ORDER', () => {
  it('PENDING is first', () => {
    expect(STATUS_ORDER.PENDING).toBe(0);
  });

  it('RESOLVED is last', () => {
    expect(STATUS_ORDER.RESOLVED).toBe(6);
  });
});
