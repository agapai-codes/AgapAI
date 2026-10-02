'use client';

/**
 * Service worker registration + installability plumbing.
 *
 * Mounted once in the root layout. Kept deliberately inert during SSR and
 * outside development: registering a worker while `next dev` is rewriting
 * modules produces confusing stale-module bugs, and devs do not need an
 * install prompt.
 */

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaRuntime() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;

    // Register the worker at a stable, unhashed URL so the browser can byte-
    // compare it for updates. updateViaCache: 'none' stops the HTTP cache from
    // serving a stale worker forever.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch((err: unknown) => {
          // Not fatal — the app still works online without it.
          console.warn('[pwa] service worker registration failed', err);
        });
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || dismissed || !installEvent) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[70] sm:left-auto sm:max-w-xs">
      <div className="rounded-xl border border-white/10 bg-[#111114]/95 p-3 shadow-2xl backdrop-blur">
        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
          Install AgapAI
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
          Install for one-tap SOS and offline reports when there is no signal.
        </p>
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={async () => {
              await installEvent.prompt();
              await installEvent.userChoice;
              setInstallEvent(null);
            }}
            className="flex-1 rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-black transition hover:bg-neutral-200"
          >
            Install
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-neutral-400 transition hover:bg-white/5"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
