// src/app/api/auth/signup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, createSessionToken, setSessionCookie, type Role } from '@/lib/auth';
import { createUser, getUserByEmail } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password, name, role, inviteCode } = body ?? {};

    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'A valid email is required' }, { status: 400 });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Dispatcher signup requires the invite code. Anonymous users are citizens.
    let safeRole: Role = 'citizen';
    if (role === 'dispatcher') {
      const expected = process.env.DISPATCHER_INVITE_CODE;
      if (expected && typeof inviteCode === 'string' && inviteCode === expected) {
        safeRole = 'dispatcher';
      } else {
        return NextResponse.json({ success: false, error: 'A valid dispatcher invite code is required' }, { status: 403 });
      }
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      // Generic response to avoid confirming which emails are registered.
      return NextResponse.json({ success: false, error: 'Unable to create an account with these details' }, { status: 400 });
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
