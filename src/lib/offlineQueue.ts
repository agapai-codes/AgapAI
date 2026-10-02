/**
 * Durable offline queue for emergency reports.
 *
 * The core promise of the app: if a citizen has no cell towers, the report
 * still leaves the device the moment *any* link appears. That requires storage
 * that survives a tab close and a phone reboot — so IndexedDB, with
 * localStorage as the degraded fallback (private-mode tabs, blocked storage).
 *
 * Transmission rules:
 *   - a report counts as delivered ONLY when the server acknowledges it:
 *     2xx with an explicit `success: true`. A non-JSON 200 (captive portal,
 *     WAF page), a 204, or a body without `success` leaves the item queued —
 *     never deleted, never counted as sent
 *   - flush attempts POST the payload with a `client_ref` (the queue item id)
 *     so the server can dedupe when the response to a successful POST is lost
 *   - network-level failure keeps the item queued and stops the run (retrying
 *     while there is provably no coverage only burns battery)
 *   - only definitive 4xx rejections (400/404/409/413/422) mark the item
 *     permanent: it will never succeed on retry, and looping on it would
 *     starve the reports behind it. Every other status — including transient
 *     4xx like 401/403/408/429 — stays queued and retries
 *   - timeouts are long by default because LEO satellite sits at ~600ms RTT
 *     and GEO at ~24000ms; a 2s timeout would declare a working link dead
 */

import type { CreateIncidentPayload } from '@/types/incident';

const DB_NAME = 'agapai-sos';
const DB_VERSION = 1;
const STORE = 'queue';
const LS_KEY = 'agapai:sos-queue';

/** Long enough for a satellite round trip, short enough to not hang the UI. */
export const SEND_TIMEOUT_MS = 30_000;

export type QueuedStatus = 'queued' | 'failed';

export interface QueuedReport {
  id: string;
  createdAt: number;
  payload: CreateIncidentPayload;
  status: QueuedStatus;
  attempts: number;
  lastAttemptAt: number | null;
  lastError: string | null;
  /** Set when retrying can never help (e.g. the server rejected the payload). */
  permanent: boolean;
}

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* a subscriber must not break the queue */
    }
  });
}

export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ── Storage backends ─────────────────────────────────────────────────────────

interface Backend {
  all(): Promise<QueuedReport[]>;
  put(item: QueuedReport): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
  // If it fails once, forget the promise so a later call can retry.
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let result: T | undefined;
        let settled = false;
        const t = db.transaction(STORE, mode);
        // Resolve only when the transaction *commits*. Resolving on the
        // request's onsuccess reports success before the write is durable
        // (a killed phone silently rolls it back) and can never observe an
        // abort after the request succeeded.
        t.oncomplete = () => {
          if (settled) return;
          settled = true;
          resolve(result as T);
        };
        const fail = () => {
          if (settled) return;
          settled = true;
          reject(t.error ?? new Error('IndexedDB transaction failed'));
        };
        t.onerror = fail;
        t.onabort = fail;
        try {
          const req = run(t.objectStore(STORE));
          req.onsuccess = () => {
            result = req.result;
          };
          // A failed request aborts the transaction, which fail() reports.
        } catch (err) {
          if (!settled) {
            settled = true;
            reject(err);
          }
        }
      })
  );
}

const idbBackend: Backend = {
  async all() {
    const rows = await tx<QueuedReport[]>('readonly', (s) => s.getAll() as IDBRequest<QueuedReport[]>);
    return rows ?? [];
  },
  async put(item) {
    await tx('readwrite', (s) => s.put(item) as IDBRequest<IDBValidKey>);
  },
  async remove(id) {
    await tx('readwrite', (s) => s.delete(id) as IDBRequest<undefined>);
  },
  async clear() {
    await tx('readwrite', (s) => s.clear() as IDBRequest<undefined>);
  },
};

function readLsRows(): QueuedReport[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as QueuedReport[]) : [];
  } catch {
    return [];
  }
}

