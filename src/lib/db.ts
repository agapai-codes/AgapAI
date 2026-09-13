// src/lib/db.ts
// Serverless PostgreSQL (Neon + PostGIS) data access layer

import { neon } from '@neondatabase/serverless';
import type { Incident, IncidentType, IncidentStatus, UrgencyLevel } from '../types/incident';

// Lazy-init so missing DATABASE_URL doesn't crash at import time (e.g. build)
let _sql: ReturnType<typeof neon> | null = null;
export function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not configured');
    _sql = neon(url);
  }
  return _sql;
}

// ==========================================
// ROW -> MODEL
// ==========================================

export interface IncidentRow {
  id: string;
  type: string;
  location: string;
  description: string;
  status: string;
  reporter: string;
  reporter_email?: string | null;
  created_at: string | Date;
  lng: number | string;
  lat: number | string;
  urgency?: string | null;
  urgency_reason?: string | null;
  people_affected?: number | null;
  condition?: string | null;
  hazards?: string[] | null;
  transcript?: string | null;
  confidence?: number | null;
  consciousness?: boolean | null;
  breathing?: boolean | null;
  bleeding?: boolean | null;
  assigned_responder_id?: string | null;
  assigned_responder_name?: string | null;
  resolution_notes?: string | null;
  dispatched_at?: string | null;
  resolved_at?: string | null;
}

export function rowToIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    type: row.type as IncidentType,
    location: row.location,
    description: row.description,
    coordinates: {
      lng: parseFloat(String(row.lng)),
      lat: parseFloat(String(row.lat)),
    },
    status: row.status as IncidentStatus,
    reporter: row.reporter,
    reporter_email: row.reporter_email || undefined,
    timestamp: new Date(row.created_at).toISOString(),
    urgency: row.urgency ? (row.urgency.toUpperCase() as UrgencyLevel) : undefined,
    urgency_reason: row.urgency_reason || undefined,
    people_affected: row.people_affected || undefined,
    condition: row.condition || undefined,
    hazards: row.hazards || undefined,
    confidence: row.confidence != null ? Number(row.confidence) : undefined,
    consciousness: row.consciousness ?? undefined,
    breathing: row.breathing ?? undefined,
    bleeding: row.bleeding ?? undefined,
    assigned_responder_id: row.assigned_responder_id || undefined,
    assigned_responder_name: row.assigned_responder_name || undefined,
    resolution_notes: row.resolution_notes || undefined,
    dispatched_at: row.dispatched_at ? new Date(row.dispatched_at).toISOString() : undefined,
    resolved_at: row.resolved_at ? new Date(row.resolved_at).toISOString() : undefined,
    transcript: row.transcript || undefined,
  };
}

// ==========================================
// QUERIES
// ==========================================

export async function getAllIncidents(): Promise<Incident[]> {
  const sql = getSql();
  const result = (await sql`
    SELECT i.id, i.type::text, i.location, i.description, i.status::text, i.reporter,
           i.created_at, ST_X(i.geom) AS lng, ST_Y(i.geom) AS lat,
           i.urgency, i.urgency_reason, i.people_affected, i.condition, i.hazards,
           i.confidence, i.consciousness, i.breathing, i.bleeding, i.transcript,
           i.assigned_responder_id, r.name AS assigned_responder_name,
           i.resolution_notes, i.dispatched_at, i.resolved_at
    FROM incidents i
    LEFT JOIN responders r ON i.assigned_responder_id = r.id
    ORDER BY
      CASE i.urgency
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END,
      i.created_at DESC
    LIMIT 200
  `) as IncidentRow[];
  return result.map(rowToIncident);
}

