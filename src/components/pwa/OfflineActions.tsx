'use client';

/**
 * Interactive buttons for the offline fallback page.
 *
 * Split out because the page itself is a Server Component (it exports
 * `metadata`, which client components may not), and Server Components cannot
 * receive event handlers.
 */

import Link from 'next/link';

export default function OfflineActions() {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200"
      >
        Try again
      </button>
      <Link
        href="/"
        className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-neutral-200 transition hover:bg-white/5"
      >
        Back to AgapAI
      </Link>
    </div>
  );
}
