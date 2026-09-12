'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X, AlertTriangle, Zap, MapPin, Users, Clock, Sparkles,
  Brain, Wind, Droplets, Radio, Navigation, ShieldAlert, FileText,
  ChevronDown, ChevronRight, History, Link2
} from 'lucide-react';
import type { Incident, UrgencyLevel, IncidentStatus } from '../types/incident';

type HistoryEntry = {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
};

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

interface IncidentDrawerProps {
  incident: Incident;
  responders: { id: string; name: string; status: string }[];
  onClose: () => void;
  onSelectIncident: (incident: Incident) => void;
  onStatusUpdate: (id: string, status: IncidentStatus) => void;
  onUrgencyOverride: (id: string, urgency: UrgencyLevel, reason?: string) => void;
  onAssign: (incidentId: string, responderId: string) => void;
  onResolve: (notes: string) => void;
  getRelated: (id: string) => Promise<Incident[] | null>;
  getHistory: (id: string) => Promise<HistoryEntry[] | null>;
}

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

function getConditionLabel(incident: Incident): string {
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

export default function IncidentDrawer({
  incident,
  responders,
  onClose,
  onSelectIncident,
  onStatusUpdate,
  onUrgencyOverride,
  onAssign,
  onResolve,
  getRelated,
  getHistory,
}: IncidentDrawerProps) {
  const [resolveNotes, setResolveNotes] = useState('');
  const [showResolve, setShowResolve] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [relatedIncidents, setRelatedIncidents] = useState<Incident[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [relatedExpanded, setRelatedExpanded] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [pendingUrgency, setPendingUrgency] = useState<UrgencyLevel | null>(null);

  const urgency = URGENCY_STYLE[incident.urgency || 'medium'];
  const typeConfig = TYPE_CONFIG[incident.type] || { color: '#71717a', icon: '📋' };
  const status = STATUS_STYLE[incident.status] ?? { color: '#71717a', bg: 'rgba(113,113,122,0.12)', border: 'rgba(113,113,122,0.3)' };
  const serialId = generateSerialId(incident.id);
  const confidence = incident.confidence ?? 0.7;
  const condition = getConditionLabel(incident);
  const hazards = getSiteHazards(incident);

  const canDispatch = incident.status === 'PENDING' || incident.status === 'REVIEWING' || incident.status === 'PRIORITIZED';

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch related incidents on demand
  useEffect(() => {
    if (!relatedExpanded) return;
    setLoadingRelated(true);
    getRelated(incident.id).then((data) => {
      setRelatedIncidents(data || []);
    }).catch(() => {
      setRelatedIncidents([]);
    }).finally(() => {
      setLoadingRelated(false);
    });
  }, [incident.id, relatedExpanded, getRelated]);

  // Fetch history on expand
  useEffect(() => {
    if (!historyExpanded) return;
    setLoadingHistory(true);
    getHistory(incident.id).then((data) => {
      setHistory(data || []);
    }).catch(() => {
      setHistory([]);
    }).finally(() => {
      setLoadingHistory(false);
    });
  }, [incident.id, historyExpanded, getHistory]);

  // Loading wrapper for async actions
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
      className="w-[420px] min-w-[420px] max-w-[420px] h-full flex flex-col shrink-0 border-l border-zinc-800/50 bg-[#0d0f12] overflow-hidden z-20 animate-slide-in-right"
      role="dialog"
      aria-modal="true"
      aria-label={`Incident details for ${incident.description || incident.type}`}
    >

      {/* ── DRAWER HEADER ── */}
      <div className="px-5 py-4 border-b border-zinc-800/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-base">{typeConfig.icon}</span>
          <span className="text-[10px] font-black tracking-widest text-zinc-500 font-mono">{serialId}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-zinc-800/80 text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label="Close drawer"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* ── TYPE + STATUS BADGES ── */}
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

        {/* ── INCIDENT TITLE ── */}
        <div>
          <h2 className="text-lg font-black tracking-tight text-zinc-100 leading-tight">
            {incident.description || 'Incident Report'}
          </h2>
        </div>

        {/* ── CONDITION / STATUS ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
            <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase mb-1 font-mono">CONDITION</p>
            <p className="text-sm font-semibold text-zinc-200">{condition}</p>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
            <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase mb-1 font-mono">STATUS</p>
            <p className="text-sm font-semibold" style={{ color: status.color }}>{incident.status.replace('_', ' ')}</p>
          </div>
        </div>

        {/* ── INJURIES / SYMPTOMS ── */}
        <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
          <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase mb-2 font-mono">INJURIES / SYMPTOMS</p>
          <div className="flex flex-wrap gap-1.5">
            {incident.bleeding && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border font-mono"
                style={{ color: '#ef4444', background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)' }}>
                <Droplets size={10} /> BLEEDING
              </span>
            )}
            {incident.consciousness === false && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border font-mono"
                style={{ color: '#ef4444', background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)' }}>
                <Brain size={10} /> UNCONSCIOUS
              </span>
            )}
            {incident.breathing === false && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border font-mono"
                style={{ color: '#ef4444', background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)' }}>
                <Wind size={10} /> NOT BREATHING
              </span>
            )}
            {!incident.bleeding && incident.consciousness !== false && incident.breathing !== false && (
              <span className="text-[10px] text-zinc-500 font-mono">No visible injuries reported</span>
            )}
          </div>
        </div>

        {/* ── CONSCIOUSNESS / BREATHING / BLEEDING ── */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-2.5 text-center">
            <Brain size={14} className={`mx-auto mb-1 ${incident.consciousness === false ? 'text-red-400' : 'text-zinc-500'}`} />
            <p className="text-[8px] font-black tracking-wider text-zinc-500 uppercase font-mono">CONSCIOUS</p>
            <p className={`text-xs font-bold mt-0.5 ${incident.consciousness === false ? 'text-red-400' : incident.consciousness === true ? 'text-green-400' : 'text-zinc-400'}`}>
              {incident.consciousness === false ? 'NO' : incident.consciousness === true ? 'YES' : '—'}
            </p>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-2.5 text-center">
            <Wind size={14} className={`mx-auto mb-1 ${incident.breathing === false ? 'text-red-400' : 'text-zinc-500'}`} />
            <p className="text-[8px] font-black tracking-wider text-zinc-500 uppercase font-mono">BREATHING</p>
            <p className={`text-xs font-bold mt-0.5 ${incident.breathing === false ? 'text-red-400' : incident.breathing === true ? 'text-green-400' : 'text-zinc-400'}`}>
              {incident.breathing === false ? 'NO' : incident.breathing === true ? 'YES' : '—'}
            </p>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-2.5 text-center">
            <Droplets size={14} className={`mx-auto mb-1 ${incident.bleeding ? 'text-red-400' : 'text-zinc-500'}`} />
            <p className="text-[8px] font-black tracking-wider text-zinc-500 uppercase font-mono">BLEEDING</p>
            <p className={`text-xs font-bold mt-0.5 ${incident.bleeding ? 'text-red-400' : 'text-green-400'}`}>
              {incident.bleeding ? 'YES' : 'NO'}
            </p>
          </div>
        </div>

        {/* ── PEOPLE AFFECTED ── */}
        <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3 flex items-center gap-3">
          <Users size={14} className="text-zinc-500 shrink-0" />
          <div>
            <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase font-mono">PEOPLE AFFECTED</p>
            <p className="text-sm font-semibold text-zinc-200">{incident.people_affected || 1} {incident.people_affected === 1 ? 'person' : 'people'}</p>
          </div>
        </div>

        {/* ── LOCATION ── */}
        <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
          <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase mb-1.5 font-mono">LOCATION</p>
          <div className="flex items-start gap-2">
            <MapPin size={12} className="text-zinc-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-zinc-200">{incident.location}</p>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1">
                <Navigation size={9} />
                {incident.coordinates?.lat?.toFixed(6) ?? '—'}, {incident.coordinates?.lng?.toFixed(6) ?? '—'}
              </p>
            </div>
          </div>
        </div>

        {/* ── HAZARDS ── */}
        {hazards.length > 0 && (
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
            <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase mb-2 font-mono">SITE HAZARDS</p>
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

        {/* ── CONTEXT / TRANSCRIPT ── */}
        {incident.transcript && (
          <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
            <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase mb-1.5 font-mono flex items-center gap-1.5">
              <FileText size={10} /> CALLER REMARKS
            </p>
            <p className="text-xs text-zinc-300 leading-relaxed italic font-mono">&ldquo;{incident.transcript}&rdquo;</p>
          </div>
        )}

        {/* ── REPORT TIME ── */}
        <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3 flex items-center gap-3">
          <Clock size={14} className="text-zinc-500 shrink-0" />
          <div>
            <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase font-mono">TIME REPORTED</p>
            <p className="text-sm font-semibold text-zinc-200 font-mono">{formatTime(incident.timestamp)}</p>
            <p className="text-[10px] text-zinc-500 font-mono">{timeAgo(incident.timestamp)}</p>
          </div>
        </div>

        {/* ── LOW AI CONFIDENCE WARNING ── */}
        {confidence < 0.5 && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg px-3 py-2.5 flex items-center gap-2.5">
            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
            <p className="text-[11px] font-bold text-amber-300 font-mono leading-tight">
              LOW AI CONFIDENCE — Manual review recommended
            </p>
          </div>
        )}

        {/* ── LOCATION CONFIDENCE ── */}
        <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
          <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase mb-1.5 font-mono flex items-center gap-1.5">
            <Sparkles size={10} /> AI LOCATION CONFIDENCE
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
            <span className="text-sm font-bold font-mono" style={{ color: getConfidenceColor(confidence) }}>
              {confidencePercent(confidence)}
            </span>
          </div>
        </div>

        {/* ── ASSIGNED RESPONDER ── */}
        {incident.assigned_responder_name && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex items-center gap-3">
            <Radio size={14} className="text-blue-400 shrink-0" />
            <div>
              <p className="text-[9px] font-black tracking-widest text-blue-400/70 uppercase font-mono">ASSIGNED RESPONDER</p>
              <p className="text-sm font-semibold text-blue-300">{incident.assigned_responder_name}</p>
            </div>
          </div>
        )}

        {/* ── RELATED INCIDENTS ── */}
        <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
          <button
            onClick={() => setRelatedExpanded(!relatedExpanded)}
            className="w-full text-left text-[9px] font-black tracking-widest text-zinc-500 uppercase mb-2 font-mono flex items-center gap-1.5 hover:text-zinc-300 transition-colors"
          >
            <Link2 size={10} /> RELATED INCIDENTS
            <span className="ml-auto text-zinc-600">{relatedExpanded ? '▾' : '▸'}</span>
          </button>
          {relatedExpanded && (
            loadingRelated ? (
              <p className="text-[10px] text-zinc-500 font-mono">Loading...</p>
            ) : relatedIncidents.length === 0 ? (
              <p className="text-[10px] text-zinc-500 font-mono">No related incidents found</p>
            ) : (
              <div className="space-y-1.5">
                {relatedIncidents.map((ri) => {
                  const riType = TYPE_CONFIG[ri.type] || { color: '#71717a', icon: '📋' };
                  const riStatus = STATUS_STYLE[ri.status] ?? { color: '#71717a', bg: 'rgba(113,113,122,0.12)', border: 'rgba(113,113,122,0.3)' };
                  return (
                    <div
                      key={ri.id}
                      className="bg-zinc-950/60 border border-zinc-800/30 rounded-md p-2 cursor-pointer hover:border-zinc-700/60 transition-colors"
                      onClick={() => onSelectIncident(ri)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs">{riType.icon}</span>
                        <span
                          className="text-[8px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded border font-mono"
                          style={{ color: riType.color, backgroundColor: `${riType.color}15`, borderColor: `${riType.color}40` }}
                        >
                          {ri.type.replace('_', ' ')}
                        </span>
                        <span
                          className="text-[8px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded border font-mono"
                          style={{ color: riStatus.color, backgroundColor: riStatus.bg, borderColor: riStatus.border }}
                        >
                          {ri.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate font-mono">{ri.location}</p>
                      <p className="text-[9px] text-zinc-600 font-mono">{timeAgo(ri.timestamp)}</p>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* ── ACTIVITY LOG (AUDIT HISTORY) ── */}
        <div className="bg-zinc-900/40 border border-zinc-800/40 rounded-lg p-3">
          <button
            type="button"
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="w-full flex items-center justify-between cursor-pointer bg-transparent border-none p-0"
          >
            <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase font-mono flex items-center gap-1.5">
              <History size={10} /> ACTIVITY LOG
            </p>
            {historyExpanded ? (
              <ChevronDown size={12} className="text-zinc-500" />
            ) : (
              <ChevronRight size={12} className="text-zinc-500" />
            )}
          </button>
          {historyExpanded && (
            <div className="mt-2.5 space-y-0 relative">
              {loadingHistory ? (
                <p className="text-[10px] text-zinc-500 font-mono">Loading history...</p>
              ) : history.length === 0 ? (
                <p className="text-[10px] text-zinc-500 font-mono">No history available</p>
              ) : (
                <>
                  {/* Vertical timeline line */}
                  <div className="absolute left-[5px] top-2 bottom-2 w-px bg-zinc-800" />
                  {history.map((entry) => (
                    <div key={entry.id} className="flex gap-2.5 py-1.5 relative">
                      {/* Dot */}
                      <div className="w-[11px] h-[11px] rounded-full border-2 border-zinc-700 bg-zinc-950 shrink-0 mt-0.5 z-10" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {entry.old_status && (
                            <span className="text-[8px] font-bold font-mono text-zinc-500">
                              {entry.old_status.replace('_', ' ')}
                            </span>
                          )}
                          {entry.old_status && (
                            <span className="text-[8px] text-zinc-600">&rarr;</span>
                          )}
                          <span className="text-[8px] font-bold font-mono text-zinc-300">
                            {entry.new_status.replace('_', ' ')}
                          </span>
                        </div>
                        {entry.changed_by && (
                          <p className="text-[9px] text-zinc-500 font-mono mt-0.5">
                            by {entry.changed_by}
                          </p>
                        )}
                        {entry.notes && (
                          <p className="text-[9px] text-zinc-400 font-mono mt-0.5 italic">
                            &ldquo;{entry.notes}&rdquo;
                          </p>
                        )}
                        <p className="text-[8px] text-zinc-600 font-mono mt-0.5">
                          {formatTime(entry.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

      </div>

      {/* ── ACTION CONTROLS FOOTER ── */}
      <div className="px-5 py-4 border-t border-zinc-800/50 shrink-0 space-y-2">

        {/* Primary Actions */}
        <div className="grid grid-cols-2 gap-2">
          {canDispatch && (
            <button
              onClick={() => withLoading(() => onStatusUpdate(incident.id, 'DISPATCHED'))}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-wider py-2.5 rounded-lg border-none flex items-center justify-center gap-1.5 transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AlertTriangle size={13} />
              DISPATCH UNIT
            </button>
          )}
          {incident.status === 'DISPATCHED' && (
            <button
              onClick={() => withLoading(() => onStatusUpdate(incident.id, 'EN_ROUTE'))}
              disabled={isLoading}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-black uppercase tracking-wider py-2.5 rounded-lg border border-zinc-700 flex items-center justify-center gap-1.5 transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
            >
              EN ROUTE
            </button>
          )}
          {incident.status === 'EN_ROUTE' && (
            <button
              onClick={() => withLoading(() => onStatusUpdate(incident.id, 'ARRIVED'))}
              disabled={isLoading}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-black uppercase tracking-wider py-2.5 rounded-lg border border-zinc-700 flex items-center justify-center gap-1.5 transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ARRIVED
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
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[11px] font-black uppercase tracking-wider py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap size={13} />
            PRIORITY: {(incident.urgency || 'medium').toUpperCase()}
          </button>
        </div>

        {/* Assign + Resolve */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowAssign(!showAssign)}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg transition-colors font-mono"
          >
            ASSIGN RESPONDER
          </button>
          {incident.status !== 'RESOLVED' && (
            <button
              onClick={() => setShowResolve(!showResolve)}
              className="bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg transition-colors font-mono"
            >
              RESOLVE INCIDENT
            </button>
          )}
        </div>

        {/* Override Reason Panel */}
        {showOverrideInput && pendingUrgency && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 space-y-2 animate-slide-up">
            <p className="text-[9px] text-zinc-500 font-mono uppercase">
              Why override to <span className="font-bold" style={{ color: URGENCY_STYLE[pendingUrgency]?.color }}>{pendingUrgency}</span> urgency?
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
            {responders.map(r => (
              <button key={r.id} onClick={() => { onAssign(incident.id, r.id); setShowAssign(false); }}
                type="button"
                className="w-full text-left py-1.5 px-2 rounded border-none cursor-pointer text-[11px] flex justify-between transition-colors font-mono"
                style={{
                  background: r.status === 'available' ? 'rgba(34,197,94,0.08)' : 'transparent',
                  color: r.status === 'available' ? '#4ade80' : '#52525b',
                }}>
                <span>{r.name}</span>
                <span className="text-[9px]" style={{ color: r.status === 'available' ? '#22c55e' : '#ef4444' }}>{r.status}</span>
              </button>
            ))}
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
