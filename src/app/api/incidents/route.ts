// src/app/api/incidents/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAllIncidents, createIncident, findIncidentByClientRef } from '@/lib/db';
import type { IncidentType, UrgencyLevel } from '@/types/incident';

export const dynamic = 'force-dynamic';

const VALID_TYPES: IncidentType[] = ['FIRE', 'ACCIDENT', 'MEDICAL', 'VIOLENCE', 'NATURAL_DISASTER'];
const VALID_URGENCIES: UrgencyLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/** Sanitiser for the queue's idempotency key (e.g. "q-1712345678-abc123"). */
const CLIENT_REF_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Dedupe must degrade, never block — warn once if migration 007 is missing. */
let warnedClientRefLookup = false;

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
    const { type, location, description, reporter, coordinates, urgency, urgency_reason,
            people_affected, condition, hazards, transcript, reporter_email,
            confidence, consciousness, breathing, bleeding } = body ?? {};

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
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return NextResponse.json({ success: false, error: 'Coordinates out of range' }, { status: 400 });
    }

    // ── Idempotency for queued reports ─────────────────────────────────
    // The offline queue may POST the same payload twice (timeout after the
    // server already committed, two tabs flushing, storage write failure
    // after a successful POST). A replay returns the incident that already
    // exists with 200 so the queue drops it as delivered. Every failure in
    // this block degrades to the normal insert — dedupe never blocks a report.
    const rawClientRef = typeof body?.client_ref === 'string' ? body.client_ref.trim() : '';
    const clientRef = CLIENT_REF_PATTERN.test(rawClientRef) ? rawClientRef : null;
    let dedupeKey: string | undefined;
    if (clientRef) {
      try {
        const existing = await findIncidentByClientRef(clientRef);
        if (existing) {
          return NextResponse.json({ success: true, data: existing, duplicate: true }, { status: 200 });
        }
        dedupeKey = clientRef;
      } catch (err) {
        // Column missing (migration 007 not applied) or lookup failed: skip
        // dedupe for this request but keep creating the incident.
        if (!warnedClientRefLookup) {
          warnedClientRefLookup = true;
          console.warn('[API] client_ref dedupe unavailable — continuing without it:', err);
        }
      }
    }

    const incident = await createIncident(
      type,
      location.trim().slice(0, 500),
      (description || 'No description provided').toString().slice(0, 2000),
      (reporter || 'Anonymous').toString().slice(0, 255),
      lng,
      lat,
      {
        urgency: VALID_URGENCIES.includes(urgency) ? urgency : 'medium',
        urgency_reason: typeof urgency_reason === 'string' ? urgency_reason.slice(0, 1000) : undefined,
        people_affected: Number.isFinite(Number(people_affected)) ? Math.min(Math.max(1, Math.round(Number(people_affected))), 1000) : 1,
        condition: typeof condition === 'string' ? condition.slice(0, 1000) : undefined,
        hazards: Array.isArray(hazards) ? hazards.filter((h: unknown): h is string => typeof h === 'string').slice(0, 20) : undefined,
        transcript: typeof transcript === 'string' ? transcript.slice(0, 10000) : undefined,
        reporter_email: typeof reporter_email === 'string' ? reporter_email : undefined,
        confidence: typeof confidence === 'number' ? Math.min(Math.max(0, confidence), 1) : undefined,
        consciousness: typeof consciousness === 'boolean' ? consciousness : undefined,
        breathing: typeof breathing === 'boolean' ? breathing : undefined,
        bleeding: typeof bleeding === 'boolean' ? bleeding : undefined,
        clientRef: dedupeKey,
      }
    );

    if (!incident) {
      // A racing flush may have committed this client_ref first (the unique
      // index rejects our insert). If the row exists it WAS delivered.
      if (dedupeKey) {
        try {
          const existing = await findIncidentByClientRef(dedupeKey);
          if (existing) {
            return NextResponse.json({ success: true, data: existing, duplicate: true }, { status: 200 });
          }
        } catch (err) {
          console.warn('[API] client_ref re-lookup after failed insert:', err);
        }
      }
      return NextResponse.json(
        { success: false, error: 'Failed to create incident' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: incident }, { status: 201 });
  } catch (error) {
    console.error('[API] POST /incidents error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create incident' },
      { status: 500 }
    );
  }
}
