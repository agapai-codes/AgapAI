-- Migration 003: cleanup dead schema
-- user_roles was superseded by users.role (migration 002).

DROP TABLE IF EXISTS user_roles;
