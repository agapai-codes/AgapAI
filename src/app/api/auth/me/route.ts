// src/app/api/auth/me/route.ts

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error('[AUTH] Me error:', error);
    return NextResponse.json({ success: false, error: 'Failed to read session' }, { status: 500 });
  }
}
