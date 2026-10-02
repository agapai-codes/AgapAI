'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import {
  MapPin, Clock, CheckCircle2, Navigation, ChevronRight, LogOut,
  ArrowLeft, Phone, Brain, Wind, Droplets, Activity, Radio
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Sidebar } from '../components/Sidebar';
import { getFirstAid } from '../lib/firstAid';
import type { Incident, IncidentStatus } from '../types/incident';
import { STATUS_LABELS, STATUS_ORDER } from '../types/incident';

/** Red act, amber wait, emerald done — same four accents as everywhere else.
 *  Urgency arrives from the API in either case, so normalise before lookup. */
const URGENCY_STYLE: Record<string, { color: string; bg: string; border: string; chip: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.4)', chip: 'chip-critical-solid' },
  high: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', chip: 'chip-critical' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', chip: 'chip-warning' },
  low: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', chip: 'chip-success' },
};

const urgencyStyle = (raw?: string) =>
  URGENCY_STYLE[(raw || 'medium').toLowerCase()] ?? URGENCY_STYLE.medium;

const INCIDENT_ICONS: Record<string, string> = {
  FIRE: '🔥', ACCIDENT: '🚗', MEDICAL: '🏥', DISASTER: '🌪️',
  VIOLENCE: '⚠️', HAZARDOUS: '☢️', MISSING_PERSON: '🔍', NATURAL_DISASTER: '🌪️',
};

