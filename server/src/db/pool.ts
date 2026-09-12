// server/src/db/pool.ts

import { Pool } from 'pg';

// ==========================================
// DATABASE CONNECTION POOL
// ==========================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/agapai',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('[DATABASE] Unexpected pool error:', err);
});

// ==========================================
// HEALTH CHECK
// ==========================================

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time, PostGIS_Version() as version');
    client.release();
    console.log(`[SYSTEM_CORE] Postgres + PostGIS telemetry database container locked and ready`);
    console.log(`[SYSTEM_CORE] PostGIS version: ${result.rows[0].version}`);
    return true;
  } catch (error) {
    console.error('[DATABASE] Connection failed:', error);
    return false;
  }
}

// ==========================================
// TYPE DEFINITIONS
// ==========================================

export interface IncidentRow {
  id: string;
  type: string;
  location: string;
  description: string;
  status: string;
  reporter: string;
  timestamp: Date;
  lng: number;
  lat: number;
}

export interface Incident {
  id: string;
  type: 'FIRE' | 'ACCIDENT' | 'MEDICAL' | 'DISASTER';
  location: string;
  description: string;
  coordinates: { lng: number; lat: number };
  status: 'PENDING' | 'DISPATCHED' | 'RESOLVED';
  reporter: string;
  timestamp: string;
}

// ==========================================
// DATA TRANSFORMATION LAYER
// ==========================================

export function rowToIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    type: row.type as Incident['type'],
    location: row.location,
    description: row.description,
    coordinates: {
      lng: parseFloat(String(row.lng)),
      lat: parseFloat(String(row.lat)),
    },
    status: row.status as Incident['status'],
    reporter: row.reporter,
    timestamp: new Date(row.timestamp).toISOString(),
  };
}

// ==========================================
// QUERY FUNCTIONS
// ==========================================

export async function getAllIncidents(): Promise<Incident[]> {
  const result = await pool.query(`
    SELECT
      id,
      type::text,
      location,
      description,
      status::text,
      reporter,
      timestamp,
      ST_X(geom) AS lng,
      ST_Y(geom) AS lat
    FROM incidents
    ORDER BY timestamp DESC
  `);
  return result.rows.map(rowToIncident);
}

export async function getIncidentById(id: string): Promise<Incident | null> {
  const result = await pool.query(`
    SELECT
      id,
      type::text,
      location,
      description,
      status::text,
      reporter,
      timestamp,
      ST_X(geom) AS lng,
      ST_Y(geom) AS lat
    FROM incidents
    WHERE id = $1
  `, [id]);

  return result.rows.length > 0 ? rowToIncident(result.rows[0]) : null;
}

export async function createIncident(
  type: string,
  location: string,
  description: string,
  reporter: string,
  lng: number,
  lat: number
): Promise<Incident> {
  const result = await pool.query(`
    INSERT INTO incidents (type, location, description, reporter, geom)
    VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326))
    RETURNING
      id,
      type::text,
      location,
      description,
      status::text,
      reporter,
      timestamp,
      ST_X(geom) AS lng,
      ST_Y(geom) AS lat
  `, [type, location, description, reporter, lng, lat]);

  return rowToIncident(result.rows[0]);
}

export async function updateIncidentStatus(
  id: string,
  status: string
): Promise<Incident | null> {
  const result = await pool.query(`
    UPDATE incidents
    SET status = $1::incident_status, timestamp = NOW()
    WHERE id = $2
    RETURNING
      id,
      type::text,
      location,
      description,
      status::text,
      reporter,
      timestamp,
      ST_X(geom) AS lng,
      ST_Y(geom) AS lat
  `, [status, id]);

  return result.rows.length > 0 ? rowToIncident(result.rows[0]) : null;
}

export async function findNearbyIncidents(
  lng: number,
  lat: number,
  radiusMeters: number = 1000
): Promise<Incident[]> {
  const result = await pool.query(`
    SELECT * FROM find_nearby_incidents($1, $2, $3)
  `, [lng, lat, radiusMeters]);

  return result.rows.map(rowToIncident);
}

export default pool;
