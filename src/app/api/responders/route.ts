// src/app/api/responders/route.ts
// GET /api/responders — List all responders
// PATCH /api/responders — Update responder status/location

import { NextRequest, NextResponse } from 'next/server';
import { getAllResponders, updateResponderLocation, updateResponderStatus } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const responders = await getAllResponders();
    return NextResponse.json({ success: true, data: responders });
  } catch (error) {
    console.error('[API] GET /responders error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch responders' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionUser().catch(() => null);

    const isDispatcherOrAdmin = session?.role === 'dispatcher' || session?.role === 'admin';
    if (!session || !isDispatcherOrAdmin) {
      const hasAuth = !!process.env.AUTH_SECRET;
      if (hasAuth) {
        return NextResponse.json({ success: false, error: 'Unauthorized: dispatcher or admin role required' }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const { id, status, lat, lng } = body ?? {};

    if (!id) {
      return NextResponse.json({ success: false, error: 'Responder ID required' }, { status: 400 });
    }

    if (status && ['available', 'busy', 'offline'].includes(status)) {
      await updateResponderStatus(id, status);
    }

    if (typeof lat === 'number' && typeof lng === 'number') {
      await updateResponderLocation(id, lat, lng);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] PATCH /responders error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update responder' }, { status: 500 });
  }
}
