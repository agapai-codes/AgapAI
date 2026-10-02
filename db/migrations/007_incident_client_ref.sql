-- Migration 007: client_ref for queued-report idempotency
-- The offline queue can POST the same payload twice (timeout after the server
-- already committed, two tabs flushing, storage write failure after a successful
-- POST). client_ref lets the API recognise the replay and return the incident
-- that already exists instead of dispatching a duplicate response.

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS client_ref VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_client_ref
  ON incidents (client_ref) WHERE client_ref IS NOT NULL;
