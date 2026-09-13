'use client';

import React, { useState } from 'react';
import {
  X, Clock, Sparkles, Brain, Wind,
  Droplets, ShieldAlert, FileText, ChevronDown, ChevronRight,
  Stethoscope, Send, UserPlus, AlertCircle
} from 'lucide-react';
import type { IncidentReport, UrgencyLevel, IncidentStatus } from '../types/incident';
import { STATUS_LABELS, STATUS_ORDER, URGENCY_PRIORITY, canTransition, nextStatus } from '../types/incident';

interface DispatchIncidentPanelProps {
  incident: IncidentReport;
  onClose: () => void;
  onStatusUpdate?: (id: string, status: IncidentStatus) => void;
  onUrgencyOverride?: (id: string, urgency: UrgencyLevel, reason: string) => void;
  onAssignUnit?: (id: string, unit: string) => void;
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

export const DispatchIncidentPanel: React.FC<DispatchIncidentPanelProps> = ({
  incident,
  onClose,
  onStatusUpdate,
  onUrgencyOverride,
  onAssignUnit,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [overrideUrgency, setOverrideUrgency] = useState<UrgencyLevel | ''>('');
  const [overrideReason, setOverrideReason] = useState('');
  const [assignUnit, setAssignUnit] = useState('');

  const urgStyle = URGENCY_STYLE[incident.urgency];
  const typeConfig = TYPE_CONFIG[incident.type] || { color: '#71717a', icon: '📋' };
  const next = nextStatus(incident.status);
  const isResolved = incident.status === 'RESOLVED';

  const handleStatusAdvance = () => {
    if (next && onStatusUpdate) {
      onStatusUpdate(incident.id, next);
    }
  };

  const handleOverride = () => {
    if (overrideUrgency && onUrgencyOverride) {
      onUrgencyOverride(incident.id, overrideUrgency as UrgencyLevel, overrideReason || `Dispatcher override at ${new Date().toLocaleTimeString()}`);
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

  return (
    <aside className="w-[420px] bg-neutral-950 text-white border-l border-neutral-800 h-full flex flex-col z-20 shadow-2xl overflow-y-auto shrink-0">
      {/* ── HEADER ── */}
      <div className="p-4 border-b border-neutral-800 flex justify-between items-start sticky top-0 bg-neutral-950 z-10">
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-mono tracking-widest text-neutral-500 uppercase">INCIDENT DETAILS</p>
          <h2 className="text-base font-bold mt-1 text-neutral-100 truncate">{incident.condition}</h2>
          <p className="text-[10px] text-neutral-500 font-mono mt-0.5">{incident.id}</p>
        </div>
        <button onClick={onClose} className="text-neutral-400 hover:text-white text-lg px-2 py-0.5 rounded border border-neutral-800 hover:bg-neutral-800 transition-colors ml-2 shrink-0">
          ✕
        </button>
      </div>

      {/* ── STATUS LIFECYCLE BAR ── */}
      <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900/30">
        <p className="text-[9px] font-black tracking-widest text-neutral-500 uppercase mb-2">LIFECYCLE</p>
        <div className="flex items-center gap-0.5">
          {(['PENDING', 'REVIEWING', 'PRIORITIZED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'RESOLVED'] as IncidentStatus[]).map((s) => {
            const currentIdx = STATUS_ORDER[incident.status];
            const thisIdx = STATUS_ORDER[s];
            const isPast = thisIdx < currentIdx;
            const isCurrent = thisIdx === currentIdx;
            return (
              <React.Fragment key={s}>
                <div className={`flex flex-col items-center ${isCurrent ? 'scale-110' : ''}`}>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold border-2 transition-all ${
                      isPast ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : isCurrent ? 'bg-white/10 border-white text-white'
                      : 'bg-neutral-900 border-neutral-700 text-neutral-600'
                    }`}
                  >
                    {isPast ? '✓' : thisIdx + 1}
                  </div>
                  <span className={`text-[7px] mt-0.5 font-mono ${isCurrent ? 'text-white' : isPast ? 'text-emerald-400' : 'text-neutral-600'}`}>
                    {STATUS_LABELS[s]}
                  </span>
                </div>
                {s !== 'RESOLVED' && (
                  <div className={`flex-1 h-0.5 ${isPast ? 'bg-emerald-500' : 'bg-neutral-700'} mb-3`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── METADATA GRID ── */}
      <div className="grid grid-cols-3 gap-2 p-4 bg-neutral-900/30 border-b border-neutral-800 text-xs">
        <div>
          <span className="text-neutral-500 uppercase block text-[9px] font-mono">TYPE</span>
          <span className="font-semibold text-neutral-200 flex items-center gap-1 mt-0.5">
            <span>{typeConfig.icon}</span> {incident.type.replace('_', ' ')}
          </span>
        </div>
        <div>
          <span className="text-neutral-500 uppercase block text-[9px] font-mono">URGENCY</span>
          <span className="font-bold mt-0.5 inline-block px-2 py-0.5 rounded-full text-[10px]"
            style={{ color: urgStyle.color, background: urgStyle.bg, border: `1px solid ${urgStyle.border}` }}>
            {incident.urgency}
          </span>
        </div>
        <div>
          <span className="text-neutral-500 uppercase block text-[9px] font-mono">PEOPLE</span>
          <span className="font-semibold text-neutral-200 mt-0.5 block">{incident.peopleCount}</span>
        </div>
      </div>

      {/* ── LOCATION & GPS CONFIDENCE ── */}
      <div className="p-4 border-b border-neutral-800 text-xs">
        <span className="text-neutral-500 uppercase block text-[9px] font-mono mb-1">LOCATION &amp; COORDINATES</span>
        <p className="font-medium text-neutral-200">{incident.location.landmarkText}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="font-mono text-neutral-400 text-[11px]">
            {incident.location.coordinates[1].toFixed(5)}, {incident.location.coordinates[0].toFixed(5)}
          </p>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
            style={{
              background: incident.location.confidenceScore >= 90 ? 'rgba(34,197,94,0.12)' : incident.location.confidenceScore >= 70 ? 'rgba(234,179,8,0.12)' : 'rgba(239,68,68,0.12)',
              color: incident.location.confidenceScore >= 90 ? '#22c55e' : incident.location.confidenceScore >= 70 ? '#eab308' : '#ef4444',
            }}>
            GPS {confidencePercent(incident.location.confidenceScore)}
          </span>
        </div>
      </div>

      {/* ── VITALS & HAZARDS ── */}
      <div className="p-4 border-b border-neutral-800 text-xs">
        <span className="text-neutral-500 uppercase block text-[9px] font-mono mb-2">VITALS ASSESSMENT</span>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Conscious', value: incident.vitals.conscious, icon: Brain },
            { label: 'Breathing', value: incident.vitals.breathing, icon: Wind },
            { label: 'Bleeding', value: incident.vitals.bleeding, icon: Droplets },
          ].map(v => (
            <div key={v.label} className="bg-neutral-900 p-2 rounded text-center border border-neutral-800/50">
              <v.icon size={12} className={`mx-auto mb-1 ${v.value === false ? 'text-red-400' : 'text-neutral-500'}`} />
              <p className="text-[8px] text-neutral-400 uppercase font-mono">{v.label}</p>
              <p className={`font-bold text-sm ${v.value === false ? 'text-red-400' : v.value === true ? 'text-emerald-400' : 'text-neutral-500'}`}>
                {v.value === null ? '—' : v.value ? 'YES' : 'NO'}
              </p>
            </div>
          ))}
        </div>
        {incident.hazards.length > 0 && (
          <div>
            <p className="text-[9px] font-mono text-neutral-500 uppercase mb-1">HAZARDS</p>
            <div className="flex flex-wrap gap-1">
              {incident.hazards.map((h, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border"
                  style={{ color: '#f97316', background: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.4)' }}>
                  <ShieldAlert size={9} /> {h}
                </span>
              ))}
            </div>
          </div>
        )}
        {incident.injuriesSymptoms.length > 0 && (
          <div className="mt-2">
            <p className="text-[9px] font-mono text-neutral-500 uppercase mb-1">INJURIES / SYMPTOMS</p>
            <div className="flex flex-wrap gap-1">
              {incident.injuriesSymptoms.map((s, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── AI DECISION SUPPORT ── */}
      <div className="p-4 border-b border-neutral-800 text-xs">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={12} className="text-purple-400" />
          <span className="text-[9px] font-black tracking-widest text-purple-400 uppercase">AI DECISION SUPPORT</span>
        </div>

        {/* Confidence Score */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${incident.aiTriage.confidence * 100}%`,
                background: incident.aiTriage.confidence >= 0.8 ? '#22c55e' : incident.aiTriage.confidence >= 0.6 ? '#eab308' : '#f97316',
              }}
            />
          </div>
          <span className="text-xs font-bold font-mono"
            style={{ color: incident.aiTriage.confidence >= 0.8 ? '#22c55e' : incident.aiTriage.confidence >= 0.6 ? '#eab308' : '#f97316' }}>
            {confidencePercent(incident.aiTriage.confidence)}
          </span>
        </div>

        {/* Contributing Factors */}
        {incident.aiTriage.contributingFactors.length > 0 && (
          <div className="mb-3">
            <p className="text-[9px] font-mono text-neutral-500 uppercase mb-1">CONTRIBUTING FACTORS</p>
            <div className="flex flex-wrap gap-1">
              {incident.aiTriage.contributingFactors.map((f, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950/40 text-purple-300 border border-purple-800/40">
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Rationale */}
        <div className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-800">
          <p className="text-[9px] font-mono text-neutral-500 uppercase mb-1">RATIONALE</p>
          <p className="italic text-neutral-300 text-[11px] leading-relaxed">&ldquo;{incident.aiTriage.rationaleNote}&rdquo;</p>
        </div>

        {/* Disclaimer */}
        <div className="mt-3 flex items-start gap-2 bg-amber-950/20 border border-amber-900/30 rounded-lg p-2.5">
          <AlertCircle size={12} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-amber-300/80 leading-relaxed">
            AI provides decision support only. The human dispatcher maintains final operational authority.
          </p>
        </div>
      </div>

      {/* ── CALLER VOICE REPORT & TRANSCRIPT ── */}
      {(incident.voiceReport || incident.relevantContext) && (
        <div className="p-4 border-b border-neutral-800 text-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={12} className="text-blue-400" />
              <span className="text-[9px] font-black tracking-widest text-blue-400 uppercase">Caller Voice Report &amp; Transcript</span>
            </div>
            {incident.aiTriage?.confidence != null && (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-blue-950/40 text-blue-300 border border-blue-800/40">
                {Math.round(incident.aiTriage.confidence * 100)}% Accuracy
              </span>
            )}
          </div>

          {/* Audio / TTS Player */}
          <div className="flex items-center gap-2 mb-3">
            {incident.voiceReport?.audioUrl ? (
              <audio controls className="flex-1 h-8" src={incident.voiceReport.audioUrl}>
                Your browser does not support the audio element.
              </audio>
            ) : (
              <button
                onClick={() => {
                  if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(
                      incident.voiceReport?.transcriptionText || incident.relevantContext || ''
                    );
                    utterance.rate = 0.9;
                    utterance.pitch = 1;
                    window.speechSynthesis.speak(utterance);
                  }
                }}
                className="flex-1 py-2 px-3 bg-neutral-800 border border-neutral-700 rounded-lg text-[11px] text-neutral-300 hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
                Listen to Report (TTS)
              </button>
            )}
          </div>

          {/* Verbatim Transcript Card */}
          <div className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-800 relative group">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] text-neutral-300 leading-relaxed font-mono italic whitespace-pre-wrap flex-1">
                &ldquo;{incident.voiceReport?.transcriptionText || incident.relevantContext || 'No transcript available'}&rdquo;
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    incident.voiceReport?.transcriptionText || incident.relevantContext || ''
                  );
                }}
                className="shrink-0 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-[9px] text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors opacity-0 group-hover:opacity-100"
              >
                Copy
              </button>
            </div>
          </div>

          {/* Extracted Keywords / Entities */}
          {incident.voiceReport?.extractedEntities && Object.keys(incident.voiceReport.extractedEntities).length > 0 && (
            <div className="mt-3">
              <p className="text-[9px] font-mono text-neutral-500 uppercase mb-1.5">Extracted Keywords</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(incident.voiceReport.extractedEntities).map(([key, val], i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950/40 text-blue-300 border border-blue-800/40 font-mono">
                    {key}: {String(val)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {incident.injuriesSymptoms && incident.injuriesSymptoms.length > 0 && (
            <div className="mt-2">
              <p className="text-[9px] font-mono text-neutral-500 uppercase mb-1.5">Key Terms</p>
              <div className="flex flex-wrap gap-1">
                {incident.injuriesSymptoms.map((term, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/40 text-amber-300 border border-amber-800/40">
                    {term}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FIRST-AID PROTOCOL ── */}
      {incident.firstAidGuidance && (
        <div className="p-4 border-b border-neutral-800 text-xs">
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope size={12} className="text-emerald-400" />
            <span className="text-[9px] font-black tracking-widest text-emerald-400 uppercase">{incident.firstAidGuidance.title}</span>
          </div>
          <p className="text-[10px] text-neutral-500 font-mono mb-2">{incident.firstAidGuidance.source}</p>
          <ol className="list-decimal list-inside space-y-1 text-neutral-300 mb-2">
            {incident.firstAidGuidance.steps.map((step, i) => (
              <li key={i} className="leading-relaxed text-[11px]">{step}</li>
            ))}
          </ol>
          {incident.firstAidGuidance.warnings.length > 0 && (
            <div className="bg-red-950/30 border border-red-900/30 rounded-lg p-2.5 mt-2">
              <p className="text-[10px] font-bold text-red-400 mb-1">⚠ WARNINGS</p>
              {incident.firstAidGuidance.warnings.map((w, i) => (
                <p key={i} className="text-[10px] text-neutral-400 leading-relaxed">• {w}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── RESPONSE ACTIONS TOOLBAR ── */}
      <div className="p-4 border-b border-neutral-800 text-xs">
        <button
          onClick={() => setShowActions(!showActions)}
          className="w-full flex items-center justify-between text-[9px] font-black tracking-widest text-neutral-400 uppercase hover:text-neutral-200 transition-colors"
        >
          <span>DISPATCHER ACTIONS</span>
          {showActions ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {showActions && (
          <div className="mt-3 space-y-3">
            {/* Status Advance */}
            {next && !isResolved && onStatusUpdate && (
              <div>
                <p className="text-[9px] font-mono text-neutral-500 uppercase mb-1">ADVANCE STATUS</p>
                <button
                  onClick={handleStatusAdvance}
                  className="w-full py-2 px-3 bg-white text-black font-bold text-xs rounded-lg hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Send size={12} /> Mark as {STATUS_LABELS[next]}
                </button>
              </div>
            )}

            {/* Urgency Override */}
            {onUrgencyOverride && (
              <div>
                <p className="text-[9px] font-mono text-neutral-500 uppercase mb-1">URGENCY OVERRIDE</p>
                <div className="flex gap-2">
                  <select
                    value={overrideUrgency}
                    onChange={e => setOverrideUrgency(e.target.value as UrgencyLevel | '')}
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-neutral-200 outline-none"
                  >
                    <option value="">Select...</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                  <button
                    onClick={handleOverride}
                    disabled={!overrideUrgency}
                    className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Apply
                  </button>
                </div>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="Override reason (optional)"
                  className="w-full mt-1.5 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-[11px] text-neutral-300 placeholder-neutral-600 outline-none"
                />
              </div>
            )}

            {/* Unit Assignment */}
            {onAssignUnit && (
              <div>
                <p className="text-[9px] font-mono text-neutral-500 uppercase mb-1">ASSIGN UNIT</p>
                <div className="flex gap-2">
                  <select
                    value={assignUnit}
                    onChange={e => setAssignUnit(e.target.value)}
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-neutral-200 outline-none"
                  >
                    <option value="">Select unit...</option>
                    <option value="AMBULANCE">🚑 Ambulance</option>
                    <option value="FIRE_TRUCK">🚒 Fire Engine</option>
                    <option value="PATROL">🚔 Patrol Unit</option>
                    <option value="RESCUE">🛟 Rescue Team</option>
                    <option value="HAZMAT">☢️ Hazmat</option>
                  </select>
                  <button
                    onClick={handleAssign}
                    disabled={!assignUnit}
                    className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <UserPlus size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Assigned Units */}
            {incident.assignedUnits.length > 0 && (
              <div>
                <p className="text-[9px] font-mono text-neutral-500 uppercase mb-1">ASSIGNED UNITS</p>
                <div className="flex flex-wrap gap-1">
                  {incident.assignedUnits.map((u, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950/40 text-blue-300 border border-blue-800/40">
                      {u}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RELEVANT CONTEXT ── */}
      {incident.relevantContext && (
        <div className="p-4 border-b border-neutral-800 text-xs">
          <span className="text-[9px] font-mono text-neutral-500 uppercase mb-1 block">RELEVANT CONTEXT</span>
          <p className="text-neutral-300 leading-relaxed text-[11px]">{incident.relevantContext}</p>
        </div>
      )}

      {/* ── TIMESTAMP ── */}
      <div className="p-4 mt-auto text-[10px] text-neutral-500 flex items-center gap-1.5">
        <Clock size={10} />
        Reported: {new Date(incident.timeReported).toLocaleString()} ({timeAgo(incident.timeReported)})
      </div>
    </aside>
  );
};

export default DispatchIncidentPanel;
