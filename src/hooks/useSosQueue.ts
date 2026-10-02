'use client';

/**
 * React binding for the offline SOS queue.
 *
 * Keeps the queued-report count in sync across components, flushes
 * automatically when the link comes back, and backs off while there is still
 * no coverage so a phone with no signal does not spend its battery probing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearQueue,
  flushQueue,
  listAll,
  listQueued,
  pendingCount,
  removeReport,
  subscribeQueue,
  type FlushResult,
  type QueuedReport,
} from '@/lib/offlineQueue';
import type { CreateIncidentPayload } from '@/types/incident';

const RETRY_WHEN_ONLINE_MS = 5_000;
const RETRY_WHILE_WAITING_MS = 30_000;

export interface SosQueue {
  /** Reports waiting for a link (excludes permanently rejected ones). */
  pending: number;
  /** Everything in storage, including items that need manual attention. */
  items: QueuedReport[];
  flushing: boolean;
  lastFlush: FlushResult | null;
  enqueue: (payload: CreateIncidentPayload) => Promise<void>;
  flush: () => Promise<FlushResult>;
  discard: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

export function useSosQueue(linkOffline: boolean): SosQueue {
  const [pending, setPending] = useState(0);
  const [items, setItems] = useState<QueuedReport[]>([]);
  const [flushing, setFlushing] = useState(false);
  const [lastFlush, setLastFlush] = useState<FlushResult | null>(null);
  const offlineRef = useRef(linkOffline);
  offlineRef.current = linkOffline;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    setPending(await pendingCount());
    setItems(await listAll());
  }, []);

  const flush = useCallback(async (): Promise<FlushResult> => {
    setFlushing(true);
    try {
      // flushQueue probes the link itself and stops at the first network-level
      // failure, so a dead link costs one timeout — not one per report.
      const result = await flushQueue();
      setLastFlush(result);
      await refresh();
      return result;
    } finally {
      setFlushing(false);
    }
  }, [refresh]);

  // Watch storage changes from anywhere in the app.
  useEffect(() => {
    void refresh();
    return subscribeQueue(() => void refresh());
  }, [refresh]);

  // Flush when the link returns, then keep trying while anything is pending.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (pending === 0) return;

    // Arm one tick of the retry loop. The callback re-arms itself after every
    // attempt — including runs that made zero progress (5xx, timeout, or the
    // break-on-network-failure), whose deps never change and would otherwise
    // leave the timer dead while the UI still promises auto-transmission.
    let alive = true;
    const schedule = () => {
      if (!alive) return;
      const delay = linkOffline ? RETRY_WHILE_WAITING_MS : RETRY_WHEN_ONLINE_MS;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void (async () => {
          try {
            if (offlineRef.current) await refresh();
            else await flush();
          } catch {
            /* a failed attempt must not kill the retry loop */
          } finally {
            // Unconditional re-arm while this effect is still alive.
            schedule();
          }
        })();
      }, delay);
    };

    schedule();

    return () => {
      alive = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pending, linkOffline, flush, refresh]);

  // Immediate flush on the browser's own online event.
  useEffect(() => {
    const onOnline = () => {
      if (!offlineRef.current) void flush();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flush]);

  const enqueue = useCallback(
    async (payload: CreateIncidentPayload) => {
      const { enqueue: push } = await import('@/lib/offlineQueue');
      await push(payload);
      await refresh();
    },
    [refresh]
  );

  const discard = useCallback(
    async (id: string) => {
      await removeReport(id);
      await refresh();
    },
    [refresh]
  );

  const clear = useCallback(async () => {
    await clearQueue();
    await refresh();
  }, [refresh]);

  return { pending, items, flushing, lastFlush, enqueue, flush, discard, clear };
}

/** Convenience for badges: how many reports are still waiting to go out. */
export async function getSosPending(): Promise<number> {
  return listQueued().then((rows) => rows.length);
}
