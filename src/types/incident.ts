// src/types/incident.ts
// Unified emergency dispatch types — full IncidentReport schema + backward-compatible Incident for DB

// ── CORE ENUMS ───────────────────────────────────────────────────────────────

export type IncidentType = 'MEDICAL' | 'ACCIDENT' | 'FIRE' | 'VIOLENCE' | 'NATURAL_DISASTER';
export type UrgencyLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type IncidentStatus =
  | 'PENDING'
  | 'REVIEWING'
  | 'PRIORITIZED'
  | 'DISPATCHED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'RESOLVED';

// ── SUB-SCHEMAS ──────────────────────────────────────────────────────────────

export interface VitalsAssessment {
  conscious: boolean | null;
  breathing: boolean | null;
  bleeding: boolean | null;
}

export interface FirstAidProtocol {
  title: string;
  source: string;
  steps: string[];
  warnings: string[];
}

export interface AITriageAssessment {
  assessedUrgency: UrgencyLevel;
  confidence: number;
  contributingFactors: string[];
  rationaleNote: string;
}

export interface VoiceReport {
  audioUrl?: string;
  transcriptionText: string;
  extractedEntities: Record<string, unknown>;
}

// ── INCIDENT REPORT (primary schema) ─────────────────────────────────────────

export interface IncidentReport {
  id: string;
  type: IncidentType;
  urgency: UrgencyLevel;
  condition: string;
  injuriesSymptoms: string[];
  vitals: VitalsAssessment;
  peopleCount: number;
  location: {
    landmarkText: string;
    coordinates: [number, number]; // [lng, lat]
    confidenceScore: number; // percentage (e.g. 95)
  };
  hazards: string[];
  relevantContext: string;
  timeReported: string;

  // AI Decision Support
  aiTriage: AITriageAssessment;

  // Voice & Transcript
  voiceReport?: VoiceReport;

  // Dispatch Lifecycle
  status: IncidentStatus;
  assignedUnits: string[];
  relatedReportIds: string[];
  firstAidGuidance?: FirstAidProtocol;
}

// ── BACKWARD-COMPATIBLE (DB / legacy consumers) ──────────────────────────────

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
  if (!raw) return 'MEDIUM';
  const upper = raw.toUpperCase();
  if (upper === 'CRITICAL' || upper === 'HIGH') return 'HIGH';
  if (upper === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
}

export function toStatus(raw: string | undefined): IncidentStatus {
  if (!raw) return 'PENDING';
  const upper = raw.toUpperCase().replace(/\s+/g, '_');
  const valid: IncidentStatus[] = ['PENDING', 'REVIEWING', 'PRIORITIZED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'RESOLVED'];
  return (valid.includes(upper as IncidentStatus) ? upper : 'PENDING') as IncidentStatus;
}

export function incidentToReport(inc: Incident, triageRationale?: string): IncidentReport {
  return {
    id: inc.id,
    type: toIncidentType(inc.type),
    urgency: toUrgencyLevel(inc.urgency),
    condition: inc.condition || inc.description || 'Under assessment',
    injuriesSymptoms: inc.injuries || [],
    vitals: {
      conscious: inc.consciousness ?? null,
      breathing: inc.breathing ?? null,
      bleeding: inc.bleeding ?? null,
    },
    peopleCount: inc.people_affected || 1,
    location: {
      landmarkText: inc.location,
      coordinates: [inc.coordinates.lng, inc.coordinates.lat],
      confidenceScore: inc.confidence != null ? Math.round(inc.confidence * 100) : 85,
    },
    hazards: inc.hazards || [],
    relevantContext: inc.description || '',
    timeReported: inc.timestamp,
    aiTriage: {
      assessedUrgency: toUrgencyLevel(inc.urgency),
      confidence: inc.confidence ?? 0.7,
      contributingFactors: inc.triage_flags || [],
      rationaleNote: triageRationale || inc.urgency_reason || 'Standard assessment',
    },
    voiceReport: inc.transcript ? {
      transcriptionText: inc.transcript,
      extractedEntities: {},
    } : undefined,
    status: inc.status,
    assignedUnits: inc.assigned_responder_name ? [inc.assigned_responder_name] : inc.recommended_unit_type || [],
    relatedReportIds: [],
  };
}

export function reportToIncident(report: IncidentReport, base?: Partial<Incident>): Incident {
  return {
    id: report.id,
    type: report.type,
    location: report.location.landmarkText,
    description: report.condition,
    coordinates: { lng: report.location.coordinates[0], lat: report.location.coordinates[1] },
    status: base?.status || 'PENDING',
    timestamp: report.timeReported,
    reporter: base?.reporter || 'Citizen',
    urgency: report.urgency,
    urgency_reason: report.aiTriage.rationaleNote,
    people_affected: report.peopleCount,
    condition: report.condition,
    injuries: report.injuriesSymptoms,
    consciousness: report.vitals.conscious ?? undefined,
    breathing: report.vitals.breathing ?? undefined,
    bleeding: report.vitals.bleeding ?? undefined,
    hazards: report.hazards,
    confidence: report.aiTriage.confidence,
    transcript: report.voiceReport?.transcriptionText,
    assigned_responder_name: report.assignedUnits[0],
    ...base,
  };
}

// ── QUEUE UTILITIES ──────────────────────────────────────────────────────────

export const URGENCY_PRIORITY: Record<UrgencyLevel, number> = {
  HIGH: 100,
  MEDIUM: 50,
  LOW: 25,
};

export const STATUS_ORDER: Record<IncidentStatus, number> = {
  PENDING: 0,
  REVIEWING: 1,
  PRIORITIZED: 2,
  DISPATCHED: 3,
  EN_ROUTE: 4,
  ARRIVED: 5,
  RESOLVED: 6,
};

/** Sort incidents by urgency priority descending, then by time reported ascending */
export function sortByUrgency(a: IncidentReport, b: IncidentReport): number {
  const pa = URGENCY_PRIORITY[a.urgency];
  const pb = URGENCY_PRIORITY[b.urgency];
  if (pa !== pb) return pb - pa;
  return new Date(a.timeReported).getTime() - new Date(b.timeReported).getTime();
}

// ── STATUS STATE MACHINE ─────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  PENDING: ['REVIEWING', 'DISPATCHED', 'RESOLVED'],
  REVIEWING: ['PRIORITIZED', 'DISPATCHED', 'RESOLVED'],
  PRIORITIZED: ['DISPATCHED', 'RESOLVED'],
  DISPATCHED: ['EN_ROUTE', 'RESOLVED'],
  EN_ROUTE: ['ARRIVED', 'RESOLVED'],
  ARRIVED: ['RESOLVED'],
  RESOLVED: [],
};

/** Returns true if transition is allowed */
export function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Returns the next logical status in the lifecycle */
export function nextStatus(current: IncidentStatus): IncidentStatus | null {
  const map: Partial<Record<IncidentStatus, IncidentStatus>> = {
    PENDING: 'REVIEWING',
    REVIEWING: 'PRIORITIZED',
    PRIORITIZED: 'DISPATCHED',
    DISPATCHED: 'EN_ROUTE',
    EN_ROUTE: 'ARRIVED',
  };
  return map[current] ?? null;
}

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  PENDING: 'Pending',
  REVIEWING: 'Reviewing',
  PRIORITIZED: 'Prioritized',
  DISPATCHED: 'Dispatched',
  EN_ROUTE: 'En Route',
  ARRIVED: 'Arrived',
  RESOLVED: 'Resolved',
};