export async function getIncidentById(id: string): Promise<Incident | null> {
  const sql = getSql();
  const result = (await sql`
    SELECT i.id, i.type::text, i.location, i.description, i.status::text, i.reporter,
           i.created_at, ST_X(i.geom) AS lng, ST_Y(i.geom) AS lat,
           i.urgency, i.urgency_reason, i.people_affected, i.condition, i.hazards,
           i.confidence, i.consciousness, i.breathing, i.bleeding, i.transcript,
           i.assigned_responder_id, r.name AS assigned_responder_name,
           i.resolution_notes, i.dispatched_at, i.resolved_at
    FROM incidents i
    LEFT JOIN responders r ON i.assigned_responder_id = r.id
    WHERE i.id = ${id}
  `) as IncidentRow[];
  return result.length > 0 ? rowToIncident(result[0]) : null;
}

export async function createIncident(
  type: IncidentType,
  location: string,
  description: string,
  reporter: string,
  lng: number,
  lat: number,
  extra?: {
    urgency?: UrgencyLevel;
    urgency_reason?: string;
    people_affected?: number;
    condition?: string;
    hazards?: string[];
    transcript?: string;
    reporter_email?: string;
    confidence?: number;
    consciousness?: boolean;
    breathing?: boolean;
    bleeding?: boolean;
  }
): Promise<Incident | null> {
  const sql = getSql();
  try {
    const result = (await sql`
      INSERT INTO incidents (type, location, description, reporter, geom,
        urgency, urgency_reason, people_affected, condition, hazards, transcript,
        reporter_email, confidence, consciousness, breathing, bleeding)
      VALUES (${type}::incident_type, ${location}, ${description}, ${reporter},
              ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
              ${extra?.urgency || 'medium'},
              ${extra?.urgency_reason || null},
              ${extra?.people_affected || 1},
              ${extra?.condition || null},
              ${extra?.hazards || []},
              ${extra?.transcript || null},
              ${extra?.reporter_email || null},
              ${extra?.confidence ?? 0.7},
              ${extra?.consciousness ?? true},
              ${extra?.breathing ?? true},
              ${extra?.bleeding ?? false})
      RETURNING id, type::text, location, description, status::text, reporter,
                created_at, ST_X(geom) AS lng, ST_Y(geom) AS lat,
                urgency, urgency_reason, people_affected, condition, hazards,
                confidence, consciousness, breathing, bleeding,
                reporter_email
    `) as IncidentRow[];
    if (result.length === 0) return null;
    return rowToIncident(result[0]);
  } catch (err) {
    console.error('[DB] createIncident failed:', err);
    return null;
  }
}

export async function updateIncidentStatus(
  id: string,
  status: IncidentStatus,
  changedBy?: string
): Promise<Incident | null> {
  const sql = getSql();

  const old = (await sql`SELECT status::text AS old_status FROM incidents WHERE id = ${id}`) as { old_status: string }[];

  const result = (await sql`
    UPDATE incidents
    SET status = ${status}::incident_status,
        dispatched_at = CASE WHEN ${status} = 'DISPATCHED' THEN NOW() ELSE dispatched_at END,
        resolved_at = CASE WHEN ${status} = 'RESOLVED' THEN NOW() ELSE resolved_at END
    WHERE id = ${id}
    RETURNING id, type::text, location, description, status::text, reporter,
              created_at, ST_X(geom) AS lng, ST_Y(geom) AS lat,
              urgency, urgency_reason, people_affected, condition, hazards,
              confidence, consciousness, breathing, bleeding, transcript,
              assigned_responder_id,
              (SELECT name FROM responders WHERE id = incidents.assigned_responder_id) AS assigned_responder_name,
              resolution_notes, dispatched_at, resolved_at
  `) as IncidentRow[];

  if (result.length === 0) return null;

  try {
    await sql`
      INSERT INTO incident_status_history (incident_id, old_status, new_status, changed_by)
      VALUES (${id}, ${old[0]?.old_status || 'PENDING'}::incident_status, ${status}::incident_status, ${changedBy || 'system'})
    `;
  } catch (err) {
    console.warn('[DB] Failed to write status history:', err);
  }

  return rowToIncident(result[0]);
}

