'use client';

/**
 * Connectivity + queue status banner.
 *
 * Shown on every route from the root layout. Its job is honesty: never let a
 * citizen believe a report was transmitted when there is no coverage. When the
 * link is down it says so, shows how many reports are still waiting, and offers
 * the out-of-band fallbacks (SMS / voice) that work without the app's server.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Radio, Satellite, Signal, SignalZero } from 'lucide-react';
import { useConnection } from '@/hooks/useConnection';
import { useSosQueue } from '@/hooks/useSosQueue';
import { telHref } from '@/lib/offlineQueue';

const EMERGENCY_NUMBER = '911';

export default function LinkStatusBanner() {
  const link = useConnection();
  const queue = useSosQueue(link.offline);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Avoid a hydration flash on first paint.
    setVisible(true);
  }, []);

  if (!visible) return null;

  const { offline, label, rttMs, satelliteLike } = link;
  const pending = queue.pending;
  const rejected = queue.items.filter((item) => item.permanent).length;

  // Fully online with nothing outstanding: stay out of the way.
  if (!offline && !satelliteLike && pending === 0 && rejected === 0) return null;

  const tone = offline
    ? 'border-red-500/40 bg-red-950/70 text-red-100'
    : satelliteLike
      ? 'border-amber-500/40 bg-amber-950/70 text-amber-100'
      : 'border-sky-500/40 bg-sky-950/70 text-sky-100';

  const Icon = offline ? SignalZero : satelliteLike ? Satellite : Signal;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="link-status-banner"
      className={`border-b px-3 py-2 text-[11px] sm:px-4 ${tone}`}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider">
          {queue.flushing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Icon size={13} />
          )}
          {offline ? 'No signal' : satelliteLike ? 'Satellite link' : label}
          {!offline && rttMs != null && (
            <span className="font-normal opacity-70">· {rttMs}ms</span>
          )}
        </span>

        {pending > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-2 py-0.5 font-semibold">
            <Radio size={11} />
            {pending} report{pending === 1 ? '' : 's'} waiting
          </span>
        )}

        {rejected > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/70 px-2 py-0.5 font-semibold">
            <AlertTriangle size={11} />
            {rejected} rejected
          </span>
        )}

        <span className="min-w-0 flex-1 opacity-80">
          {offline
            ? 'Reports are saved on this device and will send automatically when signal returns.'
            : satelliteLike
              ? 'Link is slow — reports are still sending, keep this screen open.'
              : pending > 0
                ? `${pending} queued — sends when a link is confirmed.`
                : 'A rejected report needs attention — it will not retry on its own.'}
        </span>

        <span className="flex items-center gap-1.5">
          {pending > 0 && !queue.flushing && (
            <button
              type="button"
              onClick={() => void queue.flush()}
              className="rounded-md border border-white/20 bg-white/10 px-2 py-1 font-bold uppercase tracking-wide transition hover:bg-white/20"
            >
              Send now
            </button>
          )}
          {offline && (
            <>
              <a
                href={`sms:?&body=${encodeURIComponent('AGAPAI SOS')}`}
                className="rounded-md border border-white/20 bg-white/10 px-2 py-1 font-bold uppercase tracking-wide transition hover:bg-white/20"
                title="Send a short text instead — the OS may route it over satellite"
              >
                SMS
              </a>
              <a
                href={telHref(EMERGENCY_NUMBER)}
                className="inline-flex items-center gap-1 rounded-md border border-red-300/40 bg-red-600/80 px-2 py-1 font-bold uppercase tracking-wide text-white transition hover:bg-red-600"
              >
                <AlertTriangle size={11} /> Call
              </a>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
