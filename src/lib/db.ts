// src/lib/db.ts
// Serverless PostgreSQL (Neon + PostGIS) data access layer

import { neon } from '@neondatabase/serverless';
import type { Incident, IncidentType, IncidentStatus } from '../types/incident';

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
  };
}

// ==========================================
// QUERIES
// ==========================================

export async function getAllIncidents(): Promise<Incident[]> {
  const sql = getSql();
  const result = (await sql`
    SELECT id, type::text, location, description, status::text, reporter,
           created_at, ST_X(geom) AS lng, ST_Y(geom) AS lat
    FROM incidents
    ORDER BY created_at DESC
    LIMIT 200
  `) as IncidentRow[];
  return result.map(rowToIncident);
}

export async function getIncidentById(id: string): Promise<Incident | null> {
  const sql = getSql();
  const result = (await sql`
    SELECT id, type::text, location, description, status::text, reporter,
           created_at, ST_X(geom) AS lng, ST_Y(geom) AS lat
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
  lat: number
): Promise<Incident> {
  const sql = getSql();
  const result = (await sql`
    INSERT INTO incidents (type, location, description, reporter, geom)
    VALUES (${type}::incident_type, ${location}, ${description}, ${reporter},
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
    RETURNING id, type::text, location, description, status::text, reporter,
              created_at, ST_X(geom) AS lng, ST_Y(geom) AS lat
  `) as IncidentRow[];
  return rowToIncident(result[0]);
}

export async function updateIncidentStatus(
  id: string,
  status: IncidentStatus,
  changedBy?: string
): Promise<Incident | null> {
  const sql = getSql();
  const result = (await sql`
    UPDATE incidents
    SET status = ${status}::incident_status
    WHERE id = ${id}
    RETURNING id, type::text, location, description, status::text, reporter,
              created_at, ST_X(geom) AS lng, ST_Y(geom) AS lat
  `) as IncidentRow[];

  if (result.length === 0) return null;

  // Audit trail (best-effort; never block the update)
  try {
    await sql`
      INSERT INTO incident_status_history (incident_id, new_status, changed_by)
      VALUES (${id}, ${status}::incident_status, ${changedBy || 'system'})
    `;
  } catch (err) {
    console.warn('[DB] Failed to write status history:', err);
  }

  return rowToIncident(result[0]);
}

export async function findNearbyIncidents(
  lng: number,
  lat: number,
  radiusMeters = 1000
): Promise<(Incident & { distance_meters: number })[]> {
  const sql = getSql();
  const result = (await sql`
    SELECT id, type::text, location, description, status::text, reporter,
           created_at, lng, lat, distance_meters
    FROM find_nearby_incidents(${lng}, ${lat}, ${radiusMeters})
  `) as (IncidentRow & { distance_meters: number })[];
  return result.map((r) => ({ ...rowToIncident(r), distance_meters: Number(r.distance_meters) }));
}
