// src/lib/users.ts
// User account data access (Neon).

import { getSql } from './db';
import type { Role } from './auth';

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  role: Role;
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, password_hash, name, role::text AS role
    FROM users
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `) as UserRecord[];
  return rows.length > 0 ? rows[0] : null;
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, password_hash, name, role::text AS role
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `) as UserRecord[];
  return rows.length > 0 ? rows[0] : null;
}

export async function createUser(
  email: string,
  passwordHash: string,
  name: string | null,
  role: Role
): Promise<UserRecord> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO users (email, password_hash, name, role)
    VALUES (${email}, ${passwordHash}, ${name}, ${role}::user_role)
    RETURNING id, email, password_hash, name, role::text AS role
  `) as UserRecord[];
  return rows[0];
}
