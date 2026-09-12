import { EmergencyReport } from './types';

const VALID_URGENCIES = ['critical', 'high', 'medium', 'low'];

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
    incident_type: typeof data.incident_type === 'string' ? data.incident_type.toLowerCase() : 'other',
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
  };
}
