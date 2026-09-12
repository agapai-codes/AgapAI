// src/app/api/incidents/[id]/history/route.ts
// GET /api/incidents/:id/history — Returns status change history for an incident

import { NextRequest, NextResponse } from 'next/server';
import { getIncidentHistory } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const history = await getIncidentHistory(id);
    return NextResponse.json({ success: true, data: history });
  } catch (error) {
    console.error('[API] GET /incidents/:id/history error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch history' }, { status: 500 });
  }
}
