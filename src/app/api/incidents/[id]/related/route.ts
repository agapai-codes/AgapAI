// src/app/api/incidents/[id]/related/route.ts
// GET /api/incidents/:id/related — Find related incidents (same type, nearby, same time window)

import { NextRequest, NextResponse } from 'next/server';
import { getIncidentById, findRelatedIncidents } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const incident = await getIncidentById(id);

    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }

    const related = await findRelatedIncidents(
      id,
      incident.type,
      incident.coordinates.lng,
      incident.coordinates.lat,
      incident.timestamp
    );

    return NextResponse.json({ success: true, data: related });
  } catch (error) {
    console.error('[API] GET /incidents/:id/related error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch related incidents' }, { status: 500 });
  }
}
