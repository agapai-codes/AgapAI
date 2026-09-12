import type { IncidentType, UrgencyLevel } from '../types/incident';
import type { TriageRecommendation, UnitType, ResponseAction } from '../types/triage';
import { PRIORITY_WEIGHTS } from '../types/triage';

function getRecommendedUnits(type: IncidentType, hazards: string[]): UnitType[] {
  const units: UnitType[] = [];
  switch (type) {
    case 'FIRE':
      units.push('fire_truck');
      if (hazards.some(h => h.toLowerCase().includes('chemical'))) units.push('hazmat');
      break;
    case 'MEDICAL':
      units.push('ambulance');
      break;
    case 'ACCIDENT':
      units.push('ambulance', 'police');
      break;
    case 'VIOLENCE':
      units.push('police');
      break;
    case 'DISASTER':
      units.push('rescue', 'multi_agency');
      break;
    case 'HAZARDOUS':
      units.push('hazmat', 'fire_truck');
      break;
    case 'MISSING_PERSON':
      units.push('police', 'rescue');
      break;
  }
  return units;
}

function getResponseActions(
  type: IncidentType,
  urgency: UrgencyLevel,
  consciousness: boolean | null,
  breathing: boolean | null,
  bleeding: boolean,
  peopleAffected: number,
): ResponseAction[] {
  const actions: ResponseAction[] = [];

  if (urgency === 'critical') {
    actions.push({
      id: 'immediate_dispatch',
      label: 'Immediate Dispatch',
      description: 'Deploy all available units to scene immediately.',
      priority: 'immediate',
      unit_required: getRecommendedUnits(type, []),
    });
  }

  if (breathing === false || consciousness === false) {
    actions.push({
      id: 'cpr_on_site',
      label: 'CPR / Life Support On-Site',
      description: 'Ensure on-site personnel begin CPR or life-support measures.',
      priority: 'immediate',
      unit_required: ['ambulance'],
    });
  }

  if (bleeding) {
    actions.push({
      id: 'hemorrhage_control',
      label: 'Hemorrhage Control',
      description: 'Apply direct pressure or tourniquet as trained.',
      priority: 'immediate',
      unit_required: ['ambulance'],
    });
  }

  if (peopleAffected > 3) {
    actions.push({
      id: 'multi_patient',
      label: 'Multi-Patient Protocol',
      description: 'Activate mass-casualty triage protocol.',
      priority: 'secondary',
      unit_required: ['ambulance', 'rescue'],
    });
  }

  if (type === 'FIRE' || type === 'HAZARDOUS') {
    actions.push({
      id: 'perimeter_secure',
      label: 'Perimeter Security',
      description: 'Establish a safe perimeter and evacuate nearby civilians.',
      priority: 'secondary',
      unit_required: ['police'],
    });
  }

  actions.push({
    id: 'scene_document',
    label: 'Scene Documentation',
      description: 'Record scene details for post-incident analysis.',
    priority: 'optional',
    unit_required: [],
  });

  return actions;
}

function getSeverityScore(
  urgency: UrgencyLevel,
  consciousness: boolean | null,
  breathing: boolean | null,
  bleeding: boolean,
  peopleAffected: number,
): number {
  let score = PRIORITY_WEIGHTS.urgency[urgency];

  if (consciousness === false) score += PRIORITY_WEIGHTS.vitals.unconscious;
  if (breathing === false) score += PRIORITY_WEIGHTS.vitals.not_breathing;
  if (bleeding) score += PRIORITY_WEIGHTS.vitals.bleeding;
  score += (peopleAffected - 1) * PRIORITY_WEIGHTS.people_per_person;

  return Math.min(10, Math.round(score * 10) / 10);
}

export function calculatePriorityScore(
  severity: number,
  timeElapsedMinutes: number,
  confidence: number,
): number {
  const baseScore = (severity / 10) * 70;
  const timeBoost = Math.min(timeElapsedMinutes * PRIORITY_WEIGHTS.time_decay_per_minute, 20);
  const confidencePenalty = (1 - confidence) * 10;
  return Math.round(Math.min(100, Math.max(0, baseScore + timeBoost - confidencePenalty)));
}

export function generateTriageRecommendation(
  type: IncidentType,
  urgency: UrgencyLevel,
  confidence: number,
  peopleAffected: number,
  consciousness: boolean | null,
  breathing: boolean | null,
  bleeding: boolean,
  hazards: string[],
): TriageRecommendation {
  const severity = getSeverityScore(urgency, consciousness, breathing, bleeding, peopleAffected);
  const dispatchPriorityScore = calculatePriorityScore(severity, 0, confidence);
  const units = getRecommendedUnits(type, hazards);
  const actions = getResponseActions(type, urgency, consciousness, breathing, bleeding, peopleAffected);

  const triageFlags: string[] = [];
  if (consciousness === false) triageFlags.push('UNCONSCIOUS');
  if (breathing === false) triageFlags.push('NOT_BREATHING');
  if (bleeding) triageFlags.push('ACTIVE_BLEEDING');
  if (peopleAffected > 3) triageFlags.push('MASS_CASUALTY');
  if (confidence < 0.5) triageFlags.push('LOW_CONFIDENCE');

  const estimatedResponseTime = urgency === 'critical' ? 5 : urgency === 'high' ? 10 : urgency === 'medium' ? 20 : 30;

  const escalationNeeded = severity >= 7 || triageFlags.includes('MASS_CASUALTY') || triageFlags.includes('UNCONSCIOUS') || triageFlags.includes('NOT_BREATHING');

  const escalationReasons: string[] = [];
  if (severity >= 7) escalationReasons.push(`Severity score ${severity}/10 exceeds threshold.`);
  if (triageFlags.includes('MASS_CASUALTY')) escalationReasons.push('Mass-casualty event detected.');
  if (triageFlags.includes('UNCONSCIOUS')) escalationReasons.push('Unconscious patient detected.');
  if (triageFlags.includes('NOT_BREATHING')) escalationReasons.push('Respiratory failure detected.');

  return {
    recommended_units: units,
    response_actions: actions,
    triage_flags: triageFlags,
    severity_score: severity,
    dispatch_priority_score: dispatchPriorityScore,
    estimated_response_time_minutes: estimatedResponseTime,
    escalation_needed: escalationNeeded,
    escalation_reason: escalationNeeded ? escalationReasons.join(' ') : undefined,
  };
}

// Recalculate priority score with actual elapsed time
export function recalculatePriorityScore(
  severity: number,
  confidence: number,
  elapsedMinutes: number
): number {
  return calculatePriorityScore(severity, elapsedMinutes, confidence);
}