export async function updateIncidentUrgency(
  id: string,
  urgency: UrgencyLevel,
  urgencyReason: string,
  changedBy?: string
): Promise<Incident | null> {
  const sql = getSql();
  const result = (await sql`
    UPDATE incidents
    SET urgency = ${urgency}, urgency_reason = ${urgencyReason}
    WHERE id = ${id}
    RETURNING id, type::text, location, description, status::text, reporter,
              created_at, ST_X(geom) AS lng, ST_Y(geom) AS lat,
              urgency, urgency_reason, people_affected, condition, hazards,
              confidence, consciousness, breathing, bleeding
  `) as IncidentRow[];

  if (result.length === 0) return null;

  try {
    await sql`
      INSERT INTO incident_status_history (incident_id, new_status, changed_by, notes)
      VALUES (${id}, (SELECT status::incident_status FROM incidents WHERE id = ${id}), ${changedBy || 'system'}, ${'Urgency overridden to ' + urgency + ': ' + urgencyReason})
    `;
  } catch (err) {
    console.warn('[DB] Failed to write urgency override history:', err);
  }

  return rowToIncident(result[0]);
}

export async function assignResponder(
  incidentId: string,
  responderId: string,
  changedBy?: string
): Promise<Incident | null> {
  const sql = getSql();
  const result = (await sql`
    UPDATE incidents
    SET assigned_responder_id = ${responderId}::uuid
    WHERE id = ${incidentId}
    RETURNING id, type::text, location, description, status::text, reporter,
              created_at, ST_X(geom) AS lng, ST_Y(geom) AS lat,
              urgency, urgency_reason, people_affected, condition, hazards,
              confidence, consciousness, breathing, bleeding,
              ${responderId}::uuid AS assigned_responder_id,
              (SELECT name FROM responders WHERE id = ${responderId}::uuid) AS assigned_responder_name
  `) as IncidentRow[];

  if (result.length === 0) return null;

  // Update responder status to busy
  await sql`UPDATE responders SET status = 'busy'::responder_status WHERE id = ${responderId}::uuid`;

  try {
    await sql`
      INSERT INTO incident_status_history (incident_id, new_status, changed_by, notes)
      VALUES (${incidentId}, (SELECT status::incident_status FROM incidents WHERE id = ${incidentId}), ${changedBy || 'system'}, ${'Assigned to responder ' + responderId})
    `;
  } catch (err) {
    console.warn('[DB] Failed to write assignment history:', err);
  }

  return rowToIncident(result[0]);
}

export async function resolveIncident(
  id: string,
  resolutionNotes: string,
  changedBy?: string
): Promise<Incident | null> {
  const sql = getSql();

  try {
    // Get current status and assigned responder id
    const inc = (await sql`SELECT status::text AS old_status, assigned_responder_id FROM incidents WHERE id = ${id}`) as { old_status: string; assigned_responder_id: string | null }[];

    if (inc.length === 0) return null;

    const result = (await sql`
      UPDATE incidents
      SET status = 'RESOLVED'::incident_status,
          resolution_notes = ${resolutionNotes},
          resolved_at = NOW()
      WHERE id = ${id}
      RETURNING id, type::text, location, description, status::text, reporter,
                created_at, ST_X(geom) AS lng, ST_Y(geom) AS lat,
                urgency, urgency_reason, people_affected, condition, hazards,
                confidence, consciousness, breathing, bleeding, transcript,
                assigned_responder_id,
                (SELECT name FROM responders WHERE id = incidents.assigned_responder_id) AS assigned_responder_name,
                resolution_notes, dispatched_at, resolved_at
    `) as IncidentRow[];

    if (result.length === 0) return null;

    // Free up the responder
    if (inc[0]?.assigned_responder_id) {
      await sql`UPDATE responders SET status = 'available'::responder_status WHERE id = ${inc[0].assigned_responder_id}::uuid`;
    }

    try {
      await sql`
        INSERT INTO incident_status_history (incident_id, old_status, new_status, changed_by, notes)
        VALUES (${id}, ${inc[0].old_status}::incident_status, 'RESOLVED'::incident_status, ${changedBy || 'system'}, ${resolutionNotes})
      `;
    } catch (err) {
      console.warn('[DB] Failed to write resolution history:', err);
    }

    return rowToIncident(result[0]);
  } catch (err) {
    console.error('[DB] resolveIncident failed:', err);
    return null;
  }
}

