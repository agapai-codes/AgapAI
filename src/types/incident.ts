// src/types/incident.ts

export type IncidentType = 'FIRE' | 'ACCIDENT' | 'MEDICAL' | 'DISASTER' | 'VIOLENCE' | 'HAZARDOUS' | 'MISSING_PERSON';
export type IncidentStatus = 'PENDING' | 'DISPATCHED' | 'RESOLVED';
export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

export interface Incident {
  id: string;
  type: IncidentType;
  location: string;
  description: string;
  coordinates: {
    lng: number;
    lat: number;
  };
  status: IncidentStatus;
  timestamp: string;
  reporter: string;
  reporter_email?: string;
  urgency?: UrgencyLevel;
  urgency_reason?: string;
  people_affected?: number;
  hazards?: string[];
  condition?: string;
  confidence?: number;
  consciousness?: boolean;
  breathing?: boolean;
  bleeding?: boolean;
  assigned_responder_id?: string;
  assigned_responder_name?: string;
  resolution_notes?: string;
  dispatched_at?: string;
  resolved_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
