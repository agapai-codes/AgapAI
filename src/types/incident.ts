// src/types/incident.ts
// Unified incident types — new IncidentReport schema + backward-compatible Incident for DB

// ── NEW SCHEMA (spec) ────────────────────────────────────────────────────────

export type IncidentType = 'MEDICAL' | 'ACCIDENT' | 'FIRE' | 'VIOLENCE' | 'NATURAL_DISASTER';
export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

export interface VitalsAssessment {
  conscious: boolean | null;
  breathing: boolean | null;
  bleeding: boolean | null;
}

export interface FirstAidGuidelines {
  title: string;
  source: string;
  steps: string[];
  warnings: string[];
}

export interface IncidentReport {
  id: string;
  type: IncidentType;
  urgency: UrgencyLevel;
  condition: string;
  peopleCount: number;
  locationName: string;
  coordinates: [number, number]; // [longitude, latitude]
  timestamp: string;
  triageRationale: string;
  rawTranscript?: string;
  firstAidGuidelines?: FirstAidGuidelines;
  vitals: VitalsAssessment;
}

// ── BACKWARD-COMPATIBLE (DB / legacy consumers) ──────────────────────────────

export type IncidentStatus = 'PENDING' | 'REVIEWING' | 'PRIORITIZED' | 'DISPATCHED' | 'EN_ROUTE' | 'ARRIVED' | 'RESOLVED';

/** Legacy incident shape used by database layer, hooks, and API routes */
export interface Incident {
  id: string;
  type: IncidentType;
  location: string;
  description: string;
  coordinates: { lng: number; lat: number };
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
  injuries?: string[];
  caller_name?: string;
  caller_phone?: string;
  assigned_responder_id?: string;
  assigned_responder_name?: string;
  resolution_notes?: string;
  dispatched_at?: string;
  resolved_at?: string;
  transcript?: string;
  recommended_unit_type?: string[];
  dispatch_priority_score?: number;
  triage_flags?: string[];
  severity_score?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── ADAPTERS ─────────────────────────────────────────────────────────────────

const INCIDENT_TYPE_MAP: Record<string, IncidentType> = {
  FIRE: 'FIRE',
  ACCIDENT: 'ACCIDENT',
  MEDICAL: 'MEDICAL',
  VIOLENCE: 'VIOLENCE',
  DISASTER: 'NATURAL_DISASTER',
  NATURAL_DISASTER: 'NATURAL_DISASTER',
  HAZARDOUS: 'FIRE',
  MISSING_PERSON: 'MEDICAL',
};

export function toIncidentType(raw: string): IncidentType {
  const upper = raw.toUpperCase().replace(/\s+/g, '_');
  return INCIDENT_TYPE_MAP[upper] || 'MEDICAL';
}

export function toUrgencyLevel(raw: string | undefined): UrgencyLevel {
  if (!raw) return 'medium';
  const lower = raw.toLowerCase();
  if (lower === 'critical' || lower === 'high' || lower === 'medium' || lower === 'low') return lower;
  return 'medium';
}

export function incidentToReport(inc: Incident, triageRationale?: string): IncidentReport {
  return {
    id: inc.id,
    type: toIncidentType(inc.type),
    urgency: toUrgencyLevel(inc.urgency),
    condition: inc.condition || inc.description || 'Under assessment',
    peopleCount: inc.people_affected || 1,
    locationName: inc.location,
    coordinates: [inc.coordinates.lng, inc.coordinates.lat],
    timestamp: inc.timestamp,
    triageRationale: triageRationale || inc.urgency_reason || 'Standard assessment',
    rawTranscript: inc.transcript,
    vitals: {
      conscious: inc.consciousness ?? null,
      breathing: inc.breathing ?? null,
      bleeding: inc.bleeding ?? null,
    },
  };
}

export function reportToIncident(report: IncidentReport, base?: Partial<Incident>): Incident {
  return {
    id: report.id,
    type: report.type,
    location: report.locationName,
    description: report.condition,
    coordinates: { lng: report.coordinates[0], lat: report.coordinates[1] },
    status: base?.status || 'PENDING',
    timestamp: report.timestamp,
    reporter: base?.reporter || 'Citizen',
    urgency: report.urgency,
    urgency_reason: report.triageRationale,
    people_affected: report.peopleCount,
    condition: report.condition,
    consciousness: report.vitals.conscious ?? undefined,
    breathing: report.vitals.breathing ?? undefined,
    bleeding: report.vitals.bleeding ?? undefined,
    transcript: report.rawTranscript,
    ...base,
  };
}
