// src/app/api/auth/responder-login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createSessionToken, setSessionCookie } from '@/lib/auth';
import { getResponderByEmail } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body ?? {};

    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Email and password required' }, { status: 400 });
    }

    const responder = await getResponderByEmail(email);
    if (!responder) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

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
  } catch (error) {
    console.error('[AUTH] Responder login error:', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