/**
 * localStorage fallback — smaller quota, but still survives a reload.
 *
 * Every read-modify-write runs with no `await` between read and write, so an
 * enqueue interleaved with a flush's remove/put can never be overwritten by
 * a stale snapshot.
 */
const lsBackend: Backend = {
  async all() {
    return readLsRows();
  },
  async put(item) {
    const rows = readLsRows();
    const next = rows.filter((r) => r.id !== item.id);
    next.push(item);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  },
  async remove(id) {
    const rows = readLsRows();
    localStorage.setItem(LS_KEY, JSON.stringify(rows.filter((r) => r.id !== id)));
  },
  async clear() {
    localStorage.removeItem(LS_KEY);
  },
};

let idbReady = false; // IndexedDB opened successfully — the only backend choice we cache
let usedLocalStorage = false; // we may hold rows written via the fallback this session
let usingFallback = false; // the active write backend is localStorage

/**
 * Session that has touched localStorage *and* IndexedDB: rows can live in
 * either store (reports written during a fallback window, reports written
 * before it). Reads union both — deduped by id, newest row wins — and
 * writes/deletes span both, so no report is ever invisible to
 * `listQueued()`/`flushQueue()` regardless of which store holds it.
 */
const dualStoreBackend: Backend = {
  async all() {
    const [idbRows, lsRows] = await Promise.all([
      idbBackend.all().catch(() => [] as QueuedReport[]),
      lsBackend.all().catch(() => [] as QueuedReport[]),
    ]);
    // When the same id exists in both stores one copy is stale (its
    // bookkeeping was updated in the other store): keep the one with the
    // furthest progress.
    const progress = (r: QueuedReport): [number, number] => [
      r.attempts,
      r.lastAttemptAt ?? r.createdAt,
    ];
    const byId = new Map<string, QueuedReport>();
    for (const row of [...idbRows, ...lsRows]) {
      const current = byId.get(row.id);
      if (!current) {
        byId.set(row.id, row);
        continue;
      }
      const [aAttempts, aAt] = progress(row);
      const [bAttempts, bAt] = progress(current);
      if (aAttempts > bAttempts || (aAttempts === bAttempts && aAt > bAt)) {
        byId.set(row.id, row);
      }
    }
    return [...byId.values()];
  },
  async put(item) {
    if (idbReady) {
      // Recovered: the durable store is primary again; the fallback copy is
      // kept in sync best-effort (read() prefers the newer row if it is not).
      await idbBackend.put(item);
      await lsBackend.put(item).catch(() => undefined);
      return;
    }
    // Still on the fallback: this write must succeed or the caller is told.
    await lsBackend.put(item);
    await idbBackend.put(item).catch(() => undefined);
  },
  async remove(id) {
    // The live store must actually drop the row; the other store is cleaned
    // up best-effort (it may be unreachable or hold only a stale copy —
    // a resurrected row is retransmitted under the same client_ref).
    if (idbReady) {
      await idbBackend.remove(id);
      await lsBackend.remove(id).catch(() => undefined);
      return;
    }
    await lsBackend.remove(id);
    await idbBackend.remove(id).catch(() => undefined);
  },
  async clear() {
    if (idbReady) {
      await idbBackend.clear();
      await lsBackend.clear().catch(() => undefined);
      return;
    }
    await lsBackend.clear();
    await idbBackend.clear().catch(() => undefined);
  },
};

/**
 * Pick the active backend. A *failure* is never cached: if IndexedDB cannot
 * open we fall back for this call only and retry on the next one, otherwise
 * one transient error (blocked upgrade, private mode) would strand every
 * report already stored in IndexedDB for the rest of the session.
 */
async function getBackend(): Promise<Backend> {
  try {
    await openDb();
    idbReady = true;
    usingFallback = false;
    return usedLocalStorage ? dualStoreBackend : idbBackend;
  } catch {
    usedLocalStorage = true;
    usingFallback = true;
    return dualStoreBackend;
  }
}