/** Full lifecycle, in order — used by the detail stepper. */
const LIFECYCLE: IncidentStatus[] = [
  'PENDING', 'REVIEWING', 'PRIORITIZED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'RESOLVED',
];

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export default function ResponderView() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showResolve, setShowResolve] = useState(false);

  const fetchAssigned = useCallback(async () => {
    try {
      const res = await fetch('/api/incidents', { cache: 'no-store' });
      const payload = await res.json();
      if (payload.success && payload.data) {
        const assigned = payload.data.filter((i: Incident) =>
          i.status !== 'RESOLVED' && (i.assigned_responder_id === user?.id || i.status === 'DISPATCHED')
        );
        setIncidents(assigned);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => {
    fetchAssigned();
    const t = setInterval(fetchAssigned, 10000);
    return () => clearInterval(t);
  }, [fetchAssigned]);

  const updateStatus = async (id: string, status: IncidentStatus, notes?: string) => {
    setUpdateLoading(true);
    try {
      const body: Record<string, string> = { status };
      if (notes) body.resolution_notes = notes;
      const res = await fetch(`/api/incidents/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (payload.success && payload.data) {
        setIncidents(prev => payload.data.status === 'RESOLVED'
          ? prev.filter(i => i.id !== id)
          : prev.map(i => i.id === id ? payload.data : i));
        if (selectedIncident?.id === id) setSelectedIncident(payload.data);
        toast.success(`Status updated to ${status}`);
        setShowResolve(false);
        setResolutionNotes('');
      } else {
        toast.error('Failed to update');
      }
    } catch {
      toast.error('Update failed');
    } finally {
      setUpdateLoading(false);
    }
  };

  const openNavigation = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  // ── Detail View ──────────────────────────────────────────────────────
  if (selectedIncident) {
    const inc = selectedIncident;
    const urg = urgencyStyle(inc.urgency);
    const protocol = getFirstAid((inc.condition || '') + ' ' + inc.type);
    const currentIndex = STATUS_ORDER[inc.status] ?? 0;

    return (
      <div className="min-h-[calc(100dvh_-_var(--banner-h,0px))] bg-surface-0 text-ink-1">
        <Toaster position="top-center" theme="dark" />

        {/* Header */}
        <header className="chrome sticky top-0 z-40 flex h-14 items-center gap-3 px-3 sm:px-4">
          <button
            type="button"
            onClick={() => { setSelectedIncident(null); setShowResolve(false); }}
            className="btn btn-sm btn-ghost -ml-1"
          >
            <ArrowLeft size={14} aria-hidden /> Back
          </button>
          <span className="data-label">Incident detail</span>
          <span className="mono ml-auto text-[11px] text-ink-3">{inc.id.slice(0, 8)}</span>
        </header>

        <div className="mx-auto max-w-lg space-y-4 p-4">
          {/* Header card */}
          <section className="panel p-4">
            <div className="mb-3 flex items-start gap-3">
              <span className="text-2xl leading-none" aria-hidden>{INCIDENT_ICONS[inc.type] || '📋'}</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-bold leading-tight">{inc.type.replace('_', ' ')}</h2>
                <p className="mono mt-1 text-[11px] text-ink-3">
                  {inc.status} · {timeAgo(inc.timestamp)}
                </p>
              </div>
              <span className={`chip ${urg.chip}`}>{(inc.urgency || 'medium').toUpperCase()}</span>
            </div>

            <p className="mb-3 text-[14px] leading-relaxed text-ink-2">{inc.description}</p>

            {/* Vitals chips */}
            {(inc.condition || (inc.people_affected && inc.people_affected > 1) ||
              inc.consciousness === false || inc.breathing === false || inc.bleeding) && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {inc.condition && (
                  <span className="chip chip-neutral normal-case tracking-normal">
                    Condition: {inc.condition}
                  </span>
                )}
                {inc.people_affected && inc.people_affected > 1 && (
                  <span className="chip chip-neutral normal-case tracking-normal">
                    People: {inc.people_affected}
                  </span>
                )}
                {inc.consciousness === false && (
                  <span className="chip chip-critical">
                    <Brain size={11} aria-hidden /> Unconscious
                  </span>
                )}
                {inc.breathing === false && (
                  <span className="chip chip-critical">
                    <Wind size={11} aria-hidden /> Not breathing
                  </span>
                )}
                {inc.bleeding && (
                  <span className="chip chip-critical">
                    <Droplets size={11} aria-hidden /> Bleeding
                  </span>
                )}
              </div>
            )}

            {/* Location */}
            <div className="well flex items-center gap-3 p-3">
              <MapPin size={16} className="shrink-0 text-[var(--info)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-ink-1">{inc.location}</p>
                <p className="mono text-[11px] text-ink-3">
                  {inc.coordinates.lat.toFixed(4)}, {inc.coordinates.lng.toFixed(4)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openNavigation(inc.coordinates.lat, inc.coordinates.lng)}
                className="btn btn-sm btn-info"
                aria-label="Open directions in maps"
              >
                <Navigation size={13} aria-hidden /> Navigate
              </button>
            </div>

            {/* Reporter */}
            <div className="mt-3 flex items-center gap-2 text-[12px] text-ink-3">
              <Phone size={12} aria-hidden />
              <span>Reported by</span>
              <span className="font-medium text-ink-2">{inc.reporter}</span>
            </div>
          </section>

          {/* Lifecycle stepper */}
          <section className="panel p-4" aria-label={`Status: ${STATUS_LABELS[inc.status]}`}>
            <p className="data-label mb-3">Lifecycle</p>
            <div className="flex items-center">
              {LIFECYCLE.map((s, i) => {
                const done = i < currentIndex;
                const current = i === currentIndex;
                return (
                  <React.Fragment key={s}>
                    <span
                      className={`status-dot ${
                        current ? 'live-dot' : done ? 'status-dot-ok' : ''
                      } h-2.5 w-2.5`}
                      style={{
                        background: current
                          ? 'var(--info)'
                          : done ? 'var(--success)' : 'rgba(255,255,255,0.16)',
                        boxShadow: current ? '0 0 0 3px rgba(56,189,248,0.22)' : undefined,
                      }}
                      title={STATUS_LABELS[s]}
                    />
                    {i < LIFECYCLE.length - 1 && (
                      <span
                        aria-hidden
                        className="h-px flex-1"
                        style={{ background: i < currentIndex ? 'var(--success)' : 'var(--line)' }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <p className="mono mt-2.5 text-[11px] text-ink-3">
              Step {currentIndex + 1} / {LIFECYCLE.length}
              <span className="mx-1.5 text-ink-3">·</span>
              <span className="font-semibold text-ink-1">{STATUS_LABELS[inc.status]}</span>
            </p>
          </section>

          {/* First-aid */}
          <section className="panel overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[rgba(16,185,129,0.28)] bg-[rgba(16,185,129,0.08)] px-4 py-3">
              <span aria-hidden>🏥</span>
              <p className="text-[13px] font-bold uppercase tracking-wide text-[var(--success)]">
                First-aid: {protocol.title}
              </p>
            </div>
            <div className="p-4">
              <ol className="mb-2 space-y-2">
                {protocol.steps.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-2">
                    <span className="mono shrink-0 font-bold text-[var(--success)]">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <p className="mono text-[11px] text-ink-3">{protocol.source}</p>
            </div>
          </section>

          {/* Actions */}
          <div className="space-y-2.5">
            {inc.status === 'DISPATCHED' && (
              <>
                <button
                  type="button"
                  onClick={() => updateStatus(inc.id, 'EN_ROUTE')}
                  disabled={updateLoading}
                  className="btn btn-warning w-full"
                >
                  <Radio size={14} aria-hidden /> En Route
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(inc.id, 'ARRIVED')}
                  disabled={updateLoading}
                  className="btn btn-info w-full"
                >
                  On Scene
                </button>
              </>
            )}
            {inc.status === 'EN_ROUTE' && (
              <>
                <button
                  type="button"
                  onClick={() => updateStatus(inc.id, 'ARRIVED')}
                  disabled={updateLoading}
                  className="btn btn-info w-full"
                >
                  Arrived on Scene
                </button>
                <button
                  type="button"
                  onClick={() => setShowResolve(true)}
                  disabled={updateLoading}
                  className="btn btn-success w-full"
                >
                  <CheckCircle2 size={14} aria-hidden /> Mark Resolved
                </button>
              </>
            )}
            {inc.status === 'ARRIVED' && (
              <button
                type="button"
                onClick={() => setShowResolve(true)}
                disabled={updateLoading}
                className="btn btn-success w-full"
              >
                <CheckCircle2 size={14} aria-hidden /> Mark Resolved
              </button>
            )}
            {inc.status === 'PENDING' && (
              <button
                type="button"
                onClick={() => updateStatus(inc.id, 'DISPATCHED')}
                disabled={updateLoading}
                className="btn btn-primary w-full"
              >
                Accept Assignment
              </button>
            )}
          </div>

          {/* Resolve form */}
          {showResolve && (
            <section className="panel animate-slide-up p-4">
              <label htmlFor="resolution-notes" className="data-label mb-2 block">
                Resolution notes
              </label>
              <textarea
                id="resolution-notes"
                value={resolutionNotes}
                onChange={e => setResolutionNotes(e.target.value)}
                placeholder="Describe what was done, patient outcome…"
                rows={3}
                className="field mb-3 min-h-[80px] resize-y"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateStatus(inc.id, 'RESOLVED', resolutionNotes)}
                  disabled={updateLoading}
                  className="btn btn-success flex-1"
                >
                  Confirm Resolve
                </button>
                <button
                  type="button"
                  onClick={() => { setShowResolve(false); setResolutionNotes(''); }}
                  disabled={updateLoading}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  const handleNavigate = useCallback((route: string) => {
    if (route === 'dispatcher') router.push('/dispatcher');
    else if (route === 'analytics') router.push('/analytics');
  }, [router]);

  // ── List View ────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-[calc(100dvh_-_var(--banner-h,0px))] w-full bg-surface-0 font-sans text-ink-1">
      <Toaster position="top-right" theme="dark" />

      {/* Sidebar (md and up) */}
      <div className="hidden self-stretch md:block">
        <Sidebar
          activeRoute="responder"
          onNavigate={handleNavigate}
          user={user}
          onSignOut={signOut}
        />
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="chrome sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="chip chip-info">
              <span className="status-dot status-dot-ok live-dot" aria-hidden />
              Responder
            </span>
            <span className="mono hidden text-[11px] text-ink-3 sm:inline">
              {incidents.length} assigned
            </span>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="btn btn-icon btn-ghost md:hidden"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </header>

        <div className="mx-auto w-full max-w-lg p-4 pb-8">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-bold">Assigned incidents</h2>
            <span className="mono text-[11px] text-ink-3">{incidents.length} open</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-16" role="status" aria-label="Loading incidents">
              <div className="mb-3 h-7 w-7 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-ink-1" />
              <p className="data-label">Loading incidents</p>
            </div>
          ) : incidents.length === 0 ? (
            <div className="well flex flex-col items-center px-6 py-14 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(16,185,129,0.12)]">
                <CheckCircle2 size={24} className="text-[var(--success)]" aria-hidden />
              </div>
              <p className="text-[14px] font-medium text-ink-1">No assigned incidents</p>
              <p className="mt-1 text-[13px] text-ink-3">All clear — check back later</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {incidents.map(inc => {
                const urg = urgencyStyle(inc.urgency);
                return (
                  <li key={inc.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedIncident(inc)}
                      className="panel relative w-full overflow-hidden p-3.5 pl-4 text-left transition-colors hover:border-[var(--line-strong)] hover:bg-white/[0.03]"
                    >
                      {/* Urgency accent — the only colour on the card */}
                      <span
                        aria-hidden
                        className="absolute bottom-0 left-0 top-0 w-[3px]"
                        style={{ background: urg.color }}
                      />

                      <div className="flex items-center gap-2.5">
                        <span className="text-lg" aria-hidden>{INCIDENT_ICONS[inc.type] || '📋'}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[13px] font-bold">
                              {inc.type.replace('_', ' ')}
                            </p>
                            <span className={`chip ${urg.chip}`}>
                              {(inc.urgency || 'medium').toUpperCase()}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[12px] text-ink-3">
                            {inc.description?.slice(0, 60)}
                            {inc.description && inc.description.length > 60 ? '…' : ''}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="mono flex items-center gap-1 text-[11px] text-ink-3">
                              <MapPin size={11} aria-hidden />
                              {inc.location?.slice(0, 25)}
                            </span>
                            <span className="mono flex items-center gap-1 text-[11px] text-ink-3">
                              <Clock size={11} aria-hidden />
                              {timeAgo(inc.timestamp)}
                            </span>
                          </div>
                        </div>
                        <ChevronRight size={16} className="shrink-0 text-ink-3" aria-hidden />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {incidents.length > 0 && (
            <p className="data-label mt-4 flex items-center gap-2 text-center">
              <Activity size={12} aria-hidden /> Refreshes every 10 seconds
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
