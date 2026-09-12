// src/app/api/auth/responder-login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createSessionToken, setSessionCookie } from '@/lib/auth';
import { getResponderByEmail } from '@/lib/db';
import { getUserByEmail } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body ?? {};

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password required' }, { status: 400 });
    }

    // Check responders table first
    const responder = await getResponderByEmail(email);
    if (responder) {
      const valid = await verifyPassword(password, responder.password_hash);
      if (!valid) {
        return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
      }
      const token = await createSessionToken({
        id: responder.id,
        email: responder.email,
        role: 'responder' as any,
        name: responder.name,
      });
      await setSessionCookie(token);
      return NextResponse.json({
        success: true,
        data: { id: responder.id, name: responder.name, email: responder.email, role: 'responder', status: responder.status },
      });
    }

    // Fallback: check users table (dispatchers/admins can also use responder view)
    const user = await getUserByEmail(email);
    if (user) {
      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) {
        return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
      }
      const token = await createSessionToken({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      });
      await setSessionCookie(token);
      return NextResponse.json({
        success: true,
        data: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    console.error('[AUTH] Responder login error:', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
