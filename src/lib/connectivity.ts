/**
 * Link-awareness for zero-coverage operation.
 *
 * `navigator.onLine` is a lie on phones: it only reports whether *some*
 * network interface claims to be up. A device parked on a non-working cell
 * tower, a captive portal, or a satellite link with a 600ms+ round trip all
 * report "online". So we combine:
 *
 *   1. the browser online/offline events (cheap, immediate)
 *   2. an active probe against /api/health (never cached by the service worker)
 *   3. measured round-trip time, to flag "degraded" links that are technically
 *      up but too slow to assume a report went through
 *
 * Timing rationale: LEO satellite is ~600ms RTT plus overhead, GEO is ~24000ms.
 * Anything above ~1500ms is treated as satellite-like: sends are still attempted
 * but with long timeouts, and the UI must not claim the report was delivered.
 * A probe that exceeds its own deadline (PROBE_TIMEOUT_MS, 8s) while the
 * browser still reports a connection counts as slow-but-up (degraded), not
 * offline — GEO would otherwise always look like NO SIGNAL.
 */

export type LinkStatus = 'online' | 'degraded' | 'offline' | 'checking';

export interface LinkState {
  status: LinkStatus;
  /** Last measured round-trip time in ms, null if the last probe failed. */
  rttMs: number | null;
  /** Coarse browser-reported connection type, when the API is available. */
  effectiveType: string | null;
  lastCheckedAt: number | null;
  /** True when the link is up but slow enough to be satellite or congested. */
  satelliteLike: boolean;
  source: 'initial' | 'event' | 'probe';
}

/** Above this RTT we treat the link as satellite-like / heavily degraded. */
export const SATELLITE_LIKE_MS = 1500;
/** How long we wait on a probe before declaring the link dead. */
export const PROBE_TIMEOUT_MS = 8000;
/** Retry cadence: fast at first, easing off so a dead link costs no battery. */
const BACKOFF_STEPS_MS = [2_000, 4_000, 8_000, 15_000, 30_000];

/**
 * The probe hit its own deadline. That is a *slow* link, not a proven-dead
 * one: GEO satellite RTT (~24000ms) is far beyond PROBE_TIMEOUT_MS, so a
 * timeout on a connection the browser still reports as up must not be
 * classified `offline` (which would suppress the auto-flush).
 */
