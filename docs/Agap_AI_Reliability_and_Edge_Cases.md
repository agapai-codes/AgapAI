# Agap AI: System Reliability, Edge Cases & Failure Recovery Specification
**Project:** Agap AI — Emergency Response Command Center  
**Course:** BCA172 – Technopreneurship  
**Context:** Technical Defense Specification & Industrial Verification

---

## 1. Offline Queueing, Concurrency & Idempotency Engine

In high-stakes emergency situations, connectivity failures are the norm rather than the exception. Agap AI implements a battle-tested offline-first synchronization protocol:

### A. Dual Storage Engine with Graceful Degradation
* **Primary Store:** Browser `IndexedDB` (`agapai-sos` database, `queue` object store) ensuring reports persist across tab closures, low-memory browser kills, and device reboots.
* **Secondary Fallback:** `localStorage` with automated migration when IndexedDB is blocked (e.g., Safari private browsing, strict enterprise profiles, or quota exceptions).

### B. Concurrency & Replay Protection (Idempotency)
When connectivity drops or stutters during an active HTTP transaction:
1. **Client Reference Identifier (`client_ref`):** Every report generated on the client receives an immutable UUID (`client_ref`) before storage or transmission.
2. **Server-Side Deduplication:** The backend (`/api/incidents`) inspects incoming payloads for `client_ref`. If network timeout occurred after the server successfully wrote the record, any subsequent queue flush replay returns:
   ```json
   { "success": true, "data": existingRecord, "duplicate": true }
   ```
   This acknowledges the transaction to the client queue without creating phantom incidents on the dispatcher screen.
3. **Captive Portal & Fake 200 Rejection:** Many public/university Wi-Fi networks return HTTP 200 HTML login pages when internet access is expired. Agap AI's flush engine validates that the response contains valid JSON with an explicit `success: true` flag. Any HTML payload or non-JSON 200 leaves the emergency item in the queue for genuine retry.

---

## 2. GPS Degradation & Indoor Location Fallback Protocol

A major vulnerability of consumer emergency apps is total reliance on raw GPS satellites, which fail inside reinforced concrete buildings (such as campus laboratories and engineering buildings).

### Multi-Tier Location Resolution:
1. **Tier 1 — High-Accuracy Hardware GNSS:** Requests `enableHighAccuracy: true` via Geolocation API, reporting accuracy radius in meters (`coords.accuracy`).
2. **Tier 2 — NLP Spatial Landmark Extraction:**  
   If GPS satellite fix is weak or degraded (>50m uncertainty), Agap AI's NLP extraction engine parses spatial landmarks directly from the spoken voice transcript:
   * Example: *"2nd floor, room 204, MSU-IIT Engineering Building"*
   * The landmark text is elevated to primary routing metadata alongside the approximate cell-tower/Wi-Fi coordinate.
3. **Tier 3 — Dispatcher Visual Confidence Tagging:**  
   On the `/dispatcher` command center, coordinates are color-coded based on confidence score:
   * **Green (≥90%):** Pinpoint GNSS fix (<15m radius).
   * **Amber (70–89%):** Approximate cell/Wi-Fi fix; landmark verification recommended.
   * **Red (<70%):** Degraded fix; dispatcher relies on the extracted spoken description.

---

## 3. Spam, Prank Calls & Malicious Report Filtering

Open emergency reporting systems face the danger of prank calls, denial-of-service spam, and resource exhaustion. Agap AI mitigates this through a four-tiered defense:

1. **Deterministic Schema Gatekeeper:**  
   Reports must meet strict syntactic criteria: valid incident type, non-empty location or landmark, and finite geographic bounds within the municipal service boundary (Region X / Iligan City).
2. **Client Fingerprinting & Rate Limiting:**  
   Requests are throttled per IP and client session token (`/api/incidents` and `/api/extract`). Spammed identical triggers from the same device within a 60-second window are consolidated under the existing incident timeline.
3. **Audio Sanity & Speech Verification:**  
   Voice extraction rejects silent audio files, synthetic repetition, or transcripts lacking actionable emergency criteria. Reports failing minimum triage thresholds are routed to a **Low-Urgency / Verification Queue** rather than triggering an active field alarm.
4. **Human Dispatcher Operational Authority:**  
   The AI classifies and highlights, but human dispatchers retain exclusive authority to dispatch field units or mark incidents as `False Report` / `Resolved`.

---

## 4. Real-Time Dispatch Stream Resilience (SSE & WebSockets)

The Command Center (`/dispatcher`) depends on live event feeds via Server-Sent Events (`/api/incidents/stream`):

1. **Heartbeat & Zombie Connection Cleanup:**  
   The stream issues periodic ping events every 15 seconds to prevent NAT timeouts and proxies from prematurely terminating silent connections.
2. **Exponential Backoff with Jitter:**  
   If the SSE link drops, client connection listeners execute reconnection with randomized jitter (preventing thundering herd on server recovery).
3. **Reconciliation on Reconnect:**  
   Upon reconnection, the dispatcher client automatically triggers a one-shot `GET /api/incidents` delta fetch to synchronize any incidents generated during the link drop.
