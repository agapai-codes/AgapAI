// src/app/api/incidents/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAllIncidents, createIncident } from '@/lib/db';
import type { IncidentType } from '@/types/incident';

export const dynamic = 'force-dynamic';

const VALID_TYPES: IncidentType[] = ['FIRE', 'ACCIDENT', 'MEDICAL', 'DISASTER'];

// GET /api/incidents
export async function GET() {
  try {
    const incidents = await getAllIncidents();
    return NextResponse.json({ success: true, data: incidents });
  } catch (error) {
    console.error('[API] GET /incidents error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch incidents' },
      { status: 500 }
    );
  }
}

// POST /api/incidents
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type, location, description, reporter, coordinates } = body ?? {};

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      );
    }
    if (typeof location !== 'string' || location.trim() === '') {
      return NextResponse.json({ success: false, error: 'Location is required' }, { status: 400 });
    }
    const lng = Number(coordinates?.lng);
    const lat = Number(coordinates?.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return NextResponse.json({ success: false, error: 'Valid coordinates are required' }, { status: 400 });
    }
    // Iligan City bounding box sanity clamp
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return NextResponse.json({ success: false, error: 'Coordinates out of range' }, { status: 400 });
    }

    const incident = await createIncident(
      type,
      location.trim().slice(0, 500),
      (description || 'No description provided').toString().slice(0, 2000),
      (reporter || 'Anonymous').toString().slice(0, 255),
      lng,
      lat
    );

    return NextResponse.json({ success: true, data: incident }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /incidents error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create incident' },
      { status: 500 }
    );
  }
}
