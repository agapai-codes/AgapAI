import { EmergencyReport } from './types';

const VALID_URGENCIES = ['critical', 'high', 'medium', 'low'];

export async function extractEmergencyInfo(
  transcript: string
): Promise<Omit<EmergencyReport, 'id' | 'timestamp' | 'status' | 'first_aid' | 'latitude' | 'longitude'>> {
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
  const incidentType = typeof data.incident_type === 'string' ? data.incident_type.toLowerCase() : 'other';

  return {
    transcript,
    incident_type: incidentType,
    condition: data.condition || 'unknown',
    location_description: data.location_description || 'location unknown',
    people_affected: typeof data.people_affected === 'number' ? data.people_affected : 1,
    hazards: Array.isArray(data.hazards) ? data.hazards : [],
    urgency,
    urgency_reason: data.urgency_reason || 'Unable to determine urgency',
  };
}
