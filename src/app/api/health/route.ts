import { NextResponse } from 'next/server';

/**
 * Connectivity probe target.
 *
 * Deliberately does no database or environment work: this is hit constantly by
 * the client to decide whether the phone has any coverage at all, including
 * over a satellite link, so it has to stay cheap and instant.
 *
 * The service worker never caches /api/*, so a successful response here is
 * always a real round trip to the origin.
 */
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    { ok: true, t: Date.now() },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    }
  );
}
