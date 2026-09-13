// src/app/api/incidents/reset/route.ts
// POST /api/incidents/reset — Purge all incident records

import { NextResponse } from 'next/server';
import { purgeAllIncidents } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
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
