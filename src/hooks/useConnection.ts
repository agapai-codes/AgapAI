'use client';

/**
 * Link state for the whole app.
 *
 * Combines Next's experimental `useOffline` (which also makes the framework
 * retry blocked navigations and Server Actions) with the active probe in
 * src/lib/connectivity.ts, because `useOffline`/`navigator.onLine` cannot tell
 * "no towers at all" apart from "a satellite link with a 600ms round trip".
 */

import { useEffect, useState } from 'react';
import { useOffline } from 'next/offline';
import {
  getLinkState,
  linkLabel,
  refreshLink,
  startLinkWatcher,
  subscribeLink,
  type LinkState,
} from '@/lib/connectivity';

export interface ConnectionView extends LinkState {
  /** Next's offline signal; authoritative for showing the offline banner. */
  offline: boolean;
  /** Shown on the connectivity chip. */
  label: string;
}

const initial: ConnectionView = {
  status: 'checking',
  rttMs: null,
  effectiveType: null,
  lastCheckedAt: null,
  satelliteLike: false,
  source: 'initial',
  offline: false,
  label: 'CHECKING',
};

export function useConnection(): ConnectionView {
  const offline = useOffline();
  const [link, setLink] = useState<LinkState>(getLinkState);

  useEffect(() => {
    const stop = startLinkWatcher();
    const unsubscribe = subscribeLink(setLink);
    return () => {
      unsubscribe();
      stop();
    };
  }, []);

  const effectiveOffline = offline || link.status === 'offline';

  return {
    ...link,
    // `offline` wins: if Next says a request failed or the browser fired an
    // offline event, do not show a green chip just because an earlier probe passed.
    status: effectiveOffline ? 'offline' : link.status,
    offline: effectiveOffline,
    label: effectiveOffline ? 'NO SIGNAL' : linkLabel(link),
  };
}

/** Manually re-probe the link (used by "Try now" buttons). */
export function useRefreshLink(): () => void {
  return () => void refreshLink('probe');
}
