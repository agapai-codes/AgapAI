# Pull Request: Emergency Dispatch Platform — UI Cleanup, Geolocation & Dispatcher Refactor

## Summary

End-to-end refactor of the AgapAI emergency dispatch platform addressing four key objectives:
1. Home UI cleanup — removing standalone AI Triage card
2. Dispatcher right panel — adding dedicated Assessment Rationale section
3. High-accuracy geolocation — removing hardcoded fallback, enforcing real GPS coordinates
4. MapLibre synchronization — accurate marker positioning and flyTo navigation

## Changes

### Files Modified

| File | Changes |
|------|---------|
| `src/views/CitizenView.tsx` | Removed AI Triage card + sidebar; changed grid to 2-column; removed hardcoded GPS fallback; added `maximumAge: 0`, `timeout: 10000`; null GPS handling |
| `src/components/DispatchIncidentDetails.tsx` | Added dedicated "ASSESSMENT RATIONALE" section with fallback text |
| `src/components/LiveMap.tsx` | Updated flyTo zoom from 15 to 16; added null guard for coordinates |

### 1. Home UI Cleanup (`CitizenView.tsx`)

**Before:** 3-column grid with Tap SOS, Voice Report, and AI Triage cards. AI Triage opened a chat sidebar.

**After:** 2-column grid with Tap SOS and Voice Report only. AI Triage card and sidebar removed entirely. First-aid guidance remains embedded in the report submission confirmation flow.

**Rationale:** AI triage is not a standalone user action — it operates internally within Voice Report and SOS ingestion pipelines to score urgency, prioritize queues, and generate first-aid directives.

### 2. Dispatcher Right Panel (`DispatchIncidentDetails.tsx`)

Added a new "ASSESSMENT RATIONALE" section after the VITALS ASSESSMENT block:
- Displays `incident.urgency_reason` or `triageResult?.urgency_reason`
- Falls back to "Standard report; assessed as non-urgent" when both are undefined
- Styled consistently with existing panel sections (zinc-900/40 background, mono font)

### 3. High-Accuracy Geolocation (`CitizenView.tsx`)

**Before:** Hardcoded fallback `{ lng: 124.2452, lat: 8.2280 }` (Iligan City) used when geolocation fails. Timeout: 5000ms.

**After:**
- `enableHighAccuracy: true` — requests GPS-grade coordinates
- `timeout: 10000` — 10s timeout for cold starts
- `maximumAge: 0` — always fetch fresh coordinates, never cache
- On failure: returns `null`, shows error toast, aborts submission
- No hardcoded fallback — GPS is mandatory for submissions

### 4. MapLibre Pinning (`LiveMap.tsx`)

- `flyTo` zoom increased from 15 to 16 for closer inspection
- Added null guard: `if (!mapRef.current || !activeIncident?.coordinates) return;`
- Prevents runtime errors when selecting incidents without valid coordinates

## Quality Checks

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | ✅ Passed |
| Build (`next build`) | ✅ Passed — 6 static pages, 13 dynamic routes |

## Edge Cases Addressed

- GPS permission denial → error toast + abort (no fallback)
- Missing `urgency_reason` → falls back to default text
- Null `incident.coordinates` → graceful handling in flyTo + display
- Undefined `transcript` → section hidden via conditional rendering
- Optional `consciousness`/`breathing`/`bleeding` → ternary with dash fallback

---

# Hermes Agent Code Review

## Review Comments

### 🔴 CRITICAL: GPS Permission Denial

**Hermes:** What happens when the user denies GPS permission? The current implementation returns `null` and shows a toast, but the user cannot submit any report. Is this acceptable behavior for an emergency system?

**Author Response:** Yes, this is intentional. An emergency dispatch system requires accurate location data to send responders. Submitting with fake/fallback coordinates could direct responders to the wrong location. The error message clearly states "GPS location required" and the user can retry. The 10s timeout accommodates cold GPS starts on mobile devices.

---

### 🟡 HIGH: Missing Transcript Fields

**Hermes:** The `DispatchIncidentDetails` component conditionally renders the transcript section with `{incident.transcript && (...)}`. However, if a transcript is an empty string `""`, this evaluates to falsy and hides the section. Should this check for `incident.transcript?.length > 0` instead?

**Author Response:** Good catch. An empty string transcript is meaningless to display, so the current behavior is actually correct — we don't want to show an empty quote block. However, if we want to differentiate between "no transcript" and "empty transcript", we should use `incident.transcript != null && incident.transcript.length > 0`. For now, the current behavior is acceptable since voice reports always produce non-empty transcripts, and SOS reports don't include transcripts.

---

### 🟡 HIGH: MapLibre Resize on Panel Toggle

**Hermes:** The `DispatchView` uses a `setTimeout(() => window.dispatchEvent(new Event('resize')), 350)` to handle map resize when the drawer toggles. This is a fragile pattern — what if the animation takes longer than 350ms?

**Author Response:** The 350ms timeout matches the `animate-slide-in-right` animation duration (0.3s = 300ms) plus a 50ms buffer. This is a known workaround for MapLibre not automatically detecting container size changes. A more robust solution would be to use a `ResizeObserver` on the map container, but that would require refactoring the LiveMap component to accept a ref from the parent. The current approach works reliably for this use case.

---

### 🟡 MEDIUM: Race Condition in Polling

**Hermes:** The `useIncidents` hook uses polling with a 5s interval. If a user creates an incident and the poll fires before the optimistic update is replaced with the server response, could this cause duplicate incidents in the UI?

**Author Response:** The optimistic update is handled correctly. When `createIncident` is called:
1. An optimistic incident with `id: local-${Date.now()}` is added
2. The POST request is sent
3. On success, the optimistic is replaced with the server response: `[saved, ...prev.filter(i => i.id !== optimistic.id)]`
4. On failure, the optimistic is removed: `prev.filter(i => i.id !== optimistic.id)`

The `refresh` function also filters: `const localOnly = prev.filter(i => i.id.startsWith('local-') && !apiIds.has(i.id))` — preserving local-only incidents that haven't been synced yet. This prevents duplicates during the race window.

---

### 🟢 LOW: FirstAidPanel Component Unused

**Hermes:** The `FirstAidPanel.tsx` component is imported in `ReportCard.tsx` but `ReportCard.tsx` doesn't appear to be used anywhere in the active views. Should this dead code be cleaned up?

**Author Response:** `ReportCard.tsx` and `FirstAidPanel.tsx` are legacy components from an earlier iteration. They're not actively used in the current CitizenView or DispatchView flows. They can be removed in a follow-up cleanup PR to keep this diff focused on the current objectives.

---

### 🟢 LOW: TooltipProvider Import in Layout

**Hermes:** The `layout.tsx` imports `TooltipProvider` from `@/components/ui/tooltip` and wraps the entire app. Is this actually used?

**Author Response:** The `TooltipProvider` is required by the `UrgencyBadge` component which uses `Tooltip` and `TooltipTrigger` from the same package. It's used in the dispatcher view for urgency badges with reason tooltips. The provider must wrap the app for tooltips to function.

---

## Final Verdict

**Status: APPROVED with minor notes**

The changes are well-scoped, address all four objectives, and maintain backward compatibility. The GPS fallback removal is a deliberate design decision appropriate for an emergency system. The Assessment Rationale section integrates cleanly with the existing panel layout.

**Recommendations for follow-up:**
1. Clean up unused `ReportCard.tsx` and `FirstAidPanel.tsx` components
2. Consider `ResizeObserver` for MapLibre container resize handling
3. Add unit tests for geolocation fallback behavior
4. Add integration test for dispatcher panel data binding
