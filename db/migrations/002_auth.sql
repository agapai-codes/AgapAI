-- AgapAI Auth Schema: 002_auth.sql
-- Neon-backed email/password auth (replaces Supabase)

-- ==========================================
-- USERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255),
  role user_role NOT NULL DEFAULT 'citizen',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Note: the legacy user_roles table is dropped by migration 003.
-- Role now lives directly on users.
