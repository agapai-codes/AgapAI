// Structured entity extraction schema
// This defines what the AI extracts from natural speech

import type { IncidentType, UrgencyLevel } from './incident';

export interface ExtractionSchema {
  // Core incident data
  incident_type: IncidentType;
  condition: string;
  location_description: string;
  coordinates?: { lat: number; lng: number };

  // Medical vitals
  consciousness: boolean | null;
  breathing: boolean | null;
  bleeding: boolean;
  injuries: string[]; // Structured injury list

  // People & hazards
  people_affected: number;
  hazards: string[];

  // Urgency & confidence
  urgency: UrgencyLevel;
  urgency_reason: string;
  confidence: number;

  // Caller info
  caller_name?: string;
  caller_phone?: string;

  // Timestamps
  reported_at: string;
  extracted_at: string;
}

export interface ExtractionResult {
  success: boolean;
  data: ExtractionSchema;
  provider: 'gemini' | 'fallback';
  processing_time_ms: number;
  warnings: string[];
}

// Input to extraction
export interface ExtractionInput {
  transcript: string;
  gps_coords?: { lat: number; lng: number };
  language?: string;
  mode: 'demo' | 'live';
}
