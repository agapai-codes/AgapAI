-- Migration 006: Expand incident status to 7 stages
-- Pending → Reviewing → Prioritized → Dispatched → En Route → Arrived → Resolved

-- Add new status values to the enum
DO $$ BEGIN
  ALTER TYPE incident_status ADD VALUE IF NOT EXISTS 'REVIEWING' AFTER 'PENDING';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TYPE incident_status ADD VALUE IF NOT EXISTS 'PRIORITIZED' AFTER 'REVIEWING';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TYPE incident_status ADD VALUE IF NOT EXISTS 'EN_ROUTE' AFTER 'DISPATCHED';
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TYPE incident_status ADD VALUE IF NOT EXISTS 'ARRIVED' AFTER 'EN_ROUTE';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Add transcript column if not exists (from migration 004, but确保存在)
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS transcript TEXT;