export class ProbeTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Probe timed out after ${timeoutMs}ms`);
    this.name = 'ProbeTimeoutError';
  }
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException || err instanceof Error) && err.name === 'AbortError'
  );
}

export const INITIAL_LINK_STATE: LinkState = {
  status: 'checking',
  rttMs: null,
  effectiveType: null,
  lastCheckedAt: null,
  satelliteLike: false,
  source: 'initial',
};

type Listener = (state: LinkState) => void;

let state: LinkState = INITIAL_LINK_STATE;
const listeners = new Set<Listener>();

function emit(next: LinkState) {
  state = next;
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch {
      /* a bad listener must not break link reporting */
    }
  });
}

function readEffectiveType(): string | null {
  if (typeof navigator === 'undefined') return null;
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string } })
    .connection;
  return conn?.effectiveType ?? null;
}

/** Round-trip a tiny uncached API call. Resolves with the RTT, rejects on failure. */
export async function probeOnce(timeoutMs = PROBE_TIMEOUT_MS): Promise<number> {
  if (typeof fetch === 'undefined') throw new Error('fetch unavailable');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const res = await fetch('/api/health', {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`probe ${res.status}`);
    // Consume the body so the connection is actually released.
    await res.text().catch(() => '');
    return Math.round(performance.now() - started);
  } catch (err) {
    // The only abort source here is our own deadline — tag it so callers can
    // tell "too slow to answer yet" apart from "the network refused us".
    if (isAbortError(err)) throw new ProbeTimeoutError(timeoutMs);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run one probe and publish the result. Never throws — a failed probe is
 * itself a valid observation (it means: no coverage).
 */
export async function refreshLink(source: LinkState['source'] = 'probe'): Promise<LinkState> {
  if (typeof navigator === 'undefined' || navigator.onLine === false) {
    const next: LinkState = {
      status: 'offline',
      rttMs: null,
      effectiveType: readEffectiveType(),
      lastCheckedAt: Date.now(),
      satelliteLike: false,
      source,
    };
    emit(next);
    return next;
  }

  try {
    const rtt = await probeOnce();
    const next: LinkState = {
      status: rtt > SATELLITE_LIKE_MS ? 'degraded' : 'online',
      rttMs: rtt,
      effectiveType: readEffectiveType(),
      lastCheckedAt: Date.now(),
      satelliteLike: rtt > SATELLITE_LIKE_MS,
      source,
    };
    emit(next);
    return next;
  } catch (err) {
    // A probe that hit *our* deadline while the browser still reports a
    // connection is a slow-but-present link (GEO satellite is ~24000ms, far
    // past PROBE_TIMEOUT_MS). Calling that `offline` would show NO SIGNAL
    // over a working link and suppress the auto-flush. True network
    // failures still land here as `offline`.
    const timedOut = err instanceof ProbeTimeoutError || isAbortError(err);
    const slowButUp = timedOut && typeof navigator !== 'undefined' && navigator.onLine === true;
    const next: LinkState = slowButUp
      ? {
          status: 'degraded',
          rttMs: null,
          effectiveType: readEffectiveType(),
          lastCheckedAt: Date.now(),
          satelliteLike: true,
          source,
        }
      : {
          status: 'offline',
          rttMs: null,
          effectiveType: readEffectiveType(),
          lastCheckedAt: Date.now(),
          satelliteLike: false,
          source,
        };
    emit(next);
    return next;
  }
}

export function getLinkState(): LinkState {
  return state;
}

export function subscribeLink(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let failStreak = 0;
let watching = false;
/** How many consumers currently want the watcher alive. */
let consumers = 0;
let onlineHandler: (() => void) | null = null;
let offlineHandler: (() => void) | null = null;

function scheduleNext() {
  if (!watching) return;
  if (pollTimer) clearTimeout(pollTimer);
  const step = BACKOFF_STEPS_MS[Math.min(failStreak, BACKOFF_STEPS_MS.length - 1)];
  // While healthy, poll slowly; while broken, escalate through the backoff.
  const delay = failStreak === 0 ? 30_000 : step;
  pollTimer = setTimeout(async () => {
    // Re-check: a probe in flight when the last consumer unmounted must not
    // re-arm a zombie timer.
    if (!watching) return;
    const next = await refreshLink('probe');
    if (!watching) return;
    failStreak = next.status === 'offline' ? failStreak + 1 : 0;
    scheduleNext();
  }, delay);
}

/**
 * Start watching connectivity. Reference-counted: every call returns its own
 * teardown, and the shared probe loop + window listeners only stop when the
 * last consumer unmounts (so one component navigating away cannot freeze
 * `LinkState` for everyone else). Safe to call repeatedly.
 */
export function startLinkWatcher(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  if (!watching) {
    watching = true;
    consumers = 0;
    failStreak = 0;

    onlineHandler = () => {
      failStreak = 0;
      void refreshLink('event');
      scheduleNext();
    };
    offlineHandler = () => {
      emit({
        status: 'offline',
        rttMs: null,
        effectiveType: readEffectiveType(),
        lastCheckedAt: Date.now(),
        satelliteLike: false,
        source: 'event',
      });
    };

    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    void refreshLink('initial');
    scheduleNext();
  }
  consumers += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    consumers -= 1;
    if (consumers > 0) return; // others are still watching
    watching = false;
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
    if (onlineHandler) window.removeEventListener('online', onlineHandler);
    if (offlineHandler) window.removeEventListener('offline', offlineHandler);
    onlineHandler = null;
    offlineHandler = null;
  };
}

/** Human-readable label for the connectivity chip. */
export function linkLabel(link: LinkState): string {
  switch (link.status) {
    case 'offline':
      return 'NO SIGNAL';
    case 'degraded':
      return link.satelliteLike ? 'SATELLITE LINK' : 'SLOW LINK';
    case 'checking':
      return 'CHECKING';
    default:
      return 'ONLINE';
  }
}
