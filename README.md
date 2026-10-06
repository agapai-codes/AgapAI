# AgapAI — Emergency Response Command Center

AI-assisted emergency reporting and dispatch. Citizens report an emergency by
voice or one-tap SOS; the app triages it, and dispatchers and field responders
work the queue on a live command centre.

Built with Next.js 16 (App Router) · React 19 · Tailwind v4 · Neon Postgres · Gemini.  
**Live Production URL:** [https://agapai.joalvergs.tech/](https://agapai.joalvergs.tech/)

---

## 📄 Startup Proposal & Technopreneurship Deliverables

All academic, business, and competition deliverables are consolidated in [`docs/`](./docs/):

* **[Startup Proposal Final (DOCX)](./docs/Agap_AI_Startup_Proposal_Final.docx):** Canonical 15-section technopreneurship startup proposal.
* **[10-Minute Business Pitch Script](./docs/Agap_AI_10_Minute_Business_Pitch_Script.md) ([DOCX](./docs/Agap_AI_10_Minute_Business_Pitch_Script.docx)):** Complete spoken pitch walkthrough mapped across 8 core slides.
* **[Presentation Slide Deck (PPTX)](./docs/Agap_AI_Pitch_Deck.pptx) / [(PDF)](./docs/Agap_AI_Pitch_Deck.pdf):** Presentation slides for judges, evaluators, and academic panels.
* **[Live Demo Protocol (90s)](./docs/Agap_AI_Live_Demo_Guide.md):** Step-by-step verification script for `agapai.joalvergs.tech`.
* **[Academic Rubric Defense](./docs/Agap_AI_Technopreneurship_Academic_Review.md):** BCA172 rubric alignment matrix, defense Q&A, and BMC justifications.
* **[System Reliability & Edge Cases](./docs/Agap_AI_Reliability_and_Edge_Cases.md):** Engineering specs for offline idempotency, captive portals, indoor GPS degradation, and spam filtering.

---

## Why it's built around "no signal"

This is an emergency app, so it is designed for the moment the cell towers are
down. It is a full PWA, not just a site with a manifest:

| Layer | What it does |
| --- | --- |
| **Installable** | Web manifest + 192/512/maskable icons, installs to the home screen as a standalone app. |
| **Offline app shell** | `public/sw.js` precaches the core routes and serves them when the network is gone, with a dedicated `/offline` fallback page. |
| **Durable SOS queue** | Reports that cannot be transmitted are written to IndexedDB (`localStorage` fallback) and survive a reload or reboot. They flush automatically the moment a link returns. |
| **Zero-coverage extraction** | AI triage normally runs through `/api/extract`. With no network it falls back to the local keyword extractor in `src/lib/extractionFallback.ts`, so a report is *produced and queued* instead of failing. |
| **Honest connectivity** | `navigator.onLine` lies on phones, so `src/lib/connectivity.ts` actively probes `/api/health` and measures round-trip time. The UI shows `ONLINE` / `SATELLITE LINK` / `NO SIGNAL` based on evidence, and never claims a report was delivered when it was not. |
| **Satellite-sized beacon** | `toSmsBeacon()` shrinks a report to a single 160-character GSM-7 segment for out-of-band `sms:` / `tel:` handoff, which the OS may route over carrier or satellite messaging when the app's own server is unreachable. |

Storage is marked durable via `navigator.storage.persist()` so the browser
cannot silently evict a queued emergency report under storage pressure.

---

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Required environment variables (see `.env.local`):

```
DATABASE_URL=...        # Neon PostgreSQL
GEMINI_API_KEY=...      # optional — falls back to local keyword extraction
AUTH_SECRET=...         # session signing
```

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest suite |
| `npm run icons` | Regenerate the PWA icon set from `scripts/generate-icons.py` |
| `npm run db:migrate` | Apply the database migration |
| `npm run db:seed` | Seed demo auth users |

---

## Routes

| Route | Audience |
| --- | --- |
| `/` | Citizen — SOS beacon, voice report, first-aid guidance |
| `/dispatcher` | Dispatcher — 3-pane command centre (queue · map · incident detail), plus `/analytics` |
| `/responder` | Responder — assigned incidents and field close-out |

Demo dispatcher credentials: `dispatcher@agapai.ph` / `agapai123`.

---

## Project layout

```
src/
  app/           routes, API handlers, manifest, root layout
  views/         CitizenView · DispatchView · ResponderView
  components/    feature components (pwa/ = service worker + status banner)
  hooks/         data, auth, location, offline-queue and connection hooks
  lib/           auth, db, triage engine, connectivity, offline queue
  types/         shared incident / triage contracts
  utils/         coordinates, queue sorting, export
```

### Key pieces

- `src/lib/connectivity.ts` — link probing, backoff, satellite-like latency classification.
- `src/lib/offlineQueue.ts` — IndexedDB queue, flush logic, SMS beacon serializer.
- `src/components/pwa/PwaRuntime.tsx` — service worker registration + install prompt.
- `src/components/pwa/LinkStatusBanner.tsx` — global connectivity/queue status.
- `public/sw.js` — the service worker (cache rules are documented inline).

---

## Notes

- The service worker lives in `public/` rather than the bundle on purpose: it
  needs a stable, unhashed URL so the browser can byte-compare for updates, and
  a clean `/` scope. `next.config.ts` serves it with `no-cache` and
  `Service-Worker-Allowed: /`.
- `experimental.useOffline` is enabled, which gives Next-native connectivity
  detection plus automatic retry of blocked navigations and Server Actions, and
  exposes the `useOffline` hook behind `next/offline`.
- **This Next.js version has breaking changes.** Consult
  `node_modules/next/dist/docs/` before writing Next-specific code.
