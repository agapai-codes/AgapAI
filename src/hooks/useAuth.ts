// src/hooks/useAuth.ts
// Neon-backed auth hook (calls /api/auth/*).

'use client';

import { useCallback, useEffect, useState } from 'react';

export type Role = 'citizen' | 'dispatcher' | 'admin' | 'responder';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  name?: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const payload = await res.json();
      setUser(payload?.data ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const payload = await res.json();
    if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to sign in');
    setUser(payload.data);
    return payload.data as AuthUser;
  }, []);

  const signUp = useCallback(async (email: string, password: string, role: Role = 'citizen', name?: string) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role, name }),
    });
    const payload = await res.json();
    if (!res.ok || !payload.success) throw new Error(payload.error || 'Failed to create account');
    setUser(payload.data);
    return payload.data as AuthUser;
  }, []);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  return { user, loading, refresh, signIn, signUp, signOut };
}
