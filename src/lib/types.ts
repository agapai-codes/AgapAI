export interface EmergencyReport {
  id: string;
  transcript: string;
  incident_type: string;
  condition: string;
  location_description: string;
  latitude: number | null;
  longitude: number | null;
  people_affected: number;
  hazards: string[];
  urgency: 'high' | 'medium' | 'low';
  urgency_reason: string;
  first_aid: string;
  timestamp: Date;
  status: 'pending' | 'dispatched' | 'resolved';
}
