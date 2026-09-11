import { EmergencyReport } from './types';
import { getFirstAid } from './firstAid';

export async function extractEmergencyInfo(transcript: string): Promise<Omit<EmergencyReport, 'id' | 'timestamp' | 'status' | 'first_aid' | 'latitude' | 'longitude'>> {
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

  const data = await response.json();

  return {
    transcript,
    incident_type: data.incident_type || 'other',
    condition: data.condition || 'unknown',
    location_description: data.location_description || 'location unknown',
    people_affected: typeof data.people_affected === 'number' ? data.people_affected : 1,
    hazards: Array.isArray(data.hazards) ? data.hazards : [],
    urgency: VALID_URGENCIES.includes(data.urgency) ? data.urgency : 'medium',
    urgency_reason: data.urgency_reason || 'Unable to determine urgency',
  };
}

const VALID_URGENCIES = ['critical', 'high', 'medium', 'low'];
