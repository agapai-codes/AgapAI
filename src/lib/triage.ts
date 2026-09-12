import type { IncidentType } from '@/types/incident';
import type { TriageRecommendation, UnitType, ResponseAction } from '@/types/triage';

export function generateTriageRecommendation(
  incident_type: IncidentType,
  urgency: string,
  consciousness: boolean,
  breathing: boolean,
  bleeding: boolean,
  people_affected: number,
  hazards: string[],
): TriageRecommendation {
  const recommended_units = detectUnitTypes(incident_type, hazards);
  const response_actions = buildResponseActions(incident_type, urgency, consciousness, breathing, bleeding);
  const triage_flags = buildFlags(consciousness, breathing, bleeding, hazards, people_affected);
  const severity_score = calculateSeverity(urgency, consciousness, breathing, bleeding, people_affected);
  const dispatch_priority_score = calculateDispatchPriority(urgency, consciousness, breathing, bleeding, people_affected);
  const estimated_response_time_minutes = estimateResponseTime(urgency);
  const escalation_needed = severity_score >= 7 || !consciousness || !breathing;

  return {
    recommended_units,
    response_actions,
    triage_flags,
    severity_score,
    dispatch_priority_score,
    estimated_response_time_minutes,
    escalation_needed,
    escalation_reason: escalation_needed ? `Severity ${severity_score}/10; consciousness=${consciousness}; breathing=${breathing}` : undefined,
  };
}

function detectUnitTypes(incident_type: IncidentType, hazards: string[]): UnitType[] {
  const units: UnitType[] = [];
  switch (incident_type) {
    case 'FIRE':
      units.push('fire_truck');
      break;
    case 'ACCIDENT':
      units.push('ambulance', 'rescue');
      break;
    case 'MEDICAL':
      units.push('ambulance');
      break;
    case 'DISASTER':
      units.push('ambulance', 'fire_truck', 'rescue', 'multi_agency');
      break;
    case 'VIOLENCE':
      units.push('police', 'ambulance');
      break;
    case 'HAZARDOUS':
      units.push('hazmat', 'fire_truck');
      break;
    case 'MISSING_PERSON':
      units.push('police', 'rescue');
      break;
  }
  if (hazards.some(h => /electr|gas|chemical|hazmat/.test(h)) && !units.includes('hazmat')) {
    units.push('hazmat');
  }
  return [...new Set(units)];
}

function buildResponseActions(
  incident_type: IncidentType,
  urgency: string,
  consciousness: boolean,
  breathing: boolean,
  bleeding: boolean,
): ResponseAction[] {
  const actions: ResponseAction[] = [];
  if (!breathing) {
    actions.push({ id: 'cpr', label: 'Initiate CPR', description: 'Patient not breathing; initiate resuscitation', priority: 'immediate', unit_required: ['ambulance'] });
  }
  if (bleeding) {
    actions.push({ id: 'hemorrhage_control', label: 'Control Hemorrhage', description: 'Apply tourniquet or direct pressure', priority: 'immediate', unit_required: ['ambulance'] });
  }
  if (!consciousness) {
    actions.push({ id: 'airway_assess', label: 'Assess Airway', description: 'Check and maintain airway patency', priority: 'immediate', unit_required: ['ambulance'] });
  }
  if (incident_type === 'FIRE') {
    actions.push({ id: 'fire_suppress', label: 'Fire Suppression', description: 'Deploy fire suppression equipment', priority: 'immediate', unit_required: ['fire_truck'] });
  }
  if (incident_type === 'VIOLENCE') {
    actions.push({ id: 'scene_secure', label: 'Secure Scene', description: 'Ensure scene safety before patient contact', priority: 'immediate', unit_required: ['police'] });
  }
  if (incident_type === 'HAZARDOUS') {
    actions.push({ id: 'hazmat_contain', label: 'Hazmat Containment', description: 'Identify and contain hazardous material', priority: 'immediate', unit_required: ['hazmat'] });
  }
  if (actions.length === 0) {
    actions.push({ id: 'standard_assess', label: 'Standard Assessment', description: 'Perform standard emergency assessment', priority: 'secondary', unit_required: ['ambulance'] });
  }
  return actions;
}

function buildFlags(consciousness: boolean, breathing: boolean, bleeding: boolean, hazards: string[], people_affected: number): string[] {
  const flags: string[] = [];
  if (!consciousness) flags.push('unconscious');
  if (!breathing) flags.push('not_breathing');
  if (bleeding) flags.push('active_bleeding');
  if (people_affected > 5) flags.push('mass_casualty');
  if (hazards.some(h => /electr|gas|chemical|hazmat|radiation/.test(h))) flags.push('hazmat_scene');
  return flags;
}

function calculateSeverity(urgency: string, consciousness: boolean, breathing: boolean, bleeding: boolean, people_affected: number): number {
  let score = 0;
  const urgMap: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  score += urgMap[urgency] ?? 2;
  if (!consciousness) score += 2;
  if (!breathing) score += 2;
  if (bleeding) score += 1;
  score += Math.min(people_affected * 0.2, 2);
  return Math.min(Math.round(score * 10) / 10, 10);
}

function calculateDispatchPriority(urgency: string, consciousness: boolean, breathing: boolean, bleeding: boolean, people_affected: number): number {
  const urgMap: Record<string, number> = { critical: 40, high: 30, medium: 20, low: 10 };
  let score = urgMap[urgency] ?? 20;
  if (!consciousness) score += 20;
  if (!breathing) score += 20;
  if (bleeding) score += 10;
  score += Math.min(people_affected * 2, 10);
  return Math.min(Math.round(score), 100);
}

function estimateResponseTime(urgency: string): number {
  switch (urgency) {
    case 'critical': return 5;
    case 'high': return 10;
    case 'medium': return 20;
    case 'low': return 30;
    default: return 15;
  }
}
