// src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createSessionToken, setSessionCookie } from '@/lib/auth';
import { getUserByEmail } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body ?? {};

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await createSessionToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      data: { id: user.id, email: user.email, role: user.role, name: user.name },
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    return NextResponse.json({ success: false, error: 'Failed to sign in' }, { status: 500 });
  }
}
