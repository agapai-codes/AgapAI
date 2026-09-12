'use client';

import { useState, useCallback } from 'react';
import {
  X, AlertTriangle, Zap, MapPin, Users, Clock, Sparkles,
  Brain, Wind, Droplets, Radio, Navigation, ShieldAlert, FileText,
  ChevronDown, ChevronRight, Activity, Target, Stethoscope, Send,
  CheckCircle2, UserPlus, AlertCircle
} from 'lucide-react';
import type { Incident, IncidentStatus, UrgencyLevel } from '../types/incident';
import type { TriageResult, UnitType } from '../types/triage';
import { getFirstAid, getFirstAidText } from '../lib/firstAid';

interface DispatchIncidentDetailsProps {
  incident: Incident;
  triageResult?: TriageResult;
  onClose: () => void;
  onStatusUpdate: (id: string, status: IncidentStatus) => void;
  onUrgencyOverride: (id: string, urgency: UrgencyLevel, reason?: string) => void;
  onAssign: (incidentId: string, responderId: string) => void;
  onResolve: (notes: string) => void;
}

const URGENCY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)' },
  high: { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.4)' },
  medium: { color: '#eab308', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.4)' },
  low: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.4)' },
};

const TYPE_CONFIG: Record<string, { color: string; icon: string }> = {
  FIRE: { color: '#ef4444', icon: '🔥' },
  ACCIDENT: { color: '#f97316', icon: '🚗' },
  MEDICAL: { color: '#3b82f6', icon: '🏥' },
  DISASTER: { color: '#a855f7', icon: '🌪️' },
  VIOLENCE: { color: '#f43f5e', icon: '⚠️' },
  HAZARDOUS: { color: '#facc15', icon: '☢️' },
  MISSING_PERSON: { color: '#06b6d4', icon: '🔍' },
};