/**
 * True while the active write backend is the localStorage fallback
 * (private mode, blocked IDB). Resets if IndexedDB recovers later.
 */
export function isDegradeStorage(): boolean {
  return usingFallback;
}

/**
 * Ask the browser not to evict our storage under pressure. Without this an
 * installed PWA's queued reports can be deleted when the device runs low on
 * space, which for this app means a lost emergency report.
 */
export async function requestDurableStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage) return false;
  try {
    if (navigator.storage.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage.persist) return await navigator.storage.persist();
  } catch {
    /* feature missing or denied — not fatal */
  }
  return false;
}

// ── Queue operations ─────────────────────────────────────────────────────────

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueue(payload: CreateIncidentPayload): Promise<QueuedReport> {
  const store = await getBackend();
  const item: QueuedReport = {
    id: makeId(),
    createdAt: Date.now(),
    payload,
    status: 'queued',
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    permanent: false,
  };
  try {
    await store.put(item);
  } catch (err) {
    // Never report a save that did not happen — the caller surfaces this.
    const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : '';
    const quota = name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
    throw new Error(
      quota
        ? 'Device storage is full — the report could not be saved. Free up space and try again.'
        : `Could not save the report on this device${err instanceof Error && err.message ? `: ${err.message}` : '.'}`
    );
  }
  void requestDurableStorage();
  notify();
  return item;
}

export async function listQueued(): Promise<QueuedReport[]> {
  const store = await getBackend();
  const rows = await store.all();
  return rows
    .filter((r) => !r.permanent)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Includes permanently failed items, for the "needs attention" indicator. */
export async function listAll(): Promise<QueuedReport[]> {
  const store = await getBackend();
  const rows = await store.all();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function pendingCount(): Promise<number> {
  return (await listQueued()).length;
}

export async function removeReport(id: string): Promise<void> {
  const store = await getBackend();
  await store.remove(id);
  notify();
}

export async function clearQueue(): Promise<void> {
  const store = await getBackend();
  await store.clear();
  notify();
}

export interface FlushResult {
  sent: number;
  failed: number;
  remaining: number;
  /** How many of `failed` were rejected permanently (never retried). */
  rejected?: number;
}

/** The only 4xx statuses that mean "retrying can never help". */
const PERMANENT_4XX = new Set([400, 404, 409, 413, 422]);

let flushing = false;

/**
 * Attempt to transmit everything queued. Returns counts so the caller can
 * report accurately — never claim a report was delivered when it was not.
 *
 * Concurrent flushes (including from other tabs) are serialised through the
 * Web Locks API when available, so the same snapshot is never POSTed twice;
 * without it the module-level `flushing` flag guards within this tab.
 */
export async function flushQueue(options: { timeoutMs?: number } = {}): Promise<FlushResult> {
  if (flushing) return { sent: 0, failed: 0, remaining: await pendingCount(), rejected: 0 };
  flushing = true;
  try {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks) {
      return (await locks.request('agapai-flush', () => runFlush(options))) as FlushResult;
    }
    return await runFlush(options);
  } finally {
    flushing = false;
    notify();
  }
}

async function runFlush(options: { timeoutMs?: number }): Promise<FlushResult> {
  const timeoutMs = options.timeoutMs ?? SEND_TIMEOUT_MS;
  let sent = 0;
  let failed = 0;
  let rejected = 0;

  const store = await getBackend();
  const snapshot = await listQueued();

  for (const item of snapshot) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const attempt: QueuedReport = {
      ...item,
      attempts: item.attempts + 1,
      lastAttemptAt: Date.now(),
    };

    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The queue item id doubles as an idempotency key: if the response
        // to a good POST is lost, the server can drop the duplicate.
        body: JSON.stringify({ ...item.payload, client_ref: item.id }),
        signal: controller.signal,
        cache: 'no-store',
      });

      let body: { success?: boolean; error?: string } = {};
      try {
        body = await res.json();
      } catch {
        /* non-JSON body (captive portal, 204) → not delivered, see below */
      }

      // Delivered only on an explicit acknowledgement: a 2xx without
      // `success: true` may be a WAF/captive-portal page, and trusting it
      // would delete a report the server never stored.
      if (res.ok && body?.success === true) {
        await store.remove(item.id);
        sent += 1;
        continue;
      }

      const serverError = typeof body?.error === 'string' && body.error ? body.error : null;
      const errorLabel = res.ok
        ? `Server did not acknowledge the report (${res.status})`
        : `Rejected (${res.status})`;

      // Only definitive rejections become permanent. Transient statuses —
      // 401/403/405/408/425/429 (WAF challenge, rate limit, LB error) —
      // must keep retrying: a permanent item is hidden from the pending
      // count and would silently strand the report.
      if (res.status >= 400 && res.status < 500 && PERMANENT_4XX.has(res.status)) {
        try {
          await store.put({
            ...attempt,
            status: 'failed',
            permanent: true,
            lastError: serverError || errorLabel,
          });
        } catch {
          /* bookkeeping must never reject the flush */
        }
        failed += 1;
        rejected += 1;
        continue;
      }

      // Anything else (5xx, retryable 4xx, unacknowledged 2xx): keep it
      // queued for the next pass.
      try {
        await store.put({
          ...attempt,
          status: 'queued',
          lastError: serverError || (res.ok ? errorLabel : `Server error (${res.status})`),
        });
      } catch {
        /* bookkeeping must never reject the flush */
      }
      failed += 1;
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === 'AbortError'
          ? `Timed out after ${Math.round(timeoutMs / 1000)}s`
          : err instanceof Error
            ? err.message
            : 'No connection';

      try {
        await store.put({ ...attempt, status: 'queued', lastError: message });
      } catch {
        /* bookkeeping must never reject the flush */
      }
      // There is no path to the server right now — stop and preserve battery.
      // (The caller's auto-retry loop re-arms and tries again.)
      break;
    } finally {
      clearTimeout(timer);
    }
  }

  let remaining: number;
  try {
    remaining = await pendingCount();
  } catch {
    // Honest fallback: never reject a flush whose deliveries already landed.
    remaining = Math.max(0, snapshot.length - sent);
  }
  return { sent, failed, remaining, rejected };
}

