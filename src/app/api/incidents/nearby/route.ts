// src/app/api/incidents/nearby/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { findNearbyIncidents } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/incidents/nearby?lng=124.24&lat=8.22&radius=1000
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lng = parseFloat(searchParams.get('lng') || '');
    const lat = parseFloat(searchParams.get('lat') || '');
    const radius = parseInt(searchParams.get('radius') || '1000', 10);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return NextResponse.json(
        { success: false, error: 'Valid lng and lat query params are required' },
        { status: 400 }
      );
    }

    const clampedRadius = Math.min(Math.max(radius || 1000, 1), 50000);
    const incidents = await findNearbyIncidents(lng, lat, clampedRadius);

    return NextResponse.json({ success: true, data: incidents });
  } catch (error) {
    console.error('[API] GET /incidents/nearby error:', error);
    return NextResponse.json({ success: false, error: 'Failed to find nearby incidents' }, { status: 500 });
  }
}
