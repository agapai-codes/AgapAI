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
  urgency?: UrgencyLevel;
  urgency_reason?: string;
  people_affected?: number;
  hazards?: string[];
  condition?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
