// src/app/api/incidents/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getIncidentById } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/incidents/:id
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

    return NextResponse.json({ success: true, data: incident });
  } catch (error) {
    console.error('[API] GET /incidents/:id error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch incident' }, { status: 500 });
  }
}
