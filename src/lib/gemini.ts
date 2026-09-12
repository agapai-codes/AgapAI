const VALID_URGENCIES = ['critical', 'high', 'medium', 'low'];
const VALID_INCIDENT_TYPES = ['FIRE', 'ACCIDENT', 'MEDICAL', 'DISASTER', 'VIOLENCE', 'HAZARDOUS', 'MISSING_PERSON'] as const;

function normalizeIncidentType(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return 'MEDICAL';
  const upper = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if ((VALID_INCIDENT_TYPES as readonly string[]).includes(upper)) return upper;
  // Fuzzy match for common variations
  if (/FIRE|BURN|SMOKE/.test(upper)) return 'FIRE';
  if (/ACCIDENT|CRASH|COLLISION|VEHICLE/.test(upper)) return 'ACCIDENT';
  if (/MEDIC|INJUR|PAIN|BLEED|UNCONSCIOUS/.test(upper)) return 'MEDICAL';
  if (/FLOOD|EARTHQUAKE|TYPHOON|LANDSLIDE|DISASTER|STORM/.test(upper)) return 'DISASTER';
  if (/VIOLEN|GUN|STAB|ASSAULT|FIGHT|WEAPON|SHOOT/.test(upper)) return 'VIOLENCE';
  if (/CHEM|GAS|TOXIC|HAZMAT|RADIATION|SPILL/.test(upper)) return 'HAZARDOUS';
  if (/MISS|LOST|DISAPPEAR/.test(upper)) return 'MISSING_PERSON';
  return 'MEDICAL';
}

export interface ExtractedData {
  transcript: string;
  incident_type: string;
  condition: string;
  location_description: string;
  people_affected: number;
  hazards: string[];
  urgency: string;
  urgency_reason: string;
  confidence: number;
  consciousness: boolean;
  breathing: boolean;
  bleeding: boolean;
  recommended_unit_type?: string[];
  dispatch_priority_score?: number;
  triage_flags?: string[];
  response_actions?: Array<{ id: string; label: string; description: string; priority: string }>;
}

export async function extractEmergencyInfo(transcript: string): Promise<ExtractedData> {
  if (!transcript || typeof transcript !== 'string') {
    throw new Error('Invalid transcript');
  }

  const response = await fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  const payload = await response.json();
  const data = payload?.data ?? {};

  const urgency = VALID_URGENCIES.includes(data.urgency) ? data.urgency : 'medium';

  return {
    transcript,
    incident_type: normalizeIncidentType(data.incident_type),
    condition: data.condition || 'unknown',
    location_description: data.location_description || 'location unknown',
    people_affected: typeof data.people_affected === 'number' ? data.people_affected : 1,
    hazards: Array.isArray(data.hazards) ? data.hazards : [],
    urgency,
    urgency_reason: data.urgency_reason || 'Unable to determine urgency',
    confidence: typeof data.confidence === 'number' ? data.confidence : 0.7,
    consciousness: typeof data.consciousness === 'boolean' ? data.consciousness : true,
    breathing: typeof data.breathing === 'boolean' ? data.breathing : true,
    bleeding: typeof data.bleeding === 'boolean' ? data.bleeding : false,
    recommended_unit_type: Array.isArray(data.recommended_unit_type) ? data.recommended_unit_type : undefined,
    dispatch_priority_score: typeof data.dispatch_priority_score === 'number' ? data.dispatch_priority_score : undefined,
    triage_flags: Array.isArray(data.triage_flags) ? data.triage_flags : undefined,
    response_actions: Array.isArray(data.response_actions) ? data.response_actions : undefined,
  };
}
