// src/types/incident.ts

export type IncidentType = 'FIRE' | 'ACCIDENT' | 'MEDICAL' | 'DISASTER';
export type IncidentStatus = 'PENDING' | 'DISPATCHED' | 'RESOLVED';

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
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
