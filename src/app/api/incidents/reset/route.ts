// src/app/api/incidents/reset/route.ts
// POST /api/incidents/reset — Purge all incident records

import { NextResponse } from 'next/server';
import { purgeAllIncidents } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getUserById } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // --- Authorization ---------------------------------------------------
    // Do NOT honor DEMO_OPEN_MUTATIONS: purge-all is destructive and requires real dispatcher/admin auth even in demo mode.
    const session = await getSessionUser().catch(() => null);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const dbUser = await getUserById(session.id).catch(() => null);
    const role = dbUser?.role ?? session.role;

    if (role !== 'dispatcher' && role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }
    // ---------------------------------------------------------------------

    const result = await purgeAllIncidents();
    return NextResponse.json({
      success: true,
      message: `Purged ${result.deleted} incident records.`,
      deleted: result.deleted,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

