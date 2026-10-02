import type { Metadata } from 'next';
import { SignalZero } from 'lucide-react';
import OfflineActions from '@/components/pwa/OfflineActions';

export const metadata: Metadata = {
  title: 'AgapAI — Offline',
  robots: { index: false },
};

/**
 * Offline fallback.
 *
 * Served by the service worker when a navigation is requested and there is no
 * network and no cached copy of that page. Deliberately static and dependency-
 * free: anything that needs the network would fail here too.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0A0A0D] px-6 py-12 text-center text-neutral-100">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
        <SignalZero size={26} className="text-red-400" aria-hidden />
      </div>

      <h1 className="mt-6 text-2xl font-bold tracking-tight">No connection</h1>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-400">
        AgapAI could not reach the network, and this page is not stored on your device yet.
      </p>

      <div className="mt-6 w-full max-w-md rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
          Your emergency reports are safe
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-300">
          Anything you send while offline is saved on this device and transmits automatically
          as soon as any signal appears — cell or satellite.
        </p>
      </div>

      <OfflineActions />

      <p className="mt-8 text-xs text-neutral-500">
        Without signal you can still dial your local emergency number directly.
      </p>
    </main>
  );
}
