// src/lib/auth.ts
// Neon-backed email/password auth with JWT session cookies.

import 'server-only';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'agapai_session';
const SESSION_DAYS = 7;

export type Role = 'citizen' | 'dispatcher' | 'admin';

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  name?: string | null;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      // Fail closed: never sign/verify sessions with a known default in production.
      throw new Error('AUTH_SECRET is not configured');
    }
    console.warn('[AUTH] AUTH_SECRET not set — using insecure dev secret');
    return new TextEncoder().encode('agapai-dev-secret-change-me');
  }
  return new TextEncoder().encode(secret);
}

// ==========================================
// PASSWORD
// ==========================================
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ==========================================
// SESSION TOKEN
// ==========================================
export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, role: user.role, name: user.name ?? null })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return {
      id: payload.sub,
      email: payload.email,
      role: (payload.role as Role) || 'citizen',
      name: (payload.name as string) ?? null,
    };
  } catch {
    return null;
  }
}

// ==========================================
// COOKIE HELPERS (Next.js server context)
// ==========================================
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
