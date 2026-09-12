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
    timestamp: new Date(row.created_at).toISOString(),
    urgency: (row.urgency as UrgencyLevel) || 'medium',
    urgency_reason: row.urgency_reason || undefined,
    people_affected: row.people_affected || undefined,
    condition: row.condition || undefined,
    hazards: row.hazards || undefined,
  };
}

// ==========================================
// QUERIES
// ==========================================

export async function getAllIncidents(): Promise<Incident[]> {
  const sql = getSql();
  const result = (await sql`
    SELECT id, type::text, location, description, status::text, reporter,
           created_at, ST_X(geom) AS lng, ST_Y(geom) AS lat,
           urgency, urgency_reason, people_affected, condition, hazards
    FROM incidents
    ORDER BY
      CASE urgency
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END,
      created_at DESC
    LIMIT 200
  `) as IncidentRow[];
  return result.map(rowToIncident);
}

export async function getIncidentById(id: string): Promise<Incident | null> {
  const sql = getSql();
  const result = (await sql`
    SELECT id, type::text, location, description, status::text, reporter,
           created_at, ST_X(geom) AS lng, ST_Y(geom) AS lat,
           urgency, urgency_reason, people_affected, condition, hazards
    FROM incidents
    WHERE id = ${id}
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
  }
): Promise<Incident> {
  const sql = getSql();
  const result = (await sql`
    INSERT INTO incidents (type, location, description, reporter, geom,
      urgency, urgency_reason, people_affected, condition, hazards, transcript)
    VALUES (${type}::incident_type, ${location}, ${description}, ${reporter},
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
            ${extra?.urgency || 'medium'},
            ${extra?.urgency_reason || null},
            ${extra?.people_affected || 1},
            ${extra?.condition || null},
            ${extra?.hazards || []},
            ${extra?.transcript || null})
    RETURNING id, type::text, location, description, status::text, reporter,
              created_at, ST_X(geom) AS lng, ST_Y(geom) AS lat,
              urgency, urgency_reason, people_affected, condition, hazards
  `) as IncidentRow[];
  return rowToIncident(result[0]);
}

export async function updateIncidentStatus(
  id: string,
  status: IncidentStatus,
  changedBy?: string
): Promise<Incident | null> {
  const sql = getSql();

  // Get old status for audit trail
  const old = (await sql`SELECT status::text AS old_status FROM incidents WHERE id = ${id}`) as { old_status: string }[];

  const result = (await sql`
    UPDATE incidents
    SET status = ${status}::incident_status
    WHERE id = ${id}
    RETURNING id, type::text, location, description, status::text, reporter,
              created_at, ST_X(geom) AS lng, ST_Y(geom) AS lat,
              urgency, urgency_reason, people_affected, condition, hazards
  `) as IncidentRow[];

  if (result.length === 0) return null;

  // Audit trail with old_status
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
              urgency, urgency_reason, people_affected, condition, hazards
  `) as IncidentRow[];

  if (result.length === 0) return null;

  // Audit trail
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

export async function findNearbyIncidents(
  lng: number,
  lat: number,
  radiusMeters = 1000
): Promise<(Incident & { distance_meters: number })[]> {
  const sql = getSql();
  const result = (await sql`
    SELECT id, type::text, location, description, status::text, reporter,
           created_at, lng, lat, distance_meters,
           urgency, urgency_reason, people_affected, condition, hazards
    FROM find_nearby_incidents(${lng}, ${lat}, ${radiusMeters})
  `) as (IncidentRow & { distance_meters: number })[];
  return result.map((r) => ({ ...rowToIncident(r), distance_meters: Number(r.distance_meters) }));
}