const STATUS_STYLE: Record<IncidentStatus, { color: string; bg: string; border: string }> = {
  PENDING: { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
  REVIEWING: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  PRIORITIZED: { color: '#f472b6', bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.3)' },
  DISPATCHED: { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)' },
  EN_ROUTE: { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.3)' },
  ARRIVED: { color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.3)' },
  RESOLVED: { color: '#4ade80', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
};

const UNIT_TYPE_LABEL: Record<UnitType, string> = {
  ambulance: 'AMB',
  fire_truck: 'FIRE',
  police: 'PD',
  hazmat: 'HAZMAT',
  rescue: 'RESCUE',
  multi_agency: 'MULTI',
};

function generateSerialId(id: string): string {
  const short = id.replace(/-/g, '').slice(0, 8).toUpperCase();
  const year = new Date().getFullYear();
  return `INC-${year}-${short.slice(0, 4)}`;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  const day = d.getDate().toString().padStart(2, '0');
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${day}/${h}:${m}:${s}`;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function confidencePercent(c: number): string {
  return (c * 100).toFixed(1) + '%';
}

function getConfidenceColor(c: number): string {
  if (c >= 0.8) return '#22c55e';
  if (c >= 0.6) return '#eab308';
  if (c >= 0.4) return '#f97316';
  return '#ef4444';
}

function getConditionLabel(incident: Incident, triageResult?: TriageResult): string {
  if (triageResult?.condition) return triageResult.condition;
  if (incident.condition) return incident.condition;
  const desc = (incident.description || '').toLowerCase();
  if (desc.includes('fire') || desc.includes('blaze')) return 'Active Blaze';
  if (desc.includes('collision') || desc.includes('crash')) return 'Vehicle Collision';
  if (desc.includes('flood')) return 'Flooding';
  if (desc.includes('medical') || desc.includes('distress')) return 'Medical Emergency';
  return 'Under Assessment';
}

function getSiteHazards(incident: Incident): string[] {
  if (incident.hazards && incident.hazards.length > 0) return incident.hazards;
  const hazards: string[] = [];
  const desc = (incident.description || '').toLowerCase();
  if (desc.includes('electrical') || desc.includes('transformer') || desc.includes('cable')) hazards.push('Exposed Electrical Cables');
  if (desc.includes('gas') || desc.includes('leak')) hazards.push('Gas Leak Risk');
  if (desc.includes('structural') || desc.includes('collapse')) hazards.push('Structural Instability');
  if (desc.includes('chemical') || desc.includes('toxic')) hazards.push('Chemical Exposure');
  return hazards;
}

export default function DispatchIncidentDetails({
  incident,
  triageResult,
  onClose,
  onStatusUpdate,
  onUrgencyOverride,
  onAssign,
  onResolve,
}: DispatchIncidentDetailsProps) {
  const [resolveNotes, setResolveNotes] = useState('');
  const [showResolve, setShowResolve] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [pendingUrgency, setPendingUrgency] = useState<UrgencyLevel | null>(null);
  const [triageExpanded, setTriageExpanded] = useState(true);
  const [firstAidExpanded, setFirstAidExpanded] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  const urgency = URGENCY_STYLE[incident.urgency || 'medium'];
  const typeConfig = TYPE_CONFIG[incident.type] || { color: '#71717a', icon: '📋' };
  const status = STATUS_STYLE[incident.status] ?? { color: '#71717a', bg: 'rgba(113,113,122,0.12)', border: 'rgba(113,113,122,0.3)' };
  const serialId = generateSerialId(incident.id);
  const confidence = incident.confidence ?? 0.7;
  const condition = getConditionLabel(incident, triageResult);
  const hazards = getSiteHazards(incident);
  const recommendation = triageResult?.recommendation;
  const firstAidProtocol = getFirstAid(condition);

  const canDispatch = incident.status === 'PENDING' || incident.status === 'REVIEWING' || incident.status === 'PRIORITIZED';

  const withLoading = useCallback(async (fn: () => void | Promise<void>) => {
    setIsLoading(true);
    try {
      await fn();
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <aside
      className="w-[440px] min-w-[440px] max-w-[440px] h-full flex flex-col shrink-0 border-l border-zinc-800/50 bg-[#0d0f12] overflow-hidden z-20 animate-slide-in-right"
      role="dialog"
      aria-modal="true"
      aria-label={`Dispatch details for ${incident.description || incident.type}`}
    >
      {/* HEADER */}
      <div className="px-5 py-3.5 border-b border-zinc-800/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-base">{typeConfig.icon}</span>
          <div className="flex flex-col">
            <span className="text-[10px] font-black tracking-widest text-zinc-500 font-mono">{serialId}</span>
            <span className="text-[9px] font-mono text-zinc-600">DISPATCH PANEL</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Close dispatch panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {/* BADGES ROW */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-md border font-mono"
            style={{ color: typeConfig.color, backgroundColor: `${typeConfig.color}15`, borderColor: `${typeConfig.color}40` }}
          >
            {incident.type.replace('_', ' ')}
          </span>
          <span
            className="text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-md border font-mono"
            style={{ color: status.color, backgroundColor: status.bg, borderColor: status.border }}
          >
            {incident.status.replace('_', ' ')}
          </span>
          <span
            className="text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-md border font-mono"
            style={{ color: urgency.color, backgroundColor: urgency.bg, borderColor: urgency.border }}
          >
            {incident.urgency || 'medium'}
          </span>
        </div>

        {/* DESCRIPTION */}
        <div>
          <h2 className="text-base font-black tracking-tight text-zinc-100 leading-tight">
            {incident.description || 'Incident Report'}
          </h2>
        </div>

        {/* METADATA GRID: TYPE, URGENCY, CONDITION, PEOPLE, LOCATION, GPS */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-2.5">
            <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mb-0.5 font-mono">TYPE</p>
            <p className="text-xs font-bold font-mono" style={{ color: typeConfig.color }}>{incident.type.replace('_', ' ')}</p>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-2.5">
            <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mb-0.5 font-mono">URGENCY</p>
            <p className="text-xs font-bold font-mono" style={{ color: urgency.color }}>{(incident.urgency || 'medium').toUpperCase()}</p>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-2.5">
            <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mb-0.5 font-mono">CONDITION</p>
            <p className="text-xs font-bold text-zinc-200 truncate">{condition}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-2.5 flex items-center gap-2">
            <Users size={12} className="text-zinc-500 shrink-0" />
            <div>
              <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase font-mono">PEOPLE</p>
              <p className="text-xs font-bold text-zinc-200">{incident.people_affected || 1}</p>
            </div>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-2.5 flex items-center gap-2">
            <Clock size={12} className="text-zinc-500 shrink-0" />
            <div>
              <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase font-mono">TIME</p>
              <p className="text-xs font-mono text-zinc-200">{timeAgo(incident.timestamp)}</p>
            </div>
          </div>
        </div>

        {/* LOCATION */}
        <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
          <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mb-1.5 font-mono">LOCATION</p>
          <div className="flex items-start gap-2">
            <MapPin size={12} className="text-zinc-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-zinc-200">{incident.location}</p>
              <p className="text-[9px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1">
                <Navigation size={8} />
                {incident.coordinates?.lat?.toFixed(6) ?? '—'}, {incident.coordinates?.lng?.toFixed(6) ?? '—'}
              </p>
            </div>
          </div>
        </div>

        {/* VITALS ROW: CONSCIOUSNESS, BREATHING, BLEEDING */}
        <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
          <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mb-2 font-mono">VITALS ASSESSMENT</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-md border border-zinc-800/30">
              <Brain size={14} className={`mx-auto mb-1 ${incident.consciousness === false ? 'text-red-400' : 'text-zinc-500'}`} />
              <p className="text-[8px] font-black tracking-wider text-zinc-500 uppercase font-mono">CONSCIOUS</p>
              <p className={`text-xs font-bold mt-0.5 ${incident.consciousness === false ? 'text-red-400' : incident.consciousness === true ? 'text-green-400' : 'text-zinc-400'}`}>
                {incident.consciousness === false ? 'NO' : incident.consciousness === true ? 'YES' : '—'}
              </p>
            </div>
            <div className="text-center p-2 rounded-md border border-zinc-800/30">
              <Wind size={14} className={`mx-auto mb-1 ${incident.breathing === false ? 'text-red-400' : 'text-zinc-500'}`} />
              <p className="text-[8px] font-black tracking-wider text-zinc-500 uppercase font-mono">BREATHING</p>
              <p className={`text-xs font-bold mt-0.5 ${incident.breathing === false ? 'text-red-400' : incident.breathing === true ? 'text-green-400' : 'text-zinc-400'}`}>
                {incident.breathing === false ? 'NO' : incident.breathing === true ? 'YES' : '—'}
              </p>
            </div>
            <div className="text-center p-2 rounded-md border border-zinc-800/30">
              <Droplets size={14} className={`mx-auto mb-1 ${incident.bleeding ? 'text-red-400' : 'text-zinc-500'}`} />
              <p className="text-[8px] font-black tracking-wider text-zinc-500 uppercase font-mono">BLEEDING</p>
              <p className={`text-xs font-bold mt-0.5 ${incident.bleeding ? 'text-red-400' : 'text-green-400'}`}>
                {incident.bleeding ? 'YES' : 'NO'}
              </p>
            </div>
          </div>
        </div>

        {/* HAZARDS */}
        {hazards.length > 0 && (
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
            <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mb-2 font-mono">SITE HAZARDS</p>
            <div className="flex flex-wrap gap-1.5">
              {hazards.map((h, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border font-mono"
                  style={{ color: '#f97316', background: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.4)' }}>
                  <ShieldAlert size={9} /> {h}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* AI CONFIDENCE */}
        <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
          <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mb-1.5 font-mono flex items-center gap-1.5">
            <Sparkles size={10} /> AI CONFIDENCE
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${confidence * 100}%`,
                  background: getConfidenceColor(confidence),
                }}
              />
            </div>
            <span className="text-xs font-bold font-mono" style={{ color: getConfidenceColor(confidence) }}>
              {confidencePercent(confidence)}
            </span>
          </div>
          {confidence < 0.5 && (
            <div className="mt-2 bg-amber-500/10 border border-amber-500/40 rounded px-2.5 py-1.5 flex items-center gap-2">
              <AlertTriangle size={12} className="text-amber-400 shrink-0" />
              <p className="text-[9px] font-bold text-amber-300 font-mono">LOW CONFIDENCE — Manual review recommended</p>
            </div>
          )}
        </div>

        {/* TRIAGE ANALYSIS & RATIONALE */}
        {recommendation && (
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
            <button
              type="button"
              onClick={() => setTriageExpanded(!triageExpanded)}
              className="w-full flex items-center justify-between cursor-pointer bg-transparent border-none p-0"
            >
              <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase font-mono flex items-center gap-1.5">
                <Target size={10} /> TRIAGE ANALYSIS
              </p>
              {triageExpanded ? (
                <ChevronDown size={12} className="text-zinc-500" />
              ) : (
                <ChevronRight size={12} className="text-zinc-500" />
              )}
            </button>
            {triageExpanded && (
              <div className="mt-2.5 space-y-2.5">
                {/* Severity + Priority Scores */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-zinc-950/60 border border-zinc-800/30 rounded p-2 text-center">
                    <p className="text-[8px] font-black tracking-wider text-zinc-500 uppercase font-mono">SEVERITY</p>
                    <p className="text-lg font-black font-mono" style={{ color: recommendation.severity_score >= 7 ? '#ef4444' : recommendation.severity_score >= 4 ? '#f97316' : '#22c55e' }}>
                      {recommendation.severity_score.toFixed(1)}
                    </p>
                    <p className="text-[8px] text-zinc-600 font-mono">/ 10</p>
                  </div>
                  <div className="bg-zinc-950/60 border border-zinc-800/30 rounded p-2 text-center">
                    <p className="text-[8px] font-black tracking-wider text-zinc-500 uppercase font-mono">PRIORITY</p>
                    <p className="text-lg font-black font-mono" style={{ color: recommendation.dispatch_priority_score >= 70 ? '#ef4444' : recommendation.dispatch_priority_score >= 40 ? '#f97316' : '#22c55e' }}>
                      {recommendation.dispatch_priority_score}
                    </p>
                    <p className="text-[8px] text-zinc-600 font-mono">/ 100</p>
                  </div>
                </div>

                {/* Recommended Units */}
                {recommendation.recommended_units.length > 0 && (
                  <div>
                    <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mb-1 font-mono">RECOMMENDED UNITS</p>
                    <div className="flex flex-wrap gap-1.5">
                      {recommendation.recommended_units.map((unit, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border font-mono"
                          style={{ color: '#60a5fa', background: 'rgba(96,165,250,0.12)', borderColor: 'rgba(96,165,250,0.4)' }}>
                          <Radio size={9} /> {UNIT_TYPE_LABEL[unit]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Triage Flags */}
                {recommendation.triage_flags.length > 0 && (
                  <div>
                    <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mb-1 font-mono">FLAGS</p>
                    <div className="flex flex-wrap gap-1.5">
                      {recommendation.triage_flags.map((flag, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border font-mono"
                          style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.3)' }}>
                          <AlertCircle size={8} /> {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Response Actions */}
                {recommendation.response_actions.length > 0 && (
                  <div>
                    <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mb-1 font-mono">RESPONSE ACTIONS</p>
                    <div className="space-y-1.5">
                      {recommendation.response_actions.map((action, i) => (
                        <div key={i} className="bg-zinc-950/60 border border-zinc-800/30 rounded p-2">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded font-mono ${
                              action.priority === 'immediate' ? 'text-red-400 bg-red-500/10' :
                              action.priority === 'secondary' ? 'text-amber-400 bg-amber-500/10' :
                              'text-zinc-400 bg-zinc-800/30'
                            }`}>
                              {action.priority}
                            </span>
                            <span className="text-[10px] font-bold text-zinc-200">{action.label}</span>
                          </div>
                          <p className="text-[9px] text-zinc-400 font-mono leading-snug">{action.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Escalation */}
                {recommendation.escalation_needed && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-2.5 flex items-start gap-2">
                    <AlertTriangle size={12} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] font-bold text-red-400 font-mono uppercase">Escalation Required</p>
                      {recommendation.escalation_reason && (
                        <p className="text-[9px] text-red-300/70 font-mono mt-0.5">{recommendation.escalation_reason}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* ETA */}
                <div className="bg-zinc-950/60 border border-zinc-800/30 rounded p-2 flex items-center gap-2">
                  <Clock size={10} className="text-zinc-500" />
                  <p className="text-[9px] font-mono text-zinc-400">
                    EST. RESPONSE: <span className="text-zinc-200 font-bold">{recommendation.estimated_response_time_minutes} min</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TRANSCRIPT */}
        {incident.transcript && (
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
            <button
              type="button"
              onClick={() => setTranscriptExpanded(!transcriptExpanded)}
              className="w-full flex items-center justify-between cursor-pointer bg-transparent border-none p-0"
            >
              <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase font-mono flex items-center gap-1.5">
                <FileText size={10} /> TRANSCRIPT
              </p>
              {transcriptExpanded ? (
                <ChevronDown size={12} className="text-zinc-500" />
              ) : (
                <ChevronRight size={12} className="text-zinc-500" />
              )}
            </button>
            {transcriptExpanded && (
              <div className="mt-2 bg-[#0a0c10] border border-zinc-800/30 rounded p-3 max-h-40 overflow-y-auto">
                <p className="text-[11px] text-zinc-300 leading-relaxed font-mono italic">
                  &ldquo;{incident.transcript}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}

        {/* FIRST-AID GUIDANCE */}
        <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
          <button
            type="button"
            onClick={() => setFirstAidExpanded(!firstAidExpanded)}
            className="w-full flex items-center justify-between cursor-pointer bg-transparent border-none p-0"
          >
            <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase font-mono flex items-center gap-1.5">
              <Stethoscope size={10} /> FIRST-AID GUIDANCE
            </p>
            {firstAidExpanded ? (
              <ChevronDown size={12} className="text-zinc-500" />
            ) : (
              <ChevronRight size={12} className="text-zinc-500" />
            )}
          </button>
          {firstAidExpanded && (
            <div className="mt-2.5 space-y-2">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded p-2.5">
                <p className="text-[10px] font-bold text-emerald-400 font-mono uppercase mb-1.5">{firstAidProtocol.title}</p>
                <ol className="space-y-1.5">
                  {firstAidProtocol.steps.map((step, i) => (
                    <li key={i} className="text-[10px] text-zinc-300 font-mono flex gap-1.5">
                      <span className="text-emerald-500/70 shrink-0">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              {firstAidProtocol.warnings.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded p-2.5">
                  <p className="text-[9px] font-bold text-amber-400 font-mono uppercase mb-1">WARNINGS</p>
                  {firstAidProtocol.warnings.map((warn, i) => (
                    <p key={i} className="text-[9px] text-zinc-400 font-mono flex gap-1.5 mb-0.5">
                      <span className="text-amber-500/70 shrink-0">•</span> {warn}
                    </p>
                  ))}
                </div>
              )}
              <p className="text-[8px] text-zinc-600 font-mono">Source: {firstAidProtocol.source}</p>
            </div>
          )}
        </div>

        {/* ASSIGNED RESPONDER */}
        {incident.assigned_responder_name && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex items-center gap-3">
            <Radio size={14} className="text-blue-400 shrink-0" />
            <div>
              <p className="text-[8px] font-black tracking-widest text-blue-400/70 uppercase font-mono">ASSIGNED RESPONDER</p>
              <p className="text-xs font-semibold text-blue-300">{incident.assigned_responder_name}</p>
            </div>
          </div>
        )}

      </div>

      {/* ACTION CONTROLS FOOTER */}
      <div className="px-5 py-4 border-t border-zinc-800/50 shrink-0 space-y-2">
        {/* Primary Actions */}
        <div className="grid grid-cols-2 gap-2">
          {canDispatch && (
            <button
              onClick={() => withLoading(() => onStatusUpdate(incident.id, 'DISPATCHED'))}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider py-2.5 rounded-lg border-none flex items-center justify-center gap-1.5 transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AlertTriangle size={12} />
              DISPATCH UNIT
            </button>
          )}
          {incident.status === 'DISPATCHED' && (
            <button
              onClick={() => withLoading(() => onStatusUpdate(incident.id, 'EN_ROUTE'))}
              disabled={isLoading}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-black uppercase tracking-wider py-2.5 rounded-lg border border-zinc-700 flex items-center justify-center gap-1.5 transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={11} /> EN ROUTE
            </button>
          )}
          {incident.status === 'EN_ROUTE' && (
            <button
              onClick={() => withLoading(() => onStatusUpdate(incident.id, 'ARRIVED'))}
              disabled={isLoading}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-black uppercase tracking-wider py-2.5 rounded-lg border border-zinc-700 flex items-center justify-center gap-1.5 transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={11} /> ARRIVED
            </button>
          )}
          <button
            onClick={() => {
              const priorities: UrgencyLevel[] = ['critical', 'high', 'medium', 'low'];
              const currentIdx = priorities.indexOf(incident.urgency || 'medium');
              const nextPriority = priorities[(currentIdx + 1) % priorities.length];
              setPendingUrgency(nextPriority);
              setShowOverrideInput(true);
            }}
            disabled={isLoading}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[10px] font-black uppercase tracking-wider py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap size={12} />
            PRIORITY: {(incident.urgency || 'medium').toUpperCase()}
          </button>
        </div>

        {/* Assign + Resolve */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowAssign(!showAssign)}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 text-[9px] font-bold uppercase tracking-wider py-2 rounded-lg transition-colors font-mono flex items-center justify-center gap-1.5"
          >
            <UserPlus size={11} /> ASSIGN
          </button>
          {incident.status !== 'RESOLVED' && (
            <button
              onClick={() => setShowResolve(!showResolve)}
              className="bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 text-[9px] font-bold uppercase tracking-wider py-2 rounded-lg transition-colors font-mono flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={11} /> RESOLVE
            </button>
          )}
        </div>

        {/* Override Reason Panel */}
        {showOverrideInput && pendingUrgency && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 space-y-2 animate-slide-up">
            <p className="text-[9px] text-zinc-500 font-mono uppercase">
              Override to <span className="font-bold" style={{ color: URGENCY_STYLE[pendingUrgency]?.color }}>{pendingUrgency}</span>?
            </p>
            <input
              type="text"
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="Reason for override..."
              className="w-full bg-[#0a0c10] border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 outline-none font-mono"
              autoFocus
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => {
                  withLoading(() => onUrgencyOverride(incident.id, pendingUrgency, overrideReason || undefined));
                  setShowOverrideInput(false);
                  setOverrideReason('');
                  setPendingUrgency(null);
                }}
                type="button"
                className="flex-1 py-1.5 rounded text-[10px] font-bold border-none cursor-pointer bg-zinc-700 text-white hover:bg-zinc-600 transition-colors font-mono"
              >
                Confirm
              </button>
              <button
                onClick={() => { setShowOverrideInput(false); setOverrideReason(''); setPendingUrgency(null); }}
                type="button"
                className="py-1.5 px-3 rounded text-[10px] border border-zinc-800 cursor-pointer bg-transparent text-zinc-500 hover:bg-zinc-800 transition-colors font-mono"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Assign Panel */}
        {showAssign && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 space-y-1 animate-slide-up">
            <p className="text-[9px] text-zinc-500 font-mono uppercase mb-1.5">Select responder:</p>
            <button
              onClick={() => { onAssign(incident.id, 'auto'); setShowAssign(false); }}
              type="button"
              className="w-full text-left py-1.5 px-2 rounded border-none cursor-pointer text-[11px] flex justify-between transition-colors font-mono"
              style={{ background: 'rgba(96,165,250,0.08)', color: '#60a5fa' }}
            >
              <span>Auto-assign best available</span>
              <span className="text-[9px]">AUTO</span>
            </button>
          </div>
        )}

        {/* Resolve Panel */}
        {showResolve && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 space-y-2 animate-slide-up">
            <p className="text-[9px] text-zinc-500 font-mono uppercase">Resolution notes:</p>
            <textarea
              value={resolveNotes}
              onChange={e => setResolveNotes(e.target.value)}
              placeholder="What was done, outcome..."
              className="w-full bg-[#0a0c10] border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 outline-none resize-y min-h-[50px] font-mono"
            />
            <div className="flex gap-1.5">
              <button onClick={() => { onResolve(resolveNotes); setShowResolve(false); setResolveNotes(''); }}
                type="button"
                className="flex-1 py-1.5 rounded text-[10px] font-bold border-none cursor-pointer bg-emerald-600 text-white hover:bg-emerald-500 transition-colors font-mono">
                Confirm
              </button>
              <button onClick={() => { setShowResolve(false); setResolveNotes(''); }}
                type="button"
                className="py-1.5 px-3 rounded text-[10px] border border-zinc-800 cursor-pointer bg-transparent text-zinc-500 hover:bg-zinc-800 transition-colors font-mono">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
