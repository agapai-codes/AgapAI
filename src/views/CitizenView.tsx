'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Toaster, toast } from 'sonner';
import { Mic, RotateCcw, ChevronRight, X, Send, CheckCircle2, MapPin, Satellite, TriangleAlert } from 'lucide-react';
import { useIncidents } from '../hooks/useIncidents';
import { extractEmergencyInfo } from '../lib/gemini';
import { getFirstAid, type FirstAidProtocol } from '../lib/firstAid';
import { useAuth } from '../hooks/useAuth';
import { getRealCoordinates, getRandomPHCoords } from '../utils/geolocation';
import { resolveIncidentCoords, isValidPHCoords, sanitizeCoords } from '../utils/coordinates';
import VoiceRecorder from '../components/VoiceRecorder';
import { isDemo, APP_MODE } from '../lib/config';
import { extractFallback } from '../lib/extractionFallback';
import { useConnection } from '../hooks/useConnection';
import { useSosQueue } from '../hooks/useSosQueue';
import { smsHref, type FlushResult } from '@/lib/offlineQueue';
import type { CreateIncidentPayload, IncidentType, UrgencyLevel } from '../types/incident';

interface Submission {
  incident_type: string;
  condition: string;
  location_description: string;
  people_affected: number;
  urgency: UrgencyLevel;
  urgency_reason: string;
  hazards: string[];
  gps?: { lng: number; lat: number };
}

type ExtractionStepKey = 'capturing-location' | 'analyzing-transcript' | 'creating-report';
type ExtractionStep = ExtractionStepKey | null;

function toIncidentType(value: string): IncidentType {
  const upper = value.toUpperCase();
  const valid: IncidentType[] = ['FIRE', 'ACCIDENT', 'MEDICAL', 'VIOLENCE', 'NATURAL_DISASTER'];
  if (valid.includes(upper as IncidentType)) return upper as IncidentType;
  return 'MEDICAL';
}

/**
 * Single source of truth for urgency colour on the citizen side.
 * Mirrors the dispatch palette: red → amber → emerald.
 */
const URGENCY_INK: Record<string, string> = {
  high: 'var(--critical)',
  medium: 'var(--warning)',
  low: 'var(--success)',
};

const urgencyColor = (u: string) => URGENCY_INK[u] ?? URGENCY_INK.medium;

/** Counts from the most recent queue flush, used for honest panel copy. */
type FlushTally = { sent: number; failed: number; remaining: number; rejected: number };

/** `FlushResult` may gain an optional `rejected` field — read it defensively. */
const tallyOf = (r: FlushResult): FlushTally => ({
  sent: r.sent,
  failed: r.failed,
  remaining: r.remaining,
  rejected: (r as FlushResult & { rejected?: number }).rejected ?? 0,
});

/** One honest badge: what the link is doing right now. Never hard-coded. */
function LinkBadge({
  offline, satelliteLike, pending, compact,
}: { offline: boolean; satelliteLike: boolean; pending: number; compact?: boolean }) {
  const tone = offline ? 'chip-critical' : satelliteLike ? 'chip-warning' : 'chip-success';
  const label = offline ? 'No signal' : satelliteLike ? 'Satellite link' : 'Online';
  return (
    <div className="flex items-center gap-2">
      <span className={`chip ${tone}`} role="status" aria-live="polite">
        <span className={`status-dot ${offline ? 'status-dot-off' : satelliteLike ? 'status-dot-warn' : 'status-dot-ok live-dot'}`} />
        {label}
      </span>
      {pending > 0 && (
        <span className="chip chip-warning mono tracking-normal">
          {pending} queued
        </span>
      )}
      {!compact && offline && (
        <span className="hidden sm:inline text-2xs text-ink-3">
          Reports stay on this device until signal returns
        </span>
      )}
    </div>
  );
}

