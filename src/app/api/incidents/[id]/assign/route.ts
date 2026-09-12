// src/app/api/incidents/[id]/assign/route.ts
// PATCH /api/incidents/:id/assign — Assign responder to incident

import { NextRequest, NextResponse } from 'next/server';
import { assignResponder } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { responder_id } = body ?? {};

    if (!responder_id) {
      return NextResponse.json({ success: false, error: 'Responder ID required' }, { status: 400 });
    }

    const session = await getSessionUser().catch(() => null);
    const changedBy = session?.email || 'dispatcher (demo)';

    const updated = await assignResponder(id, responder_id, changedBy);

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[API] PATCH /incidents/:id/assign error:', error);
    return NextResponse.json({ success: false, error: 'Failed to assign responder' }, { status: 500 });
  }
}