export async function getIncidentHistory(incidentId: string): Promise<Array<{
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}>> {
  const sql = getSql();
  const result = (await sql`
    SELECT id::text, old_status::text, new_status::text, changed_by, notes, created_at::text
    FROM incident_status_history
    WHERE incident_id = ${incidentId}
    ORDER BY created_at DESC
  `) as Array<{
    id: string;
    old_status: string | null;
    new_status: string;
    changed_by: string | null;
    notes: string | null;
    created_at: string;
  }>;
  return result;
}

export async function findRelatedIncidents(
  id: string,
  type: string,
  lng: number,
  lat: number,
  createdAt: string
): Promise<Incident[]> {
  const sql = getSql();
  const timeWindow = new Date(new Date(createdAt).getTime() - 10 * 60 * 1000).toISOString();
  const result = (await sql`
    SELECT id, type::text, location, description, status::text, reporter,
           created_at, ST_X(geom) AS lng, ST_Y(geom) AS lat,
           urgency, urgency_reason, people_affected, condition, hazards,
           confidence, consciousness, breathing, bleeding
    FROM incidents
    WHERE id != ${id}
      AND type::text = ${type}
      AND created_at >= ${timeWindow}
      AND ST_DWithin(
        geom::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        500
      )
    ORDER BY created_at DESC
  `) as IncidentRow[];
  return result.map(rowToIncident);
}

export async function findNearbyIncidents(
  lng: number,
  lat: number,
  radiusMeters = 1000
): Promise<(Incident & { distance_meters: number })[]> {
  const sql = getSql();
  const result = (await sql`
    SELECT id, type::text, location, description, status::text, reporter,
           created_at, lng, lat, distance_meters,
           urgency, urgency_reason, people_affected, condition, hazards,
           confidence, consciousness, breathing, bleeding
    FROM find_nearby_incidents(${lng}, ${lat}, ${radiusMeters})
  `) as (IncidentRow & { distance_meters: number })[];
  return result.map((r) => ({ ...rowToIncident(r), distance_meters: Number(r.distance_meters) }));
}

// ==========================================
// RESPONDER QUERIES
// ==========================================

export async function getAllResponders() {
  const sql = getSql();
  return (await sql`
    SELECT id::text, name, email, phone, status::text, current_lat, current_lng, created_at::text
    FROM responders
    ORDER BY name
  `) as Array<{ id: string; name: string; email: string; phone: string; status: string; current_lat: number | null; current_lng: number | null; created_at: string }>;
}

export async function getResponderByEmail(email: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT id::text, name, email, password_hash, phone, status::text, role
    FROM responders
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `) as Array<{ id: string; name: string; email: string; password_hash: string; phone: string; status: string; role: string }>;
  return rows.length > 0 ? rows[0] : null;
}

export async function getResponderById(id: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT id::text, name, email, phone, status::text, current_lat, current_lng
    FROM responders
    WHERE id = ${id}::uuid
    LIMIT 1
  `) as Array<{ id: string; name: string; email: string; phone: string; status: string; current_lat: number | null; current_lng: number | null }>;
  return rows.length > 0 ? rows[0] : null;
}

export async function updateResponderLocation(id: string, lat: number, lng: number) {
  const sql = getSql();
  await sql`UPDATE responders SET current_lat = ${lat}, current_lng = ${lng}, updated_at = NOW() WHERE id = ${id}::uuid`;
}

export async function updateResponderStatus(id: string, status: 'available' | 'busy' | 'offline') {
  const sql = getSql();
  await sql`UPDATE responders SET status = ${status}::responder_status, updated_at = NOW() WHERE id = ${id}::uuid`;
}
