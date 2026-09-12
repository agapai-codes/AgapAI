// src/app/api/incidents/[id]/urgency/route.ts
// PATCH /api/incidents/:id/urgency — Dispatcher overrides AI-assessed urgency

import { NextRequest, NextResponse } from 'next/server';
import { updateIncidentUrgency } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getUserById } from '@/lib/users';
import type { UrgencyLevel } from '@/types/incident';

export const dynamic = 'force-dynamic';

const VALID_URGENCIES: UrgencyLevel[] = ['critical', 'high', 'medium', 'low'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { urgency, urgency_reason } = body ?? {};

    if (!urgency || !VALID_URGENCIES.includes(urgency)) {
      return NextResponse.json(
        { success: false, error: `Invalid urgency. Must be one of: ${VALID_URGENCIES.join(', ')}` },
        { status: 400 }
      );
    }

    // Authorization: dispatcher/admin session or demo mode
    const demoOpen = process.env.DEMO_OPEN_MUTATIONS === 'true';
    let changedBy = 'dispatcher (demo)';

    const session = await getSessionUser().catch(() => null);
    if (session) {
      const dbUser = await getUserById(session.id).catch(() => null);
      const role = dbUser?.role ?? session.role;
      if (role !== 'dispatcher' && role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      changedBy = dbUser?.email ?? session.email;
    } else if (!demoOpen) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const updated = await updateIncidentUrgency(id, urgency, urgency_reason || 'Dispatcher override', changedBy);

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[API] PATCH /incidents/:id/urgency error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update urgency' }, { status: 500 });
  }
}
