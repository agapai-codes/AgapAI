-- server/src/db/init.sql
-- AgapAI Emergency Response Platform - Database Schema
-- Idempotent initialization with PostGIS support

-- ==========================================
-- 1. EXTENSIONS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. ENUM TYPES
-- ==========================================
DO $$ BEGIN
  CREATE TYPE incident_type AS ENUM ('FIRE', 'ACCIDENT', 'MEDICAL', 'DISASTER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE incident_status AS ENUM ('PENDING', 'DISPATCHED', 'RESOLVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- 3. CORE INCIDENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS incidents (
  id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  type incident_type NOT NULL,
  location VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  status incident_status NOT NULL DEFAULT 'PENDING',
  reporter VARCHAR(255) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geom GEOMETRY(Point, 4326) NOT NULL
);

-- Spatial index for proximity queries
CREATE INDEX IF NOT EXISTS idx_incidents_geom ON incidents USING GIST (geom);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);

-- Index for timestamp ordering
CREATE INDEX IF NOT EXISTS idx_incidents_timestamp ON incidents (timestamp DESC);

-- ==========================================
-- 4. SEED DATA - Iligan City Coordinates
-- ==========================================
INSERT INTO incidents (id, type, location, description, status, reporter, timestamp, geom) VALUES
  ('INC-001', 'FIRE', 'V. Carral St, Poblacion, Iligan City', 'Residential structural fire spreading to adjacent building.', 'PENDING', 'Juan Dela Cruz', NOW() - INTERVAL '2 minutes', ST_SetSRID(ST_MakePoint(124.2442, 8.2295), 4326)),
  ('INC-002', 'MEDICAL', 'Buru-un, Iligan City', 'Severe respiratory distress requiring immediate oxygen deployment.', 'PENDING', 'Maria Santos', NOW() - INTERVAL '5 minutes', ST_SetSRID(ST_MakePoint(124.1850, 8.1960), 4326)),
  ('INC-003', 'ACCIDENT', 'MSU-IIT Engineering, Iligan City', 'Two-vehicle collision near the gate boundary.', 'DISPATCHED', 'Prof. Almaran', NOW() - INTERVAL '10 minutes', ST_SetSRID(ST_MakePoint(124.2452, 8.2415), 4326)),
  ('INC-004', 'DISASTER', 'Brgy. Pala-o, Iligan City', 'Localized flash flood blocking intersection lanes.', 'PENDING', 'K. Vergara', NOW() - INTERVAL '15 minutes', ST_SetSRID(ST_MakePoint(124.2530, 8.2320), 4326)),
  ('INC-005', 'FIRE', 'Sabayle St, Tibanga, Iligan City', 'Electrical transformer sparking over market structures.', 'DISPATCHED', 'A. Vergara', NOW() - INTERVAL '20 minutes', ST_SetSRID(ST_MakePoint(124.2410, 8.2365), 4326))
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 5. HELPER FUNCTIONS
-- ==========================================

-- Find nearby incidents within a given radius (in meters)
CREATE OR REPLACE FUNCTION find_nearby_incidents(
  center_lng DOUBLE PRECISION,
  center_lat DOUBLE PRECISION,
  radius_meters INTEGER DEFAULT 1000
)
RETURNS TABLE (
  id VARCHAR(36),
  type incident_type,
  location VARCHAR(500),
  description TEXT,
  status incident_status,
  reporter VARCHAR(255),
  timestamp TIMESTAMPTZ,
  lng DOUBLE PRECISION,
  lat DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.type,
    i.location,
    i.description,
    i.status,
    i.reporter,
    i.timestamp,
    ST_X(i.geom) AS lng,
    ST_Y(i.geom) AS lat,
    ST_Distance(i.geom::geography, ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography) AS distance_meters
  FROM incidents i
  WHERE ST_DWithin(
    i.geom::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_meters
  )
  ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 6. GRANTS (for application user)
-- ==========================================
-- GRANT SELECT, INSERT, UPDATE ON incidents TO agapai_app;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO agapai_app;
