# Agap AI Live Demo Guide & Verification Protocol
**Target URL:** https://agapai.joalvergs.tech/  
**Course:** BCA172 – Technopreneurship / IEEE SumpAI 2026 MSU-IIT  
**Core Objective:** Demonstrate a complete end-to-end emergency intake, AI extraction, and triage routing loop in 90–120 seconds.

---

## 1. Verified Live System Endpoints
| URL Route | Interface Name | Purpose | Target User |
|---|---|---|---|
| `https://agapai.joalvergs.tech/` | **Client SOS & Voice Intake** | Citizen emergency reporting interface with high-contrast tactile SOS button, voice recorder, and offline queue. | Panicked citizen / student |
| `https://agapai.joalvergs.tech/dispatcher` | **Command Center Dispatcher** | Real-time incident triage board with streaming incoming reports, severity filters, map pins, and responder assignment. | Campus security / 911 dispatcher |
| `https://agapai.joalvergs.tech/responder` | **Field Responder View** | Mobile-friendly field triage view for on-ground units to accept tasks, view GPS location, and update status. | Ambulance / campus medic / security |
| `https://agapai.joalvergs.tech/analytics` | **Executive Analytics & Heatmap** | Institutional dashboard showing incident volume, average response times, incident distribution, and hotspots. | University administration / LGU disaster head |

---

## 2. 90-Second Live Demo Walkthrough Script (Presentation Mode)

### Equipment Setup Before the Pitch
- **Screen 1 (Laptop/Projector):** Split screen with `/dispatcher` on the right and `/` (or mobile phone mirrored via scrcpy/browser device view) on the left.
- **Microphone:** Ready for clear audio intake or prepared with the exact scenario text.

---

### Step-by-Step Demo Flow

#### Stage 1: The Panic Trigger (0:00 – 0:30)
1. **Show the Client Screen (`/`):**
   * Point out the interface: *"Notice the interface has zero clutter. A single high-contrast SOS button with sonar pulsing, and a prominent 'Describe it by voice' trigger."*
2. **Trigger Voice Intake:**
   * Tap the microphone button or click **"Describe it by voice"**.
   * Speak clearly (Section 6 proposal scenario):  
     > *"Agap, my friend fell from the second floor. He is unconscious and bleeding from his head. We are inside the engineering building."*
   * Alternatively, use **"Run a practice report"** if testing without audio permissions.

#### Stage 2: Instant Extraction & Local Resilience (0:30 – 0:50)
1. **Observe Client-Side Feedback:**
   * The app captures GPS coordinates automatically.
   * If network blinks off, notice the offline badge — the incident is safely queued locally in IndexedDB and syncs instantly upon reconnection.

#### Stage 3: The Command Center Reaction (`/dispatcher`) (0:50 – 1:20)
1. **Switch focus to the Dispatcher Dashboard:**
   * An urgent alert rings as the incident appears in real-time via Server-Sent Events (SSE).
2. **Highlight the AI Extraction Card:**
   * Show that the raw panicked audio was transformed into structured parameters:
     - **Incident Category:** Fall from Height
     - **Severity:** Critical (Red badge)
     - **Condition:** Unconscious / Head trauma
     - **Victims:** 1
     - **Location:** MSU-IIT Engineering Building, 2nd Floor (+ Coordinates)
     - **Assistance Required:** Emergency Medical Services (EMS)
3. **Dispatch Action:**
   * Click **"Assign Responder"** to demonstrate closing the operational loop.

#### Stage 4: Institutional Value (`/analytics`) (1:20 – 1:30)
1. **Briefly show `/analytics`:**
   * *"For university leadership and LGUs, Agap AI aggregates these emergencies into response-time metrics and incident heatmaps, justifying safety investments and resource allocation."*

---

## 3. Demo Fallback & Safety Checklist
- [ ] If browser denies microphone permissions, click **"Run a practice report"** directly on `/`.
- [ ] If university Wi-Fi drops, showcase the **Offline-First PWA banner**: Agap queues the report locally and transmits as soon as connectivity resumes.
- [ ] Reset demo state before presenting: visit `/api/incidents/reset` or clear browser storage to start with a clean board.
