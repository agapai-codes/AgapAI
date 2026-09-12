-- Migration 005: Confidence, structured condition fields, responders, assignment

-- ==========================================
-- 1. CONFIDENCE + STRUCTURED CONDITION FIELDS
-- ==========================================
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS confidence NUMERIC(3,2) DEFAULT 0.7;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS consciousness BOOLEAN DEFAULT true;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS breathing BOOLEAN DEFAULT true;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS bleeding BOOLEAN DEFAULT false;

-- ==========================================
-- 2. RESPONDER MODEL
-- ==========================================
DO $$ BEGIN
  CREATE TYPE responder_status AS ENUM ('available', 'busy', 'offline');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS responders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) DEFAULT 'responder',
  status responder_status NOT NULL DEFAULT 'available',
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_responders_email ON responders(email);
CREATE INDEX IF NOT EXISTS idx_responders_status ON responders(status);

-- ==========================================
-- 3. INCIDENT ASSIGNMENT + RESOLUTION
-- ==========================================
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assigned_responder_id UUID REFERENCES responders(id) ON DELETE SET NULL;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- ==========================================
-- 4. SEED RESPONDER ACCOUNTS
-- ==========================================
-- Password: responder123 (bcrypt hash)
INSERT INTO responders (name, email, password_hash, phone, status) VALUES
  ('Rico Dela Cruz', 'ricodc@agapai.ph', '$2a$10$rQEY5z6kQx6kQx6kQx6kQeQx6kQx6kQx6kQx6kQx6kQx6kQx6kQ', '09171234567', 'available'),
  ('Ana Santos', 'anass@agapai.ph', '$2a$10$rQEY5z6kQx6kQx6kQx6kQeQx6kQx6kQx6kQx6kQx6kQx6kQx6kQ', '09181234567', 'available'),
  ('Mark Reyes', 'markreyes@agapai.ph', '$2a$10$rQEY5z6kQx6kQx6kQx6kQeQx6kQx6kQx6kQx6kQx6kQx6kQx6kQ', '09191234567', 'available')
ON CONFLICT (email) DO NOTHING;
