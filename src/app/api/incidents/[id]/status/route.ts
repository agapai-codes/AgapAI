// src/app/api/incidents/[id]/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { updateIncidentStatus, resolveIncident } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getUserById } from '@/lib/users';
import type { IncidentStatus } from '@/types/incident';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: IncidentStatus[] = ['PENDING', 'REVIEWING', 'PRIORITIZED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'RESOLVED'];

// PATCH /api/incidents/:id/status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { status, resolution_notes } = body ?? {};

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    // --- Authorization ---------------------------------------------------
    const demoOpen = process.env.DEMO_OPEN_MUTATIONS === 'true';
    let changedBy = 'dispatcher (demo)';

    const session = await getSessionUser().catch(() => null);
    if (session) {
      const dbUser = await getUserById(session.id).catch(() => null);
      const role = dbUser?.role ?? session.role;
      // Allow dispatcher, admin, AND responder roles
      if (role !== 'dispatcher' && role !== 'admin' && role !== 'responder') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      changedBy = dbUser?.email ?? session.email;
    } else if (!demoOpen) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    // ---------------------------------------------------------------------

    let updated;
    if (status === 'RESOLVED') {
      // Use resolveIncident which frees up the responder and persists notes
      updated = await resolveIncident(id, resolution_notes || 'Resolved', changedBy);
    } else {
      updated = await updateIncidentStatus(id, status, changedBy);
    }

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[API] PATCH /incidents/:id/status error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update incident status' }, { status: 500 });
  }
}