export default function CitizenView() {
  const { createIncident } = useIncidents();
  const { user } = useAuth();
  const link = useConnection();
  const queue = useSosQueue(link.offline);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractionStep, setExtractionStep] = useState<ExtractionStep>(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  /** True when the last report could not be transmitted and is stored locally. */
  const [reportQueued, setReportQueued] = useState(false);
  /** Tally of the newest flush while a report is queued — the panel's honest delivery state. */
  const [flushTally, setFlushTally] = useState<FlushTally | null>(null);
  /** Last `queue.lastFlush` object adopted, so a new report never inherits a stale tally. */
  const seenFlushRef = useRef<FlushResult | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [firstAidProtocol, setFirstAidProtocol] = useState<FirstAidProtocol | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date().toLocaleTimeString());
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Adopt every flush outcome — manual or automatic — while a report is
  // queued, so the panel never keeps claiming "will transmit by itself"
  // after the queue has already delivered (or permanently rejected) it.
  useEffect(() => {
    const last = queue.lastFlush;
    if (!last || last === seenFlushRef.current) return;
    seenFlushRef.current = last;
    if (reportQueued) setFlushTally(tallyOf(last));
  }, [queue.lastFlush, reportQueued]);

  const acquireGPS = useCallback((): Promise<{ lng: number; lat: number }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const fallback = getRandomPHCoords();
        setGpsCoords(fallback);
        setGpsStatus('error');
        resolve(fallback);
        return;
      }
      setGpsStatus('loading');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          let lng = pos.coords.longitude;
          let lat = pos.coords.latitude;
          // Guard against inversion: if coords look like [lat, lng], swap them
          if (lat >= 116 && lat <= 128 && lng >= 4 && lng <= 22) {
            [lng, lat] = [lat, lng];
          }
          // Validate within Philippines bounds
          if (!isValidPHCoords(lng, lat)) {
            const fallback = getRandomPHCoords();
            setGpsCoords(fallback);
            setGpsStatus('error');
            resolve(fallback);
            return;
          }
          const coords = { lng, lat };
          setGpsCoords(coords);
          setGpsStatus('ready');
          resolve(coords);
        },
        () => {
          const fallback = getRandomPHCoords();
          setGpsCoords(fallback);
          setGpsStatus('error');
          resolve(fallback);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  /**
   * Store the report for automatic retry — but if the storage write itself
   * fails (quota, blocked storage) the report exists nowhere on the device.
   * In that case hand the payload to the OS messaging path as the escape
   * hatch. Returns true only when the report is safely queued.
   */
  const enqueueWithSmsFallback = useCallback(
    async (payload: CreateIncidentPayload, failureMessage: string): Promise<boolean> => {
      try {
        await queue.enqueue(payload);
        return true;
      } catch (err) {
        console.error('Queue storage failed:', err);
        toast.error(failureMessage, {
          action: {
            label: 'Send as SMS instead',
            onClick: () => {
              window.location.href = smsHref(payload);
            },
          },
        });
        return false;
      }
    },
    [queue]
  );

  const handleSOS = useCallback(async () => {
    try {
      const coords = await acquireGPS();
      const payload: CreateIncidentPayload = {
        type: 'MEDICAL',
        location: 'Current Location (GPS)',
        description: 'Emergency beacon activated',
        reporter: user?.name || user?.email || 'System (SOS)',
        reporter_email: user?.email,
        coordinates: coords,
        urgency: 'HIGH',
        urgency_reason: 'One-tap SOS activated',
      };

      // No coverage at all: do not attempt a request that can only time out.
      // Store the beacon so it transmits the instant a link appears.
      if (link.offline) {
        const saved = await enqueueWithSmsFallback(
          payload,
          'No signal — and the beacon could not be saved on this device.'
        );
        if (saved) {
          toast.warning('No signal — beacon saved on this device and will send automatically.');
        }
        return;
      }

      const result = await createIncident(payload);
      if (result) {
        toast.success('Emergency beacon activated');
        return;
      }

      // Looked online but the send failed (weak/satellite link, server down).
      const saved = await enqueueWithSmsFallback(
        payload,
        'Could not reach dispatch — and the beacon could not be saved on this device.'
      );
      if (saved) {
        toast.warning('Could not reach dispatch — beacon queued and will retry.');
      }
    } catch (err) {
      console.error('SOS failed:', err);
      toast.error('Emergency beacon failed. Check your connection.');
    }
  }, [acquireGPS, createIncident, user, link.offline, enqueueWithSmsFallback]);

  const processText = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setShowVoiceModal(false);
    setIsRecording(false);

    setExtractionStep('capturing-location');
    const coords = gpsCoords || await acquireGPS();

    setExtractionStep('analyzing-transcript');
    try {
      // AI extraction needs the network. With no coverage — or if the AI call
      // fails for any reason — fall back to the local keyword extractor so a
      // report is still produced and queued instead of being lost.
      type Extracted =
        | Awaited<ReturnType<typeof extractEmergencyInfo>>
        | ReturnType<typeof extractFallback>;

      let extracted: Extracted;
      if (link.offline) {
        extracted = extractFallback(text);
      } else {
        try {
          extracted = await extractEmergencyInfo(text);
        } catch (aiErr) {
          console.warn('[citizen] AI extraction unavailable, using local fallback', aiErr);
          extracted = extractFallback(text);
        }
      }

      if (!extracted) {
        throw new Error('Failed to extract emergency information');
      }
      const sub: Submission = {
        incident_type: extracted.incident_type,
        condition: extracted.condition,
        location_description: extracted.location_description,
        people_affected: extracted.people_affected,
        urgency: extracted.urgency as UrgencyLevel,
        urgency_reason: extracted.urgency_reason,
        hazards: extracted.hazards || [],
        gps: coords,
      };
      setSubmission(sub);
      const conditionText = (sub.condition || sub.incident_type || 'general emergency').trim();
      setFirstAidProtocol(getFirstAid(conditionText));

      // One payload object shared by the live send and the offline queue, so a
      // queued report is identical to one transmitted immediately.
      const payload: CreateIncidentPayload = {
        type: toIncidentType(extracted.incident_type),
        location: extracted.location_description || 'Iligan City, Philippines',
        description: extracted.condition || text,
        reporter: user?.name || user?.email || 'Citizen',
        reporter_email: user?.email,
        coordinates: coords,
        urgency: extracted.urgency as UrgencyLevel,
        urgency_reason: extracted.urgency_reason,
        people_affected: extracted.people_affected,
        condition: extracted.condition,
        hazards: extracted.hazards,
        transcript: text,
        confidence: extracted.confidence,
        consciousness: extracted.consciousness ?? undefined,
        breathing: extracted.breathing ?? undefined,
        bleeding: extracted.bleeding ?? undefined,
      };

      setExtractionStep('creating-report');
      // Skip the request entirely when there is provably no link — it would
      // only hang until timeout before failing.
      const saved = link.offline ? null : await createIncident(payload);

      if (saved) {
        setReportQueued(false);
        setReportSubmitted(true);
        toast.success('Report submitted');
      } else {
        const queued = await enqueueWithSmsFallback(
          payload,
          'No connection — and the report could not be saved on this device.'
        );
        if (queued) {
          setFlushTally(null);
          seenFlushRef.current = queue.lastFlush;
          setReportQueued(true);
          setReportSubmitted(true);
          toast.warning('No connection — report saved on this device and will send automatically.');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to process report. Please try again.');
    } finally {
      setIsProcessing(false);
      setExtractionStep(null);
    }
  }, [gpsCoords, acquireGPS, createIncident, user, link.offline, enqueueWithSmsFallback, queue.lastFlush]);

  const handleVoiceSubmit = useCallback(() => processText(transcript), [transcript, processText]);

  /**
   * Manual flush: consume the FlushResult so the panel and the toasts tell
   * the truth — delivered, still waiting, or permanently rejected.
   */
  const handleTrySend = useCallback(async () => {
    try {
      const r = await queue.flush();
      const rejected = (r as FlushResult & { rejected?: number }).rejected ?? 0;
      if (r.sent > 0) {
        toast.success(
          r.remaining > 0
            ? `${r.sent} report${r.sent === 1 ? '' : 's'} sent · ${r.remaining} still queued`
            : `${r.sent} report${r.sent === 1 ? '' : 's'} sent`
        );
      } else if (rejected > 0) {
        toast.error(
          `${rejected} report${rejected === 1 ? '' : 's'} rejected — needs attention and will not retry on its own.`
        );
      } else if (r.remaining > 0) {
        toast.warning('Still no link — saved on this device and will retry automatically.');
      } else {
        toast.info('Nothing left to send.');
      }
    } catch (err) {
      console.error('Queue flush failed:', err);
      toast.error('Could not reach dispatch to check the queue — try again.');
    }
  }, [queue]);

  const handleToggleRecording = useCallback(async () => {
    if (!isRecording) {
      const coords = await acquireGPS();
      if (!coords) {
        toast.error('GPS required to start recording');
        return;
      }
    }
    setIsRecording(prev => !prev);
  }, [isRecording, acquireGPS]);

  const handleVoiceModalClose = useCallback(() => {
    setShowVoiceModal(false);
    setIsRecording(false);
  }, []);

  const handleTryDemo = () => {
    setTranscript('My friend fell from the stairs. He is unconscious and bleeding from his head. We are inside the engineering building, third floor.');
    setReportSubmitted(false);
  };

  const handleReset = () => {
    setTranscript('');
    setInterimTranscript('');
    setReportSubmitted(false);
    setReportQueued(false);
    setFlushTally(null);
    setSubmission(null);
    setFirstAidProtocol(null);
    setIsRecording(false);
    setExtractionStep(null);
    setGpsCoords(null);
    setGpsStatus('idle');
  };

  const extractionStepLabel: Record<ExtractionStepKey, string> = {
    'capturing-location': 'Capturing location…',
    'analyzing-transcript': 'Reading the report…',
    'creating-report': 'Filing the report…',
  };

  // ─── SHARED HEADER ────────────────────────────────────────────────
  const header = (
    <header className="chrome sticky top-0 z-30 h-14 shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6">
      <div className="flex items-center gap-2.5 min-w-0">
        <Image src="/logo.jpg" alt="" width={24} height={24} className="rounded-md shrink-0" />
        <span className="font-extrabold text-sm tracking-wider uppercase">
          Agap<span className="text-[var(--critical)]">AI</span>
        </span>
        <span className={`chip ${isDemo ? 'chip-neutral' : 'chip-success'}`}>
          {APP_MODE}
        </span>
      </div>
      <div className="flex items-center gap-3 min-w-0">
        <LinkBadge
          offline={link.offline}
          satelliteLike={link.satelliteLike}
          pending={queue.pending}
          compact
        />
        {mounted && <span className="mono text-xs text-ink-3 hidden sm:block">{currentTime}</span>}
      </div>
    </header>
  );

  // ─── REPORT SUBMITTED VIEW ────────────────────────────────────────
  if (reportSubmitted && submission) {
    const summary: { l: string; v: string; ink?: string }[] = [
      { l: 'Type', v: submission.incident_type.replace('_', ' ') },
      { l: 'Urgency', v: submission.urgency, ink: urgencyColor(submission.urgency.toLowerCase()) },
      { l: 'Condition', v: submission.condition },
      { l: 'People', v: String(submission.people_affected) },
      { l: 'Location', v: submission.location_description },
      { l: 'GPS', v: submission.gps ? `${submission.gps.lat.toFixed(4)}, ${submission.gps.lng.toFixed(4)}` : 'Unavailable' },
    ];

    // Honest outcome of THIS report: delivered, still on this device, or
    // permanently rejected by the server (it will never retry on its own).
    const rejectedItems = queue.items.filter((item) => item.permanent);
    const outcome: 'sent' | 'queued' | 'rejected' = !reportQueued
      ? 'sent'
      : queue.pending > 0
        ? 'queued'
        : rejectedItems.length > 0
          ? 'rejected'
          : 'sent';

    return (
      <div className="min-h-dvh bg-surface-0 text-ink-1 flex flex-col">
        <Toaster position="top-center" theme="dark" />
        {header}

        <main className="flex-1 w-full max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {/* ── Outcome ── */}
          <section className="text-center mb-8" role="status" aria-live="polite">
            <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${
              outcome === 'sent'
                ? 'bg-[color-mix(in_srgb,var(--success)_14%,transparent)]'
                : outcome === 'rejected'
                  ? 'bg-[color-mix(in_srgb,var(--critical)_14%,transparent)]'
                  : 'bg-[color-mix(in_srgb,var(--warning)_14%,transparent)]'
            }`}>
              {outcome === 'sent'
                ? <CheckCircle2 size={30} className="text-[var(--success)]" aria-hidden />
                : outcome === 'rejected'
                  ? <TriangleAlert size={30} className="text-[var(--critical)]" aria-hidden />
                  : <Satellite size={30} className="text-[var(--warning)]" aria-hidden />}
            </div>

            <h1 className="text-2xl font-bold tracking-tight">
              {outcome === 'sent'
                ? 'Report submitted'
                : outcome === 'rejected'
                  ? 'Report needs attention'
                  : 'Report saved on this device'}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              {outcome === 'sent'
                ? 'Dispatch has been notified. Keep this screen open in case they call back.'
                : outcome === 'rejected'
                  ? 'The server rejected this report, so it will not retry on its own. Send it as SMS below or file a new report.'
                  : 'There is no signal right now. The report will transmit by itself the moment a link comes back — you can also push it manually below.'}
            </p>

            {outcome !== 'sent' && (
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={handleTrySend}
                  disabled={queue.flushing}
                  className="btn btn-warning"
                >
                  {queue.flushing ? 'Sending…' : 'Try sending now'}
                </button>
                <a
                  href={`sms:?&body=${encodeURIComponent('AGAPAI SOS')}`}
                  className="btn btn-outline"
                >
                  Send as SMS
                </a>
              </div>
            )}

            {reportQueued && queue.flushing && (
              <p className="mono mt-3 text-xs text-ink-3">Retrying — do not close this tab</p>
            )}

            {/* What the last flush actually did — never claim delivery that did not happen. */}
            {reportQueued && flushTally && !queue.flushing && (
              <p className={`mono mt-3 text-xs ${
                flushTally.sent > 0
                  ? 'text-[var(--success)]'
                  : flushTally.rejected > 0
                    ? 'text-[var(--critical)]'
                    : 'text-ink-3'
              }`}>
                {flushTally.sent > 0
                  ? `${flushTally.sent} report${flushTally.sent === 1 ? '' : 's'} sent${flushTally.remaining > 0 ? ` · ${flushTally.remaining} still queued` : ''}`
                  : flushTally.rejected > 0
                    ? `${flushTally.rejected} rejected — needs attention${flushTally.remaining > 0 ? ` · ${flushTally.remaining} still queued` : ''}`
                    : flushTally.remaining > 0
                      ? 'Still waiting — will retry automatically when a link is confirmed.'
                      : 'Nothing left in the queue.'}
              </p>
            )}

            {/* Permanently rejected reports: surfaced with the server's reason. */}
            {reportQueued && rejectedItems.length > 0 && (
              <div className="mt-5 flex flex-col gap-2">
                {rejectedItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-[color-mix(in_srgb,var(--critical)_28%,transparent)] bg-[color-mix(in_srgb,var(--critical)_8%,transparent)] p-3 text-left"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--critical)]">
                        <TriangleAlert size={13} aria-hidden /> Rejected — needs attention
                      </p>
                      <button
                        type="button"
                        onClick={() => void queue.discard(item.id)}
                        className="btn btn-ghost btn-sm"
                      >
                        Discard
                      </button>
                    </div>
                    <p className="break-words text-xs leading-relaxed text-ink-2">
                      {item.lastError || 'The server rejected this report — retrying cannot fix it.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── What was reported ── */}
          <section className="panel p-4 sm:p-5 mb-4">
            <h2 className="data-label mb-3">Report contents</h2>
            <dl className="grid grid-cols-2 gap-2">
              {summary.map(item => (
                <div key={item.l} className="well p-3">
                  <dt className="data-label mb-1">{item.l}</dt>
                  <dd
                    className="text-sm font-medium capitalize leading-snug break-words"
                    style={{ color: item.ink ?? 'var(--text-1)' }}
                  >
                    {item.v}
                  </dd>
                </div>
              ))}
            </dl>

            {submission.hazards.length > 0 && (
              <div className="mt-4">
                <p className="data-label mb-2">Hazards</p>
                <ul className="flex flex-wrap gap-1.5">
                  {submission.hazards.map((h, i) => (
                    <li key={i} className="chip chip-critical mono tracking-normal normal-case">
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="mt-4 border-t border-[var(--line-faint)] pt-3 text-xs leading-relaxed text-ink-3">
              {submission.urgency_reason}
            </p>
          </section>

          {/* ── First aid ── */}
          {firstAidProtocol && (
            <section className="rounded-xl border border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_6%,transparent)] p-4 sm:p-5 mb-4">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="text-xl" aria-hidden>🏥</span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--success)]">
                    First aid · {firstAidProtocol.title}
                  </h2>
                  <p className="mono text-2xs text-ink-3">{firstAidProtocol.source}</p>
                </div>
              </div>

              <ol className="mb-3 space-y-2">
                {firstAidProtocol.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-2">
                    <span className="mono mt-0.5 w-5 shrink-0 text-right text-xs font-bold text-[var(--success)]">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              {firstAidProtocol.warnings.length > 0 && (
                <div className="rounded-lg border border-[color-mix(in_srgb,var(--critical)_28%,transparent)] bg-[color-mix(in_srgb,var(--critical)_8%,transparent)] p-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--critical)]">
                    <TriangleAlert size={13} aria-hidden /> Do not
                  </p>
                  <ul className="space-y-1">
                    {firstAidProtocol.warnings.map((w, i) => (
                      <li key={i} className="text-xs leading-relaxed text-ink-2">{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* ── Next steps ── */}
          <div className="flex gap-3">
            <a href="/dispatcher" className="btn btn-primary flex-1">Dispatcher dashboard</a>
            <button type="button" onClick={handleReset} className="btn btn-outline">
              <RotateCcw size={15} aria-hidden /> New
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ─── MAIN LANDING VIEW ────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-surface-0 text-white flex flex-col relative">
      <Toaster position="top-center" theme="dark" />

      {/* Atmosphere: a single faint red wash behind the beacon. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] z-0"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(239,68,68,0.10), rgba(9,9,11,0) 70%)' }}
      />

      {header}

      <main className="relative z-10 flex-1 w-full max-w-xl mx-auto px-5 flex flex-col items-center text-center pt-6 pb-12">
        {/* ── Brand ── */}
        <div className="mb-1">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Agap<span className="text-[var(--critical)]">AI</span>
          </h1>
          <p className="mt-1 text-sm text-ink-2">Emergency response, Iligan City</p>
          <p className="mono mt-1 text-2xs uppercase tracking-[0.14em] text-ink-3">
            IEEE SumpAI 2026 — MSU-IIT
          </p>
        </div>

        {/* ── SOS beacon ── */}
        <div className="relative mt-6 mb-3 flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
          <span aria-hidden className="sonar-ring absolute h-44 w-44 rounded-full border border-[color-mix(in_srgb,var(--critical)_22%,transparent)]" />
          <span aria-hidden className="sonar-ring-delayed absolute h-56 w-56 rounded-full border border-[color-mix(in_srgb,var(--critical)_14%,transparent)] sm:h-64 sm:w-64" />
          <button
            type="button"
            onClick={handleSOS}
            aria-label="Emergency SOS — tap to activate the emergency beacon"
            className="sos-pulse relative z-10 flex h-36 w-36 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--critical)_60%,transparent)] bg-gradient-to-b from-[#ef4444] to-[#b91c1c] text-white transition-transform duration-150 hover:scale-[1.04] active:scale-95 sm:h-40 sm:w-40"
          >
            <span className="text-2xl font-black tracking-[0.22em] indent-[0.22em]">SOS</span>
          </button>
        </div>

        <p className="text-sm font-medium text-ink-2" role="status" aria-live="polite">
          {isRecording ? 'Listening — speak now' : 'Tap SOS to send your location immediately'}
        </p>

        {/* ── GPS ── */}
        <p
          className={`mono mt-2 flex items-center gap-1.5 text-xs ${
            gpsStatus === 'ready' ? 'text-[var(--success)]'
            : gpsStatus === 'loading' ? 'text-[var(--warning)]'
            : gpsStatus === 'error' ? 'text-[var(--critical)]'
            : 'text-ink-3'
          }`}
          role="status"
          aria-live="polite"
        >
          <MapPin size={12} aria-hidden />
          {gpsStatus === 'idle' && 'GPS not requested yet'}
          {gpsStatus === 'loading' && 'Acquiring GPS…'}
          {gpsStatus === 'ready' && 'GPS ready'}
          {gpsStatus === 'error' && 'Approximate location only'}
          {gpsCoords && gpsStatus !== 'loading' && (
            <span className="text-ink-3">· {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}</span>
          )}
        </p>

        {/* ── Secondary actions ── */}
        {!transcript && !isRecording && (
          <div className="mt-5 flex w-full max-w-xs flex-col gap-2">
            <button type="button" onClick={() => setShowVoiceModal(true)} className="btn btn-outline w-full">
              <Mic size={15} aria-hidden /> Describe it by voice
            </button>
            <button type="button" onClick={handleTryDemo} className="btn btn-ghost w-full text-ink-3">
              <ChevronRight size={14} aria-hidden /> Run a practice report
            </button>
          </div>
        )}

        {/* ── Transcript + preview ── */}
        {transcript && (
          <div className="mt-6 w-full max-w-md animate-fade-in text-left">
            <div className="panel p-4">
              <p className="data-label mb-2">Transcript</p>
              <p className="text-sm leading-relaxed text-ink-2">{transcript}</p>
              {interimTranscript && (
                <p className="mt-1 text-sm italic leading-relaxed text-ink-3">
                  {interimTranscript.replace(transcript, '')}
                </p>
              )}
            </div>

            {!isProcessing && (
              <div className="mt-3 rounded-xl border border-[color-mix(in_srgb,var(--info)_30%,transparent)] bg-[color-mix(in_srgb,var(--info)_6%,transparent)] p-4">
                <p className="data-label mb-2 text-[var(--info)]">What will be filed</p>
                <dl className="grid grid-cols-2 gap-2">
                  <div className="well p-2.5">
                    <dt className="data-label mb-0.5">Type</dt>
                    <dd className="text-xs">{isDemo ? 'Keyword-detected' : 'AI-classified'}</dd>
                  </div>
                  <div className="well p-2.5">
                    <dt className="data-label mb-0.5">Urgency</dt>
                    <dd className="text-xs">{isDemo ? 'Rule-based' : 'AI-assessed'}</dd>
                  </div>
                  <div className="well p-2.5">
                    <dt className="data-label mb-0.5">Location</dt>
                    <dd className="mono text-xs">
                      {gpsCoords ? `${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}` : 'Acquiring…'}
                    </dd>
                  </div>
                  <div className="well p-2.5">
                    <dt className="data-label mb-0.5">Confidence</dt>
                    <dd className="text-xs">{isDemo ? 'Keyword match' : 'Score attached'}</dd>
                  </div>
                </dl>
              </div>
            )}

            {!isProcessing && (
              <button type="button" onClick={handleVoiceSubmit} className="btn btn-primary mt-3 w-full">
                <Send size={15} aria-hidden /> Send report
              </button>
            )}
          </div>
        )}

        {/* ── Processing ── */}
        {isProcessing && (
          <div className="mt-6 flex flex-col items-center gap-3" role="status" aria-live="polite">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-white" aria-hidden />
            {extractionStep && (
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm font-medium">{extractionStepLabel[extractionStep]}</span>
                <div className="flex gap-1.5" aria-hidden>
                  {(['capturing-location', 'analyzing-transcript', 'creating-report'] as ExtractionStepKey[]).map((step) => {
                    const steps: ExtractionStepKey[] = ['capturing-location', 'analyzing-transcript', 'creating-report'];
                    const stepIdx = steps.indexOf(step);
                    const currentIdx = steps.indexOf(extractionStep);
                    return (
                      <span
                        key={step}
                        className={`h-1.5 w-6 rounded-full transition-colors ${stepIdx <= currentIdx ? 'bg-white' : 'bg-white/15'}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── VOICE MODAL ── */}
      {showVoiceModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Voice report"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={handleVoiceModalClose}
        >
          <div
            className="panel w-full max-w-md p-5 sm:p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Voice report</h2>
              <button
                type="button"
                onClick={handleVoiceModalClose}
                aria-label="Close voice report"
                className="btn btn-ghost btn-icon"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <VoiceRecorder
              isRecording={isRecording}
              onTranscript={setTranscript}
              onInterimTranscript={setInterimTranscript}
              onStop={() => setIsRecording(false)}
            />

            <p className="mb-4 text-center text-sm text-ink-2">
              {isRecording
                ? 'Listening — describe what happened, where, and who is hurt.'
                : 'Press start to record, or type below.'}
            </p>

            {transcript && (
              <div className="well mb-4 p-3">
                <p className="data-label mb-1">Live transcript</p>
                <p className="text-sm leading-relaxed text-ink-2">{transcript}</p>
                {interimTranscript && (
                  <p className="mt-1 text-xs italic text-ink-3">
                    {interimTranscript.replace(transcript, '')}
                  </p>
                )}
              </div>
            )}

            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Or type what happened…"
              rows={3}
              className="field mb-4 resize-y"
              aria-label="Emergency description"
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleToggleRecording}
                className={`btn flex-1 ${isRecording ? 'btn-danger' : 'btn-quiet'}`}
                aria-pressed={isRecording}
              >
                <Mic size={15} aria-hidden /> {isRecording ? 'Stop' : 'Start'}
              </button>
              <button
                type="button"
                onClick={() => { handleVoiceSubmit(); handleVoiceModalClose(); }}
                disabled={!transcript.trim()}
                className="btn btn-primary flex-1"
              >
                <Send size={15} aria-hidden /> Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
