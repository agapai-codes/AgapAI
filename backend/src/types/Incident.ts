// backend/src/types/Incident.ts

export interface Incident {
  id: string;
  type: 'FIRE' | 'ACCIDENT' | 'MEDICAL' | 'DISASTER';
  location: string;
  coordinates: {
    lng: number;
    lat: number;
  };
  status: 'PENDING' | 'DISPATCHED' | 'RESOLVED';
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
