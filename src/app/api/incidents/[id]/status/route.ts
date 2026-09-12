// src/app/api/incidents/[id]/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { updateIncidentStatus } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import type { IncidentStatus } from '@/types/incident';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: IncidentStatus[] = ['PENDING', 'DISPATCHED', 'RESOLVED'];

// PATCH /api/incidents/:id/status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { status } = body ?? {};

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // Optional auth: attribute the change to the logged-in user if present.
    // The dashboard is open for the demo, so this is not enforced.
    let changedBy = 'dispatcher (demo)';
    try {
      const user = await getSessionUser();
      if (user?.email) changedBy = user.email;
    } catch {
      // ignore — leave demo attribution
    }

    const updated = await updateIncidentStatus(id, status, changedBy);

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[API] PATCH /incidents/:id/status error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update incident status' }, { status: 500 });
  }
}