/** A queue flush is already running. */
export function isFlushing(): boolean {
  return flushing;
}

// ── Compact beacon for out-of-band handoff ───────────────────────────────────

/**
 * Shrink a report to a single SMS-sized line (GSM-7 limit is 160 chars).
 *
 * This is the real "no cell towers" escape hatch: the OS-level satellite SOS
 * and carrier satellite-messaging paths deliver short text messages, not HTTP.
 * The payload therefore has to fit in one segment with no dependency on the
 * app or its server being reachable.
 */
export function toSmsBeacon(payload: CreateIncidentPayload): string {
  const lat = payload.coordinates?.lat ?? 0;
  const lng = payload.coordinates?.lng ?? 0;
  const coords = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const urgency = (payload.urgency ?? 'HIGH').slice(0, 8);
  const type = String(payload.type ?? 'MEDICAL').slice(0, 8);

  let text = `AGAPAI SOS ${type}/${urgency} ${coords}`;
  const note = (payload.condition || payload.description || '').replace(/\s+/g, ' ').trim();
  if (note) {
    const budget = 160 - text.length - 2;
    if (budget > 4) text += ` ${note.slice(0, budget)}`;
  }
  return text.length <= 160 ? text : `${text.slice(0, 157)}...`;
}

/** `sms:` handoff the OS may route over satellite when there is no carrier. */
export function smsHref(payload: CreateIncidentPayload, number = ''): string {
  const body = encodeURIComponent(toSmsBeacon(payload));
  return number ? `sms:${number}?&body=${body}` : `sms:?&body=${body}`;
}

/** `tel:` fallback — a voice call is often the only thing that gets through. */
export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`;
}
