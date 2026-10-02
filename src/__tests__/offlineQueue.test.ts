import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  toSmsBeacon,
  smsHref,
  telHref,
  SEND_TIMEOUT_MS,
  enqueue,
  flushQueue,
  listAll,
  listQueued,
  pendingCount,
} from '../lib/offlineQueue';
import { linkLabel, SATELLITE_LIKE_MS, INITIAL_LINK_STATE, getLinkState } from '../lib/connectivity';
import type { CreateIncidentPayload } from '../types/incident';

const basePayload = (over: Partial<CreateIncidentPayload> = {}): CreateIncidentPayload => ({
  type: 'MEDICAL',
  location: 'Iligan City, Philippines',
  description: 'Emergency beacon activated',
  reporter: 'System (SOS)',
  coordinates: { lng: 124.242098, lat: 8.229563 },
  urgency: 'HIGH',
  urgency_reason: 'One-tap SOS activated',
  ...over,
});

describe('offline beacon (SMS handoff)', () => {
  it('fits inside a single GSM-7 SMS segment', () => {
    const beacon = toSmsBeacon(basePayload());
    expect(beacon.length).toBeLessThanOrEqual(160);
  });

  it('stays within one segment even with a very long description', () => {
    const beacon = toSmsBeacon(
      basePayload({
        condition: 'x'.repeat(500),
        description: 'y'.repeat(500),
      })
    );
    expect(beacon.length).toBeLessThanOrEqual(160);
  });

  it('carries type, urgency and coordinates — the fields that save a life', () => {
    const beacon = toSmsBeacon(basePayload());
    expect(beacon).toContain('AGAPAI SOS');
    expect(beacon).toContain('MEDICAL');
    expect(beacon).toContain('HIGH');
    // Coordinates are rounded to 4dp (~11m) — precise enough to find a person.
    expect(beacon).toContain('8.2296');
    expect(beacon).toContain('124.2421');
  });

  it('still produces a usable beacon when coordinates are missing', () => {
    const beacon = toSmsBeacon(basePayload({ coordinates: { lng: 0, lat: 0 } }));
    expect(beacon.length).toBeLessThanOrEqual(160);
    expect(beacon).toContain('0.0000');
  });

  it('omits the note entirely when there is no room for it', () => {
    const beacon = toSmsBeacon(basePayload({ condition: 'z'.repeat(300) }));
    expect(beacon.length).toBeLessThanOrEqual(160);
    // Truncation must not leave a dangling separator.
    expect(beacon.endsWith(' ')).toBe(false);
  });
});

describe('out-of-band fallback links', () => {
  it('builds an sms: body URI that is safely encoded', () => {
    const href = smsHref(basePayload({ condition: 'unconscious & not breathing' }));
    expect(href.startsWith('sms:?&body=')).toBe(true);
    const body = decodeURIComponent(href.split('body=')[1]);
    expect(body).toContain('unconscious & not breathing');
    expect(href).not.toContain(' ');
  });

  it('keeps an explicit recipient when one is supplied', () => {
    expect(smsHref(basePayload(), '+639171234567')).toContain('sms:+639171234567');
  });

  it('strips non-numeric characters from tel: links', () => {
    expect(telHref('+63 (917) 123-4567')).toBe('tel:+639171234567');
    expect(telHref('911')).toBe('tel:911');
  });
});

describe('transmission timing', () => {
  it('allows enough time for a satellite round trip', () => {
    // LEO sits around 600ms, GEO around 24000ms; a 2s default would declare a
    // working satellite link dead.
    expect(SEND_TIMEOUT_MS).toBeGreaterThan(SATELLITE_LIKE_MS);
    expect(SEND_TIMEOUT_MS).toBeGreaterThanOrEqual(25_000);
  });

  it('classifies anything above the satellite threshold as slow', () => {
    expect(SATELLITE_LIKE_MS).toBeGreaterThan(600);
    expect(SATELLITE_LIKE_MS).toBeLessThan(10_000);
  });
});

describe('connectivity labelling', () => {
  it('never claims a connection it does not have', () => {
    expect(linkLabel({ ...INITIAL_LINK_STATE, status: 'offline' })).toBe('NO SIGNAL');
    expect(linkLabel({ ...INITIAL_LINK_STATE, status: 'checking' })).toBe('CHECKING');
    expect(linkLabel({ ...INITIAL_LINK_STATE, status: 'online' })).toBe('ONLINE');
  });

  it('distinguishes satellite-grade latency from a normal slow link', () => {
    const satellite = linkLabel({
      ...INITIAL_LINK_STATE,
      status: 'degraded',
      satelliteLike: true,
      rttMs: 700,
    });
    const slow = linkLabel({
      ...INITIAL_LINK_STATE,
      status: 'degraded',
      satelliteLike: false,
      rttMs: 400,
    });
    expect(satellite).toBe('SATELLITE LINK');
    expect(slow).toBe('SLOW LINK');
  });

  it('starts in a non-committal state so the UI never flashes ONLINE', () => {
    expect(INITIAL_LINK_STATE.status).toBe('checking');
    expect(INITIAL_LINK_STATE.lastCheckedAt).toBeNull();
    expect(getLinkState().status).toBe('checking');
  });
});

