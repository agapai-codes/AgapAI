import type { IncidentType, UrgencyLevel } from './incident';

// Priority weights for queue scoring
export const PRIORITY_WEIGHTS = {
  urgency: {
    CRITICAL: 4.0,
    HIGH: 3.0,
    MEDIUM: 2.0,
    LOW: 1.0,
  },
  vitals: {
    unconscious: 2.0,
    not_breathing: 2.0,
    bleeding: 1.0,
  },
  people_per_person: 0.2, // Extra weight per affected person
  time_decay_per_minute: 0.1, // Priority increases as time passes
} as const;

// Recommended unit types
export type UnitType = 'ambulance' | 'fire_truck' | 'police' | 'hazmat' | 'rescue' | 'multi_agency';

// Response action recommendations
export interface ResponseAction {
  id: string;
  label: string;
  description: string;
  priority: 'immediate' | 'secondary' | 'optional';
  unit_required: UnitType[];
}

// Triage recommendation from AI
export interface TriageRecommendation {
  recommended_units: UnitType[];
  response_actions: ResponseAction[];
  triage_flags: string[];
  severity_score: number; // 0-10 composite score
  dispatch_priority_score: number; // 0-100 for queue ranking
  estimated_response_time_minutes: number;
  escalation_needed: boolean;
  escalation_reason?: string;
}

// Full triage result
export interface TriageResult {
  incident_type: IncidentType;
  condition: string;
  injuries: string[];
  location_description: string;
  coordinates?: { lat: number; lng: number };
  consciousness: boolean | null;
  breathing: boolean | null;
  bleeding: boolean;
  people_affected: number;
  hazards: string[];
  urgency: UrgencyLevel;
  urgency_reason: string;
  confidence: number;
  caller_name?: string;
  caller_phone?: string;
  // Triage additions
  recommendation: TriageRecommendation;
  transcript: string;
  extracted_at: string;
}

// Dispatcher queue item
export interface QueueItem {
  incident_id: string;
  dispatch_priority_score: number;
  triage_result: TriageResult;
  status: string;
  created_at: string;
  time_elapsed_minutes: number;
}

// Queue sort options
export type QueueSortBy = 'priority' | 'time' | 'type' | 'urgency';
export type QueueFilterBy = 'all' | 'pending' | 'dispatched' | 'high';
