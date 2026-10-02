'use client';

import React, { useState } from 'react';
import {
  X, Activity, MapPin, Sparkles, Brain, Wind,
  Droplets, ShieldAlert, FileText, ChevronDown, ChevronRight,
  Stethoscope, Send, UserPlus, AlertCircle, Play, Copy, Check
} from 'lucide-react';
import type { IncidentReport, UrgencyLevel, IncidentStatus } from '../types/incident';
import { STATUS_LABELS, STATUS_ORDER, canTransition, nextStatus } from '../types/incident';
import { IncidentTimeline } from './IncidentTimeline';

interface DispatchIncidentPanelProps {
  incident: IncidentReport;
  onClose: () => void;
  onStatusUpdate?: (id: string, status: IncidentStatus) => void;
  onUrgencyOverride?: (id: string, urgency: UrgencyLevel, reason: string) => void;
  onAssignUnit?: (id: string, unit: string) => void;
  onResolve?: (id: string, notes: string) => void;
}

/** Urgency drives all colour in this panel. Type is carried by glyph + word. */
const URGENCY_STYLE: Record<UrgencyLevel, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: '#f87171', bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.45)' },
  HIGH: { color: 'var(--critical)', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)' },
  MEDIUM: { color: 'var(--warning)', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' },
  LOW: { color: 'var(--success)', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
};

const TYPE_GLYPH: Record<string, string> = {
  FIRE: '🔥', ACCIDENT: '🚗', MEDICAL: '🏥', VIOLENCE: '⚠️', NATURAL_DISASTER: '🌪️',
};

const LIFECYCLE: IncidentStatus[] = [
  'PENDING', 'REVIEWING', 'PRIORITIZED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'RESOLVED',
];

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function confidencePercent(c: number): string {
  return Math.round(c * 100) + '%';
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border-b border-[var(--line-faint)] px-4 py-4 sm:px-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ icon: Icon, label, tone }: { icon: React.ElementType; label: string; tone?: string }) {
  return (
    <h3 className="data-label mb-2.5 flex items-center gap-1.5" style={tone ? { color: tone } : undefined}>
      <Icon size={12} aria-hidden />
      {label}
    </h3>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export const DispatchIncidentPanel: React.FC<DispatchIncidentPanelProps> = ({
  incident,
  onClose,
  onStatusUpdate,
  onUrgencyOverride,
  onAssignUnit,
  onResolve,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [overrideUrgency, setOverrideUrgency] = useState<UrgencyLevel | ''>('');
  const [overrideReason, setOverrideReason] = useState('');
  const [assignUnit, setAssignUnit] = useState('');
  const [copied, setCopied] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const urgStyle = URGENCY_STYLE[incident.urgency];
  const typeGlyph = TYPE_GLYPH[incident.type] || '📋';
  const next = nextStatus(incident.status);
  const isResolved = incident.status === 'RESOLVED';
  const currentIndex = STATUS_ORDER[incident.status] ?? 0;

  const handleStatusAdvance = () => {
    if (next && onStatusUpdate) onStatusUpdate(incident.id, next);
  };

  const handleOverride = () => {
    if (overrideUrgency && onUrgencyOverride) {
      onUrgencyOverride(incident.id, overrideUrgency as UrgencyLevel, overrideReason || `Override at ${new Date().toLocaleTimeString()}`);
      setOverrideUrgency('');
      setOverrideReason('');
    }
  };

  const handleAssign = () => {
    if (assignUnit && onAssignUnit) {
      onAssignUnit(incident.id, assignUnit);
      setAssignUnit('');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(incident.voiceReport?.transcriptionText || incident.relevantContext || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTTS = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = incident.voiceReport?.transcriptionText || incident.relevantContext || '';
      if (!text) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const confidenceInk =
    incident.aiTriage.confidence >= 0.8 ? 'var(--success)'
    : incident.aiTriage.confidence >= 0.6 ? 'var(--warning)'
    : 'var(--critical)';

  return (
    <aside
      aria-label="Incident detail"
      className="flex h-full w-full flex-col bg-surface-0 text-white lg:w-[400px]"
    >
      {/* ── HEADER ── */}
      <div className="chrome flex shrink-0 items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span aria-hidden className="text-base leading-none">{typeGlyph}</span>
            <h2 className="truncate text-[15px] font-bold leading-tight">{incident.condition}</h2>
          </div>
          <p className="mono text-2xs text-ink-3">
            {incident.id} · {timeAgo(incident.timeReported)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close incident detail"
          className="btn btn-ghost btn-icon shrink-0"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {/* ── LIFECYCLE ── */}
      <Section className="shrink-0 bg-white/[0.02]">
        <SectionLabel icon={Activity} label="Lifecycle" />
        <div
          className="flex items-center gap-1"
          role="img"
          aria-label={`Lifecycle: step ${currentIndex + 1} of ${LIFECYCLE.length}, ${STATUS_LABELS[incident.status]}`}
        >
          {LIFECYCLE.map((s, i) => {
            const thisIdx = STATUS_ORDER[s];
            const isPast = thisIdx < currentIndex;
            const isCurrent = thisIdx === currentIndex;
            const ink = isPast ? 'var(--success)' : isCurrent ? 'var(--info)' : 'var(--line-strong)';
            return (
              <React.Fragment key={s}>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border-2 transition-colors"
                  style={{
                    borderColor: ink,
                    background: isPast ? ink : isCurrent ? 'transparent' : 'transparent',
                    boxShadow: isCurrent ? `0 0 0 3px color-mix(in srgb, ${ink} 30%, transparent)` : 'none',
                  }}
                />
                {i < LIFECYCLE.length - 1 && (
                  <span className="h-px flex-1" style={{ background: isPast ? 'var(--success)' : 'var(--line)' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="mono text-2xs uppercase tracking-[0.1em] text-ink-3">
            Step {currentIndex + 1} / {LIFECYCLE.length}
          </span>
          <span
            className="mono text-2xs font-bold uppercase tracking-[0.1em]"
            style={{ color: incident.status === 'RESOLVED' ? 'var(--success)' : 'var(--info)' }}
          >
            {STATUS_LABELS[incident.status]}
          </span>
        </div>
      </Section>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="min-h-0 flex-1 overflow-y-auto">

        {/* ── METADATA GRID ── */}
        <Section>
          <dl className="grid grid-cols-3 gap-2">
            <div className="well p-2.5">
              <dt className="data-label mb-0.5">Type</dt>
              <dd className="text-xs font-semibold uppercase leading-tight">{incident.type.replace('_', ' ')}</dd>
            </div>
            <div
              className="rounded-lg border p-2.5"
              style={{ background: urgStyle.bg, borderColor: urgStyle.border }}
            >
              <dt className="data-label mb-0.5" style={{ color: urgStyle.color }}>Urgency</dt>
              <dd className="text-xs font-bold uppercase" style={{ color: urgStyle.color }}>{incident.urgency}</dd>
            </div>
            <div className="well p-2.5">
              <dt className="data-label mb-0.5">People</dt>
              <dd className="readout text-base">{incident.peopleCount}</dd>
            </div>
          </dl>
        </Section>

        {/* ── LOCATION & GPS ── */}
        <Section>
          <SectionLabel icon={MapPin} label="Location" />
          <p className="text-sm font-medium leading-snug">{incident.location.landmarkText}</p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="mono text-xs text-ink-2">
              {incident.location.coordinates[1].toFixed(5)}, {incident.location.coordinates[0].toFixed(5)}
            </p>
            <span
              className={`chip ${
                incident.location.confidenceScore >= 90 ? 'chip-success'
                : incident.location.confidenceScore >= 70 ? 'chip-warning'
                : 'chip-critical'
              }`}
            >
              GPS {incident.location.confidenceScore}%
            </span>
          </div>
        </Section>

        {/* ── VITALS & HAZARDS ── */}
        <Section>
          <SectionLabel icon={Activity} label="Vitals" tone="var(--critical)" />
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Conscious', value: incident.vitals.conscious, icon: Brain, adverse: incident.vitals.conscious === false },
              { label: 'Breathing', value: incident.vitals.breathing, icon: Wind, adverse: incident.vitals.breathing === false },
              { label: 'Bleeding', value: incident.vitals.bleeding, icon: Droplets, adverse: incident.vitals.bleeding === true },
            ].map(v => (
              <div
                key={v.label}
                className="rounded-lg border p-2.5 text-center"
                style={{
                  background: v.adverse ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.06)',
                  borderColor: v.adverse ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)',
                }}
              >
                <v.icon size={13} className={`mx-auto mb-1 ${v.adverse ? 'text-[var(--critical)]' : 'text-[var(--success)]'}`} aria-hidden />
                <p className="data-label leading-none">{v.label}</p>
                <p
                  className="mono mt-1 text-sm font-bold"
                  style={{ color: v.adverse ? 'var(--critical)' : 'var(--success)' }}
                >
                  {v.value === null ? '—' : v.value ? 'YES' : 'NO'}
                </p>
              </div>
            ))}
          </div>

          {incident.hazards.length > 0 && (
            <div className="mt-3">
              <p className="data-label mb-1.5">Identified hazards</p>
              <ul className="flex flex-wrap gap-1.5">
                {incident.hazards.map((h, i) => (
                  <li key={i} className="chip chip-warning">
                    <ShieldAlert size={11} aria-hidden /> {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {incident.injuriesSymptoms.length > 0 && (
            <div className="mt-3">
              <p className="data-label mb-1.5">Injuries / symptoms</p>
              <ul className="flex flex-wrap gap-1.5">
                {incident.injuriesSymptoms.map((s, i) => (
                  <li key={i} className="chip chip-critical normal-case tracking-normal">{s}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* ── AI DECISION SUPPORT ── */}
        <Section>
          <SectionLabel icon={Sparkles} label="Triage support" tone="var(--info)" />

          <div className="mb-3 flex items-center gap-3">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5"
              role="meter"
              aria-valuenow={Math.round(incident.aiTriage.confidence * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Triage confidence"
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${incident.aiTriage.confidence * 100}%`, background: confidenceInk }}
              />
            </div>
            <span className="mono text-xs font-bold" style={{ color: confidenceInk }}>
              {confidencePercent(incident.aiTriage.confidence)}
            </span>
          </div>

          {incident.aiTriage.contributingFactors.length > 0 && (
            <div className="mb-3">
              <p className="data-label mb-1.5">Contributing factors</p>
              <ul className="flex flex-wrap gap-1.5">
                {incident.aiTriage.contributingFactors.map((f, i) => (
                  <li key={i} className="chip chip-info normal-case tracking-normal">{f}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="well p-3">
            <p className="data-label mb-1">Rationale</p>
            <p className="text-xs italic leading-relaxed text-ink-2">
              “{incident.aiTriage.rationaleNote}”
            </p>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.07)] p-2.5">
            <AlertCircle size={12} className="mt-0.5 shrink-0 text-[var(--warning)]" aria-hidden />
            <p className="text-xs leading-relaxed text-ink-2">
              Decision support only. The dispatcher keeps final operational authority.
            </p>
          </div>
        </Section>

        {/* ── CALLER VOICE REPORT & TRANSCRIPT ── */}
        {(incident.voiceReport || incident.relevantContext) && (
          <Section>
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <SectionLabel icon={FileText} label="Caller report" tone="var(--info)" />
              {incident.aiTriage?.confidence != null && (
                <span className="chip chip-info mono tracking-normal">
                  {Math.round(incident.aiTriage.confidence * 100)}% match
                </span>
              )}
            </div>

            <div className="mb-3 flex items-center gap-2">
              {incident.voiceReport?.audioUrl ? (
                <audio controls className="h-9 w-full rounded-lg" src={incident.voiceReport.audioUrl}>
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <button type="button" onClick={handleTTS} className="btn btn-sm btn-quiet w-full">
                  <Play size={12} aria-hidden /> Listen to report
                </button>
              )}
            </div>

            <div className="well group relative p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="mono flex-1 whitespace-pre-wrap text-xs italic leading-relaxed text-ink-2">
                  “{incident.voiceReport?.transcriptionText || incident.relevantContext || 'No transcript available'}”
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy transcript"
                  className="btn btn-ghost btn-sm shrink-0 opacity-100 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                >
                  {copied ? <><Check size={11} aria-hidden /> Copied</> : <><Copy size={11} aria-hidden /> Copy</>}
                </button>
              </div>
            </div>

            {incident.injuriesSymptoms && incident.injuriesSymptoms.length > 0 && (
              <div className="mt-2.5">
                <p className="data-label mb-1.5">Key terms</p>
                <ul className="flex flex-wrap gap-1.5">
                  {incident.injuriesSymptoms.map((term, i) => (
                    <li key={i} className="chip chip-neutral normal-case tracking-normal">{term}</li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        )}

        {/* ── FIRST-AID PROTOCOL ── */}
        {incident.firstAidGuidance && (
          <Section>
            <SectionLabel icon={Stethoscope} label={incident.firstAidGuidance.title} tone="var(--success)" />
            <p className="mono mb-2 text-2xs text-ink-3">{incident.firstAidGuidance.source}</p>
            <ol className="mb-2 space-y-1.5">
              {incident.firstAidGuidance.steps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-xs leading-relaxed text-ink-2">
                  <span className="mono shrink-0 font-bold text-[var(--success)]">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            {incident.firstAidGuidance.warnings.length > 0 && (
              <div className="mt-2 rounded-lg border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.07)] p-2.5">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[var(--critical)]">Do not</p>
                <ul className="space-y-1">
                  {incident.firstAidGuidance.warnings.map((w, i) => (
                    <li key={i} className="text-xs leading-relaxed text-ink-2">{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        )}

        {/* ── ACTIVITY TIMELINE ── */}
        <div className="px-4 py-3 sm:px-5">
          <IncidentTimeline incidentId={incident.id} />
        </div>

      </div>{/* end scrollable content */}

      {/* ── ACTIONS (sticky bottom) ── */}
      <div className="shrink-0 border-t border-[var(--line)] bg-surface-1 px-4 py-3.5 sm:px-5">
        {next && !isResolved && onStatusUpdate && (
          <button type="button" onClick={handleStatusAdvance} className="btn btn-primary mb-2 w-full">
            <Send size={13} aria-hidden /> Mark as {STATUS_LABELS[next]}
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowActions(!showActions)}
          className="data-label flex w-full items-center justify-between py-1 transition-colors hover:text-ink-1"
          aria-expanded={showActions}
        >
          <span>More actions</span>
          {showActions ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
        </button>

        {showActions && (
          <div className="mt-3 space-y-3">
            {/* Urgency override */}
            {onUrgencyOverride && (
              <div>
                <label className="data-label mb-1 block" htmlFor="urgency-override">Urgency override</label>
                <div className="flex gap-2">
                  <select
                    id="urgency-override"
                    value={overrideUrgency}
                    onChange={e => setOverrideUrgency(e.target.value as UrgencyLevel | '')}
                    className="field flex-1 py-1.5 text-xs"
                  >
                    <option value="">Select…</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                  <button type="button" onClick={handleOverride} disabled={!overrideUrgency} className="btn btn-sm btn-quiet">
                    Apply
                  </button>
                </div>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="Override reason (optional)"
                  aria-label="Override reason"
                  className="field mt-1.5 py-1.5 text-xs"
                />
              </div>
            )}

            {/* Unit assignment */}
            {onAssignUnit && (
              <div>
                <label className="data-label mb-1 block" htmlFor="assign-unit">Assign unit</label>
                <div className="flex gap-2">
                  <select
                    id="assign-unit"
                    value={assignUnit}
                    onChange={e => setAssignUnit(e.target.value)}
                    className="field flex-1 py-1.5 text-xs"
                  >
                    <option value="">Select unit…</option>
                    <option value="AMBULANCE">🚑 Ambulance</option>
                    <option value="FIRE_TRUCK">🚒 Fire engine</option>
                    <option value="PATROL">🚔 Patrol</option>
                    <option value="RESCUE">🛟 Rescue team</option>
                    <option value="HAZMAT">☢️ Hazmat</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={!assignUnit}
                    aria-label="Assign selected unit"
                    className="btn btn-sm btn-quiet"
                  >
                    <UserPlus size={13} aria-hidden />
                  </button>
                </div>
              </div>
            )}

            {/* Assigned units */}
            {incident.assignedUnits.length > 0 && (
              <div>
                <p className="data-label mb-1.5">Assigned units</p>
                <ul className="flex flex-wrap gap-1.5">
                  {incident.assignedUnits.map((u, i) => (
                    <li key={i} className="chip chip-info mono tracking-normal normal-case">{u}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Resolve incident */}
            {onResolve && !isResolved && (
              <div>
                <p className="data-label mb-1.5">Resolve incident</p>
                {showResolve ? (
                  <div className="space-y-2">
                    <textarea
                      value={resolutionNotes}
                      onChange={e => setResolutionNotes(e.target.value)}
                      placeholder="Resolution notes (optional)…"
                      aria-label="Resolution notes"
                      className="field min-h-[64px] resize-y py-1.5 text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { onResolve(incident.id, resolutionNotes); setShowResolve(false); setResolutionNotes(''); }}
                        className="btn btn-sm btn-success flex-1"
                      >
                        Confirm resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowResolve(false); setResolutionNotes(''); }}
                        className="btn btn-sm btn-ghost"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowResolve(true)} className="btn btn-outline w-full text-[var(--success)]">
                    Resolve incident
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default DispatchIncidentPanel;
