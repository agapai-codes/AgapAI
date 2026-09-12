// src/app/api/auth/signup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, createSessionToken, setSessionCookie, type Role } from '@/lib/auth';
import { createUser, getUserByEmail } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password, name, role } = body ?? {};

    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'A valid email is required' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const allowedRoles: Role[] = ['citizen', 'dispatcher'];
    const safeRole: Role = allowedRoles.includes(role) ? role : 'citizen';

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json({ success: false, error: 'An account with this email already exists' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash, name ?? null, safeRole);

    const token = await createSessionToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    await setSessionCookie(token);

    return NextResponse.json(
      { success: true, data: { id: user.id, email: user.email, role: user.role, name: user.name } },
      { status: 201 }
    );
  } catch (error) {
    console.error('[AUTH] Signup error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create account' }, { status: 500 });
  }
}
