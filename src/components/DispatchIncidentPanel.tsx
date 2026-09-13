'use client';

import React, { useState } from 'react';
import {
  X, Clock, Sparkles, Brain, Wind,
  Droplets, ShieldAlert, FileText, ChevronDown, ChevronRight,
  Stethoscope, Send, UserPlus, AlertCircle, Play, Copy, Check
} from 'lucide-react';
import type { IncidentReport, UrgencyLevel, IncidentStatus } from '../types/incident';
import { STATUS_LABELS, STATUS_ORDER, canTransition, nextStatus } from '../types/incident';

interface DispatchIncidentPanelProps {
  incident: IncidentReport;
  onClose: () => void;
  onStatusUpdate?: (id: string, status: IncidentStatus) => void;
  onUrgencyOverride?: (id: string, urgency: UrgencyLevel, reason: string) => void;
  onAssignUnit?: (id: string, unit: string) => void;
  onResolve?: (id: string, notes: string) => void;
}

const URGENCY_STYLE: Record<UrgencyLevel, { color: string; bg: string; border: string }> = {
  HIGH: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)' },
  MEDIUM: { color: '#eab308', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.4)' },
  LOW: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.4)' },
};

const TYPE_CONFIG: Record<string, { color: string; icon: string }> = {
  FIRE: { color: '#ef4444', icon: '🔥' },
  ACCIDENT: { color: '#f97316', icon: '🚗' },
  MEDICAL: { color: '#3b82f6', icon: '🏥' },
  VIOLENCE: { color: '#f43f5e', icon: '⚠️' },
  NATURAL_DISASTER: { color: '#a855f7', icon: '🌪️' },
};

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
    <div className={`px-5 py-4 border-b border-white/5 ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ icon: Icon, label, color = 'text-neutral-500' }: { icon: React.ElementType; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2.5">
      <Icon size={11} className={color} />
      <span className="text-[9px] font-black tracking-widest uppercase" style={{ color: 'inherit' }}>{label}</span>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

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
  const typeConfig = TYPE_CONFIG[incident.type] || { color: '#71717a', icon: '📋' };
  const next = nextStatus(incident.status);
  const isResolved = incident.status === 'RESOLVED';

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

  return (
    <aside className="w-[420px] bg-[#09090b] text-white border-l border-white/5 h-full flex flex-col z-20 shadow-2xl shrink-0 animate-slide-in-right">

      {/* ── HEADER ── */}
      <div className="px-5 py-4 border-b border-white/5 flex justify-between items-start shrink-0"
        style={{ background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(16px)' }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[18px]">{typeConfig.icon}</span>
            <h2 className="text-[15px] font-bold text-white truncate leading-tight">{incident.condition}</h2>
          </div>
          <p className="text-[10px] text-neutral-500 font-mono">{incident.id} · {timeAgo(incident.timeReported)}</p>
        </div>
        <button onClick={onClose}
          className="text-neutral-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 hover:bg-white/5 transition-all ml-2 shrink-0">
          <X size={14} />
        </button>
      </div>

      {/* ── STATUS LIFECYCLE BAR ── */}
      <Section className="shrink-0 bg-white/[0.02]">
        <SectionLabel icon={Activity} label="LIFECYCLE" />
        <div className="flex items-center gap-0.5">
          {(['PENDING', 'REVIEWING', 'PRIORITIZED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'RESOLVED'] as IncidentStatus[]).map((s) => {
            const currentIdx = STATUS_ORDER[incident.status];
            const thisIdx = STATUS_ORDER[s];
            const isPast = thisIdx < currentIdx;
            const isCurrent = thisIdx === currentIdx;
            return (
              <React.Fragment key={s}>
                <div className={`flex flex-col items-center ${isCurrent ? 'scale-110' : ''}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold border transition-all ${
                    isPast ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : isCurrent ? 'bg-white/10 border-white/50 text-white'
                    : 'bg-white/5 border-white/10 text-neutral-600'
                  }`}>
                    {isPast ? '✓' : thisIdx + 1}
                  </div>
                  <span className={`text-[7px] mt-0.5 font-mono ${isCurrent ? 'text-white' : isPast ? 'text-emerald-400/70' : 'text-neutral-600'}`}>
                    {STATUS_LABELS[s]}
                  </span>
                </div>
                {s !== 'RESOLVED' && (
                  <div className={`flex-1 h-[2px] ${isPast ? 'bg-emerald-500/50' : 'bg-white/10'} mb-3`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </Section>

      {/* ── METADATA GRID ── */}
      <Section>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
            <span className="text-[8px] text-neutral-500 uppercase block font-mono tracking-wider">TYPE</span>
            <span className="font-semibold text-neutral-100 text-[12px] mt-0.5 block">{incident.type.replace('_', ' ')}</span>
          </div>
          <div className="rounded-lg p-2.5 border" style={{ background: urgStyle.bg, borderColor: urgStyle.border }}>
            <span className="text-[8px] uppercase block font-mono tracking-wider" style={{ color: urgStyle.color }}>URGENCY</span>
            <span className="font-bold text-[12px] mt-0.5 block" style={{ color: urgStyle.color }}>{incident.urgency}</span>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
            <span className="text-[8px] text-neutral-500 uppercase block font-mono tracking-wider">PEOPLE</span>
            <span className="font-semibold text-neutral-100 text-[12px] mt-0.5 block">{incident.peopleCount}</span>
          </div>
        </div>
      </Section>

      {/* ── LOCATION & GPS ── */}
      <Section>
        <SectionLabel icon={MapPin} label="LOCATION & COORDINATES" />
        <p className="font-medium text-neutral-100 text-[13px]">{incident.location.landmarkText}</p>
        <div className="flex items-center justify-between mt-1.5">
          <p className="font-mono text-neutral-400 text-[11px]">
            {incident.location.coordinates[1].toFixed(5)}, {incident.location.coordinates[0].toFixed(5)}
          </p>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold"
            style={{
              background: incident.location.confidenceScore >= 90 ? 'rgba(34,197,94,0.15)' : incident.location.confidenceScore >= 70 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
              color: incident.location.confidenceScore >= 90 ? '#22c55e' : incident.location.confidenceScore >= 70 ? '#eab308' : '#ef4444',
            }}>
            GPS {incident.location.confidenceScore}%
          </span>
        </div>
      </Section>

      {/* ── VITALS ── */}
      <Section>
        <SectionLabel icon={Activity} label="VITALS ASSESSMENT" color="text-red-400" />
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Conscious', value: incident.vitals.conscious, icon: Brain },
            { label: 'Breathing', value: incident.vitals.breathing, icon: Wind },
            { label: 'Bleeding', value: incident.vitals.bleeding, icon: Droplets },
          ].map(v => (
            <div key={v.label} className="bg-white/[0.03] p-2.5 rounded-lg text-center border border-white/5">
              <v.icon size={13} className={`mx-auto mb-1 ${v.value === false ? 'text-red-400' : 'text-neutral-500'}`} />
              <p className="text-[8px] text-neutral-500 uppercase font-mono tracking-wider">{v.label}</p>
              <p className={`font-bold text-[13px] mt-0.5 ${v.value === false ? 'text-red-400' : v.value === true ? 'text-emerald-400' : 'text-neutral-500'}`}>
                {v.value === null ? '—' : v.value ? 'YES' : 'NO'}
              </p>
            </div>
          ))}
        </div>

        {/* Hazards */}
        {incident.hazards.length > 0 && (
          <div className="mt-3">
            <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-wider mb-1">HAZARDS</p>
            <div className="flex flex-wrap gap-1">
              {incident.hazards.map((h, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
                  style={{ color: '#f97316', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}>
                  <ShieldAlert size={8} /> {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Injuries */}
        {incident.injuriesSymptoms.length > 0 && (
          <div className="mt-2">
            <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-wider mb-1">INJURIES / SYMPTOMS</p>
            <div className="flex flex-wrap gap-1">
              {incident.injuriesSymptoms.map((s, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-neutral-300 border border-white/10">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── AI DECISION SUPPORT ── */}
      <Section>
        <SectionLabel icon={Sparkles} label="AI DECISION SUPPORT" color="text-purple-400" />

        {/* Confidence bar */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${incident.aiTriage.confidence * 100}%`,
                background: incident.aiTriage.confidence >= 0.8 ? '#22c55e' : incident.aiTriage.confidence >= 0.6 ? '#eab308' : '#f97316',
                animation: 'confidence-fill 1s ease-out',
              }}
            />
          </div>
          <span className="text-[11px] font-bold font-mono"
            style={{ color: incident.aiTriage.confidence >= 0.8 ? '#22c55e' : incident.aiTriage.confidence >= 0.6 ? '#eab308' : '#f97316' }}>
            {confidencePercent(incident.aiTriage.confidence)}
          </span>
        </div>

        {/* Contributing factors */}
        {incident.aiTriage.contributingFactors.length > 0 && (
          <div className="mb-3">
            <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-wider mb-1">CONTRIBUTING FACTORS</p>
            <div className="flex flex-wrap gap-1">
              {incident.aiTriage.contributingFactors.map((f, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rationale */}
        <div className="bg-white/[0.03] p-3 rounded-lg border border-white/5">
          <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-wider mb-1">RATIONALE</p>
          <p className="italic text-neutral-300 text-[11px] leading-relaxed">&ldquo;{incident.aiTriage.rationaleNote}&rdquo;</p>
        </div>

        {/* Disclaimer */}
        <div className="mt-3 flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-lg p-2.5">
          <AlertCircle size={11} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-amber-300/70 leading-relaxed">
            AI provides decision support only. The human dispatcher maintains final operational authority.
          </p>
        </div>
      </Section>

      {/* ── CALLER VOICE REPORT & TRANSCRIPT ── */}
      {(incident.voiceReport || incident.relevantContext) && (
        <Section>
          <div className="flex items-center justify-between mb-2.5">
            <SectionLabel icon={FileText} label="CALLER VOICE REPORT" color="text-blue-400" />
            {incident.aiTriage?.confidence != null && (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                {Math.round(incident.aiTriage.confidence * 100)}% Accuracy
              </span>
            )}
          </div>

          {/* Audio / TTS Player */}
          <div className="flex items-center gap-2 mb-3">
            {incident.voiceReport?.audioUrl ? (
              <audio controls className="flex-1 h-8 rounded-lg" src={incident.voiceReport.audioUrl}>
                Your browser does not support the audio element.
              </audio>
            ) : (
              <button onClick={handleTTS}
                className="flex-1 py-2.5 px-3 bg-white/5 border border-white/10 rounded-lg text-[11px] text-neutral-300 hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                <Play size={12} /> Listen to Report (TTS)
              </button>
            )}
          </div>

          {/* Transcript card */}
          <div className="bg-white/[0.03] p-3 rounded-lg border border-white/5 relative group">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] text-neutral-300 leading-relaxed font-mono italic whitespace-pre-wrap flex-1">
                &ldquo;{incident.voiceReport?.transcriptionText || incident.relevantContext || 'No transcript available'}&rdquo;
              </p>
              <button onClick={handleCopy}
                className="shrink-0 px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] text-neutral-400 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1">
                {copied ? <><Check size={9} /> Copied</> : <><Copy size={9} /> Copy</>}
              </button>
            </div>
          </div>

          {/* Keywords */}
          {incident.injuriesSymptoms && incident.injuriesSymptoms.length > 0 && (
            <div className="mt-2.5">
              <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-wider mb-1">KEY TERMS</p>
              <div className="flex flex-wrap gap-1">
                {incident.injuriesSymptoms.map((term, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    {term}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── FIRST-AID PROTOCOL ── */}
      {incident.firstAidGuidance && (
        <Section>
          <SectionLabel icon={Stethoscope} label={incident.firstAidGuidance.title} color="text-emerald-400" />
          <p className="text-[10px] text-neutral-500 font-mono mb-2">{incident.firstAidGuidance.source}</p>
          <ol className="list-decimal list-inside space-y-1 text-neutral-300 mb-2">
            {incident.firstAidGuidance.steps.map((step, i) => (
              <li key={i} className="leading-relaxed text-[11px]">{step}</li>
            ))}
          </ol>
          {incident.firstAidGuidance.warnings.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/15 rounded-lg p-2.5 mt-2">
              <p className="text-[10px] font-bold text-red-400 mb-1">⚠ WARNINGS</p>
              {incident.firstAidGuidance.warnings.map((w, i) => (
                <p key={i} className="text-[10px] text-neutral-400 leading-relaxed">• {w}</p>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── DISPATCHER ACTIONS ── */}
      <div className="px-5 py-4 mt-auto shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        {/* Status advance button */}
        {next && !isResolved && onStatusUpdate && (
          <button onClick={handleStatusAdvance}
            className="w-full py-2.5 px-3 bg-white text-black font-bold text-[12px] rounded-lg hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 mb-2">
            <Send size={12} /> Mark as {STATUS_LABELS[next]}
          </button>
        )}

        {/* Collapse actions */}
        <button onClick={() => setShowActions(!showActions)}
          className="w-full flex items-center justify-between text-[9px] font-black tracking-widest text-neutral-500 uppercase hover:text-neutral-300 transition-colors py-1">
          <span>More Actions</span>
          {showActions ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>

        {showActions && (
          <div className="mt-3 space-y-3">
            {/* Urgency override */}
            {onUrgencyOverride && (
              <div>
                <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-wider mb-1">URGENCY OVERRIDE</p>
                <div className="flex gap-2">
                  <select value={overrideUrgency} onChange={e => setOverrideUrgency(e.target.value as UrgencyLevel | '')}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-neutral-200 outline-none">
                    <option value="">Select...</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                  <button onClick={handleOverride} disabled={!overrideUrgency}
                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] text-neutral-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    Apply
                  </button>
                </div>
                <input type="text" value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
                  placeholder="Override reason (optional)"
                  className="w-full mt-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-neutral-300 placeholder-neutral-600 outline-none" />
              </div>
            )}

            {/* Unit assignment */}
            {onAssignUnit && (
              <div>
                <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-wider mb-1">ASSIGN UNIT</p>
                <div className="flex gap-2">
                  <select value={assignUnit} onChange={e => setAssignUnit(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-neutral-200 outline-none">
                    <option value="">Select unit...</option>
                    <option value="AMBULANCE">🚑 Ambulance</option>
                    <option value="FIRE_TRUCK">🚒 Fire Engine</option>
                    <option value="PATROL">🚔 Patrol Unit</option>
                    <option value="RESCUE">🛟 Rescue Team</option>
                    <option value="HAZMAT">☢️ Hazmat</option>
                  </select>
                  <button onClick={handleAssign} disabled={!assignUnit}
                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[11px] text-neutral-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <UserPlus size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Assigned units */}
            {incident.assignedUnits.length > 0 && (
              <div>
                <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-wider mb-1">ASSIGNED UNITS</p>
                <div className="flex flex-wrap gap-1">
                  {incident.assignedUnits.map((u, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      {u}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Resolve incident */}
            {onResolve && !isResolved && (
              <div>
                <p className="text-[8px] font-mono text-neutral-500 uppercase tracking-wider mb-1">RESOLVE INCIDENT</p>
                {showResolve ? (
                  <div className="space-y-2">
                    <textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)}
                      placeholder="Resolution notes (optional)..."
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-neutral-300 placeholder-neutral-600 outline-none resize-y min-h-[60px]" />
                    <div className="flex gap-2">
                      <button onClick={() => { onResolve(incident.id, resolutionNotes); setShowResolve(false); setResolutionNotes(''); }}
                        className="flex-1 py-2 bg-emerald-500 text-black font-bold text-[11px] rounded-lg transition-all hover:bg-emerald-400">
                        Confirm Resolve
                      </button>
                      <button onClick={() => { setShowResolve(false); setResolutionNotes(''); }}
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[11px] text-neutral-400 hover:text-white transition-all">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowResolve(true)}
                    className="w-full py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[11px] font-bold transition-all hover:bg-emerald-500/20">
                    Resolve Incident
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

// Re-export Activity from lucide for lifecycle bar
import { Activity, MapPin } from 'lucide-react';

export default DispatchIncidentPanel;
