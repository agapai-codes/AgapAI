-- Migration 004: Add incident categories, urgency, and structured fields
-- Extends the schema to support VIOLENCE, HAZARDOUS, MISSING_PERSON
-- and stores AI-assessed urgency directly on incidents.

-- 1. Extend incident_type enum with new categories
DO $$ BEGIN
  ALTER TYPE incident_type ADD VALUE IF NOT EXISTS 'VIOLENCE' AFTER 'DISASTER';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TYPE incident_type ADD VALUE IF NOT EXISTS 'HAZARDOUS' AFTER 'VIOLENCE';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TYPE incident_type ADD VALUE IF NOT EXISTS 'MISSING_PERSON' AFTER 'HAZARDOUS';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Add urgency and structured fields to incidents
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS urgency VARCHAR(10) DEFAULT 'medium';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS urgency_reason TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS people_affected INTEGER DEFAULT 1;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS condition TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS hazards TEXT[] DEFAULT '{}';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS transcript TEXT;

-- 3. Fix status_history to actually track old_status
-- (The column exists but was never populated)