// ── Flush acknowledgement handling ───────────────────────────────────────────
// A lost or falsely-"delivered" report is a real-world failure: these tests
// pin the rule that only an explicit server acknowledgement removes an item.

type FetchHandler = (init: RequestInit | undefined) => Response | Promise<Response>;

function stubFetch(handler: FetchHandler) {
  const fn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => handler(init));
  vi.stubGlobal('fetch', fn);
  return fn;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('flushQueue acknowledgement handling', () => {
  beforeEach(() => {
    // Node has no localStorage — install a synchronous in-memory mock so the
    // queue exercises its documented fallback backend.
    const mem = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => (mem.has(key) ? (mem.get(key) as string) : null),
        setItem: (key: string, value: string) => {
          mem.set(key, String(value));
        },
        removeItem: (key: string) => {
          mem.delete(key);
        },
        clear: () => {
          mem.clear();
        },
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('removes the report only on an explicit success: true acknowledgement', async () => {
    await enqueue(basePayload());
    stubFetch(() => jsonResponse({ success: true, data: { id: 'inc-1' } }, 201));

    const result = await flushQueue();

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.remaining).toBe(0);
    expect(await listAll()).toHaveLength(0);
  });

  it('C2: keeps a 200 with a non-JSON body (captive portal) queued', async () => {
    const item = await enqueue(basePayload());
    stubFetch(
      () =>
        new Response('<html>Wi-Fi login required</html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
    );

    const result = await flushQueue();

    expect(result.sent).toBe(0);
    expect(result.remaining).toBe(1);
    const rows = await listAll();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(item.id);
    expect(rows[0].permanent).toBe(false);
    expect(rows[0].status).toBe('queued');
  });

  it('C2: keeps a 200 that lacks success: true queued', async () => {
    const item = await enqueue(basePayload());
    stubFetch(() => jsonResponse({ data: { id: 'inc-2' } }, 200));

    const result = await flushQueue();

    expect(result.sent).toBe(0);
    expect(await pendingCount()).toBe(1);
    const [row] = await listAll();
    expect(row.id).toBe(item.id);
    expect(row.permanent).toBe(false);
    expect(row.lastError).toBeTruthy();
  });

  it('C3: a 429 stays queued for retry instead of becoming permanent', async () => {
    await enqueue(basePayload());
    stubFetch(() => jsonResponse({ success: false, error: 'Rate limited' }, 429));

    const result = await flushQueue();

    expect(result.failed).toBe(1);
    expect(result.rejected).toBe(0);
    expect(await pendingCount()).toBe(1);
    const [row] = await listQueued();
    expect(row.permanent).toBe(false);
    expect(row.status).toBe('queued');
    expect(row.lastError).toContain('Rate limited');
  });

  it('C3: a 422 becomes permanent because retrying can never help', async () => {
    await enqueue(basePayload());
    stubFetch(() => jsonResponse({ success: false, error: 'Validation failed' }, 422));

    const result = await flushQueue();

    expect(result.failed).toBe(1);
    expect(result.rejected).toBe(1);
    // Permanent items are excluded from the pending count but stay visible
    // to listAll for the "needs attention" indicator.
    expect(await pendingCount()).toBe(0);
    const [row] = await listAll();
    expect(row.permanent).toBe(true);
    expect(row.status).toBe('failed');
    expect(row.lastError).toContain('Validation failed');
  });

  it('FlushResult still exposes sent, failed and remaining', async () => {
    await enqueue(basePayload());
    stubFetch(() => jsonResponse({ success: false, error: 'Nope' }, 500));

    const result = await flushQueue();

    expect(typeof result.sent).toBe('number');
    expect(typeof result.failed).toBe('number');
    expect(typeof result.remaining).toBe('number');
    expect(result).toMatchObject({ sent: 0, failed: 1, remaining: 1 });
  });

  it('H1: attaches client_ref so the server can dedupe a lost response', async () => {
    const item = await enqueue(basePayload());
    const fn = stubFetch(() => jsonResponse({ success: true, data: { id: 'inc-3' } }, 201));

    await flushQueue();

    expect(fn).toHaveBeenCalledTimes(1);
    const init = fn.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.client_ref).toBe(item.id);
    expect(body.type).toBe('MEDICAL');
  });
});
