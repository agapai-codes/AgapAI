'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Toaster, toast } from 'sonner';
import LiveMap from '../components/LiveMap';
import { useIncidents } from '../hooks/useIncidents';
import { useAuth } from '../hooks/useAuth';
import { getFirstAid } from '../lib/firstAid';
import { Search, ArrowLeft, Shield, CheckCircle2, AlertTriangle, ShieldAlert, Activity, MapPin, Users, Clock, History, Edit3, UserPlus, Link2 } from 'lucide-react';
import type { Incident, IncidentStatus, UrgencyLevel } from '../types/incident';

const INCIDENT_ICONS: Record<string, string> = { FIRE: '🔥', ACCIDENT: '🚗', MEDICAL: '🏥', DISASTER: '🌪️', VIOLENCE: '⚠️', HAZARDOUS: '☢️', MISSING_PERSON: '🔍' };

const TYPE_CONFIG: Record<string, { color: string }> = {
  FIRE: { color: '#ef4444' },
  ACCIDENT: { color: '#f97316' },
  MEDICAL: { color: '#3b82f6' },
  DISASTER: { color: '#a855f7' },
  VIOLENCE: { color: '#f43f5e' },
  HAZARDOUS: { color: '#facc15' },
  MISSING_PERSON: { color: '#06b6d4' },
};

const URGENCY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const URGENCY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
  high: { color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' },
  medium: { color: '#eab308', bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)' },
  low: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)' },
};

const STATUS_STYLE: Record<IncidentStatus, { color: string; border: string; bg: string }> = {
  PENDING: { color: '#fbbf24', border: 'rgba(245,158,11,0.2)', bg: 'rgba(245,158,11,0.05)' },
  REVIEWING: { color: '#a78bfa', border: 'rgba(167,139,250,0.2)', bg: 'rgba(167,139,250,0.05)' },
  PRIORITIZED: { color: '#f472b6', border: 'rgba(244,114,182,0.2)', bg: 'rgba(244,114,182,0.05)' },
  DISPATCHED: { color: '#60a5fa', border: 'rgba(96,165,250,0.2)', bg: 'rgba(96,165,250,0.05)' },
  EN_ROUTE: { color: '#38bdf8', border: 'rgba(56,189,248,0.2)', bg: 'rgba(56,189,248,0.05)' },
  ARRIVED: { color: '#818cf8', border: 'rgba(129,140,248,0.2)', bg: 'rgba(129,140,248,0.05)' },
  RESOLVED: { color: '#4ade80', border: 'rgba(34,197,94,0.2)', bg: 'rgba(34,197,94,0.05)' },
};

const ALL_TYPES = ['All', 'FIRE', 'ACCIDENT', 'MEDICAL', 'DISASTER', 'VIOLENCE', 'HAZARDOUS', 'MISSING_PERSON'];
const ALL_URGENCIES: UrgencyLevel[] = ['critical', 'high', 'medium', 'low'];

interface Responder {
  id: string;
  name: string;
  email: string;
  status: string;
}

interface StatusHistoryEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

function confidenceBar(c: number): { color: string; label: string } {
  if (c >= 0.8) return { color: '#22c55e', label: 'HIGH' };
  if (c >= 0.6) return { color: '#eab308', label: 'MEDIUM' };
  if (c >= 0.4) return { color: '#f97316', label: 'LOW' };
  return { color: '#ef4444', label: 'VERY LOW' };
}

export default function DispatcherDashboard() {
  const { user } = useAuth();
  const { incidents, loading, error, isLive, refresh, updateStatus, updateUrgency, getHistory, assignResponder, resolveIncident, getRelated, getResponders } = useIncidents();
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingUrgency, setEditingUrgency] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState<string | null>(null);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [relatedIncidents, setRelatedIncidents] = useState<Incident[]>([]);
  const [showRelated, setShowRelated] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [showResolve, setShowResolve] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTime(new Date().toLocaleTimeString());
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load responders when assignment dropdown opens
  useEffect(() => {
    if (showAssign) {
      getResponders().then(setResponders);
    }
  }, [showAssign, getResponders]);

  const metrics = useMemo(() => ({
    total: incidents.length,
    critical: incidents.filter(i => i.urgency === 'critical' && i.status !== 'RESOLVED').length,
    dispatched: incidents.filter(i => i.status === 'DISPATCHED').length,
    resolved: incidents.filter(i => i.status === 'RESOLVED').length,
  }), [incidents]);

  const filtered = useMemo(() => {
    return incidents
      .filter(i => {
        const ms = i.location.toLowerCase().includes(search.toLowerCase()) ||
          i.type.toLowerCase().includes(search.toLowerCase()) ||
          (i.condition || '').toLowerCase().includes(search.toLowerCase()) ||
          (i.description || '').toLowerCase().includes(search.toLowerCase());
        const mt = selectedType === 'All' || i.type === selectedType;
        return ms && mt;
      })
      .sort((a, b) => {
        const ua = URGENCY_ORDER[a.urgency || 'medium'] ?? 3;
        const ub = URGENCY_ORDER[b.urgency || 'medium'] ?? 3;
        if (ua !== ub) return ua - ub;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
  }, [incidents, search, selectedType]);

  const handleStatusUpdate = async (id: string, status: IncidentStatus) => {
    const updated = await updateStatus(id, status);
    if (updated) {
      setActiveIncident(updated);
      toast.success(`Incident marked ${status}`);
    } else {
      toast.error('Failed to update incident');
    }
  };

  const handleUrgencyOverride = async (id: string, urgency: UrgencyLevel) => {
    const updated = await updateUrgency(id, urgency, `Dispatcher override at ${new Date().toLocaleTimeString()}`);
    if (updated) {
      setActiveIncident(updated);
      setEditingUrgency(null);
      toast.success(`Urgency updated to ${urgency}`);
    } else {
      toast.error('Failed to update urgency');
    }
  };

  const handleAssign = async (incidentId: string, responderId: string) => {
    const updated = await assignResponder(incidentId, responderId);
    if (updated) {
      setActiveIncident(updated);
      setShowAssign(null);
      toast.success('Responder assigned');
    } else {
      toast.error('Failed to assign responder');
    }
  };

  const handleResolve = async () => {
    if (!activeIncident) return;
    const updated = await resolveIncident(activeIncident.id, resolveNotes || 'Resolved by dispatcher');
    if (updated) {
      setActiveIncident(updated);
      setShowResolve(false);
      setResolveNotes('');
      toast.success('Incident resolved');
    } else {
      toast.error('Failed to resolve incident');
    }
  };

  const loadHistory = useCallback(async (id: string) => {
    setHistoryLoading(true);
    setShowHistory(true);
    const data = await getHistory(id);
    setHistory(data || []);
    setHistoryLoading(false);
  }, [getHistory]);

  const loadRelated = useCallback(async (inc: Incident) => {
    setShowRelated(true);
    const data = await getRelated(inc.id);
    setRelatedIncidents(data || []);
  }, [getRelated]);

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
  };

  return (
    <div style={{ height: '100vh', width: '100%', background: '#09090b', color: '#fafafa', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
      <Toaster position="top-right" theme="dark" />

      {/* HEADER */}
      <header style={{ width: '100%', height: '56px', borderBottom: '1px solid #18181b', background: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image src="/logo.jpg" alt="AgapAI" width={28} height={28} style={{ borderRadius: '8px' }} />
          <span style={{ fontWeight: 900, fontSize: '18px', letterSpacing: '0.05em', color: '#f4f4f5', textTransform: 'uppercase' }}>
            Agap<span style={{ color: '#ef4444' }}>AI</span>
          </span>
          <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', padding: '2px 8px', borderRadius: '4px', background: isLive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: isLive ? '#22c55e' : '#f87171', border: `1px solid ${isLive ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
            {loading ? 'SYNCING' : isLive ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', fontFamily: 'monospace', color: '#a1a1aa' }}>
          {user && (
            <span style={{ color: '#71717a' }}>
              <Shield size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              {user.role}
            </span>
          )}
          <button onClick={refresh} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(24,24,27,0.8)', border: '1px solid #27272a', borderRadius: '6px', color: '#a1a1aa', cursor: 'pointer', fontFamily: 'monospace', fontSize: '12px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isLive ? '#22c55e' : '#71717a' }} />
            <span style={{ color: '#71717a' }}>MODE:</span> COMMANDER
          </button>
          {mounted && <span>{time}</span>}
          <a href="/" style={{ color: '#71717a', textDecoration: 'none' }}><ArrowLeft size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Citizen</a>
        </div>
      </header>

      {/* METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '16px', background: '#09090b', flexShrink: 0, borderBottom: '1px solid #18181b', zIndex: 20 }}>
        {[
          { label: 'TOTAL INCIDENTS', value: metrics.total, icon: Activity, color: '#f4f4f5' },
          { label: 'CRITICAL / HIGH', value: metrics.critical, icon: ShieldAlert, color: '#ef4444' },
          { label: 'UNITS DISPATCHED', value: metrics.dispatched, icon: AlertTriangle, color: '#60a5fa' },
          { label: 'CASES RESOLVED', value: metrics.resolved, icon: CheckCircle2, color: '#22c55e' },
        ].map(m => (
          <div key={m.label} style={{ background: 'rgba(24,24,27,0.4)', backdropFilter: 'blur(12px)', border: '1px solid #27272a', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            <div>
              <p style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', color: '#71717a', textTransform: 'uppercase' }}>{m.label}</p>
              <h3 style={{ fontSize: '24px', fontWeight: 900, marginTop: '4px', color: m.color }}>{m.value}</h3>
            </div>
            <m.icon size={20} style={{ color: m.color, opacity: 0.6 }} />
          </div>
        ))}
      </div>

      {/* MAIN 2-COLUMN LAYOUT */}
      <div style={{ flex: 1, display: 'flex', width: '100%', height: 'calc(100vh - 180px)', overflow: 'hidden', position: 'relative', background: '#09090b' }}>

        {/* SIDEBAR */}
        <div style={{ width: '420px', height: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #18181b', background: '#09090b', zIndex: 20, overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #18181b', background: 'rgba(9,9,11,0.8)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
              <input placeholder="Search incidents, conditions, locations..." value={search} onChange={e => setSearch(e.target.value)} aria-label="Search incidents"
                style={{ paddingLeft: '36px', background: '#18181b', border: '1px solid #27272a', color: '#e4e4e7', height: '40px', width: '100%', borderRadius: '8px', outline: 'none', fontSize: '13px' }} />
            </div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              {ALL_TYPES.map(type => (
                <button key={type} onClick={() => setSelectedType(type)} aria-pressed={selectedType === type}
                  style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', flexShrink: 0, background: selectedType === type ? '#f4f4f5' : '#18181b', color: selectedType === type ? '#09090b' : '#a1a1aa' }}>
                  {type === 'All' ? type : type.replace('_', ' ')}
                </button>
              ))}
            </div>
            {error && <p style={{ marginTop: '10px', fontSize: '11px', color: '#f87171' }}>{error} — showing cached data</p>}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#52525b', padding: '48px 0', fontSize: '14px' }}>No active telemetry matches.</div>
            ) : filtered.map(inc => {
              const config = TYPE_CONFIG[inc.type] || { color: '#71717a' };
              const status = STATUS_STYLE[inc.status];
              const urgency = URGENCY_STYLE[inc.urgency || 'medium'];
              const isSelected = activeIncident?.id === inc.id;
              const conf = inc.confidence != null ? confidenceBar(inc.confidence) : null;

              return (
                <div key={inc.id} onClick={() => { setActiveIncident(inc); setShowHistory(false); setShowRelated(false); setShowResolve(false); }}
                  role="button" tabIndex={0} aria-label={`${inc.type} incident at ${inc.location}`}
                  onKeyDown={e => e.key === 'Enter' && setActiveIncident(inc)}
                  style={{ background: 'rgba(24,24,27,0.4)', border: `1px solid ${isSelected ? '#3f3f46' : '#27272a'}`, borderLeft: `4px solid ${urgency.color}`, borderRadius: '12px', padding: '14px', cursor: 'pointer', transition: 'all 0.15s', boxShadow: isSelected ? '0 0 20px rgba(0,0,0,0.3)' : 'none' }}>

                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '16px' }}>{INCIDENT_ICONS[inc.type] || '📋'}</span>
                    <span style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: config.color }}>{inc.type.replace('_', ' ')}</span>
                    <span style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '6px', border: `1px solid ${status.border}`, color: status.color, background: status.bg }}>{inc.status}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '6px', border: `1px solid ${urgency.border}`, color: urgency.color, background: urgency.bg, cursor: 'pointer', position: 'relative' }}
                      onClick={(e) => { e.stopPropagation(); setEditingUrgency(editingUrgency === inc.id ? null : inc.id); }}>
                      {inc.urgency || 'medium'}
                      {editingUrgency === inc.id && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '6px', zIndex: 30, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '100px' }} onClick={e => e.stopPropagation()}>
                          {ALL_URGENCIES.map(u => (
                            <button key={u} onClick={(e) => { e.stopPropagation(); handleUrgencyOverride(inc.id, u); }}
                              style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', textAlign: 'left', background: u === (inc.urgency || 'medium') ? URGENCY_STYLE[u].bg : 'transparent', color: URGENCY_STYLE[u].color }}>
                              {u.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      )}
                    </span>
                  </div>

                  <p style={{ fontSize: '12px', color: '#d4d4d8', lineHeight: 1.5, marginBottom: '6px' }}>{inc.description}</p>

                  {/* Condition + People + Confidence */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {inc.condition && (
                      <span style={{ fontSize: '10px', color: '#a1a1aa', background: 'rgba(39,39,42,0.6)', padding: '2px 6px', borderRadius: '4px' }}>
                        <Edit3 size={9} style={{ marginRight: '3px', verticalAlign: 'middle' }} />{inc.condition}
                      </span>
                    )}
                    {inc.people_affected && inc.people_affected > 1 && (
                      <span style={{ fontSize: '10px', color: '#a1a1aa', background: 'rgba(39,39,42,0.6)', padding: '2px 6px', borderRadius: '4px' }}>
                        <Users size={9} style={{ marginRight: '3px', verticalAlign: 'middle' }} />{inc.people_affected}
                      </span>
                    )}
                    {conf && (
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: `${conf.color}15`, color: conf.color, border: `1px solid ${conf.color}30` }}>
                        AI {conf.label} ({Math.round((inc.confidence || 0) * 100)}%)
                      </span>
                    )}
                  </div>

                  {/* Vitals */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    {inc.consciousness === false && <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>UNCONSCIOUS</span>}
                    {inc.breathing === false && <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>NOT BREATHING</span>}
                    {inc.bleeding && <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>BLEEDING</span>}
                  </div>

                  {/* Hazards */}
                  {inc.hazards && inc.hazards.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      {inc.hazards.slice(0, 3).map((h, i) => (
                        <span key={i} style={{ fontSize: '9px', fontWeight: 600, padding: '1px 6px', borderRadius: '9999px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>{h}</span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '10px', color: '#71717a', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={10} />{inc.location}</span>
                    <span style={{ fontSize: '9px', color: '#52525b', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={9} />{timeAgo(inc.timestamp)}</span>
                  </div>

                  {/* Assigned responder badge */}
                  {inc.assigned_responder_name && (
                    <div style={{ marginTop: '6px', fontSize: '10px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <UserPlus size={10} /> Assigned: {inc.assigned_responder_name}
                    </div>
                  )}

                  {/* Selected: expanded actions */}
                  {isSelected && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #27272a' }}>
                      {inc.urgency_reason && <p style={{ fontSize: '11px', color: '#71717a', marginBottom: '10px', fontStyle: 'italic' }}><span style={{ color: urgency.color, fontWeight: 600 }}>AI:</span> {inc.urgency_reason}</p>}

                      {/* Action buttons — status flow */}
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        {inc.status === 'PENDING' && (
                          <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(inc.id, 'REVIEWING'); }}
                            style={{ flex: 1, padding: '7px', borderRadius: '6px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', border: 'none', cursor: 'pointer', background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
                            Review
                          </button>
                        )}
                        {inc.status === 'REVIEWING' && (
                          <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(inc.id, 'PRIORITIZED'); }}
                            style={{ flex: 1, padding: '7px', borderRadius: '6px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', border: 'none', cursor: 'pointer', background: 'rgba(244,114,182,0.15)', color: '#f472b6' }}>
                            Prioritize
                          </button>
                        )}
                        {(inc.status === 'PRIORITIZED' || inc.status === 'REVIEWING' || inc.status === 'PENDING') && (
                          <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(inc.id, 'DISPATCHED'); }}
                            style={{ flex: 1, padding: '7px', borderRadius: '6px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', border: 'none', cursor: 'pointer', background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>
                            Dispatch
                          </button>
                        )}
                        {inc.status === 'DISPATCHED' && (
                          <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(inc.id, 'EN_ROUTE'); }}
                            style={{ flex: 1, padding: '7px', borderRadius: '6px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', border: 'none', cursor: 'pointer', background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>
                            En Route
                          </button>
                        )}
                        {inc.status === 'EN_ROUTE' && (
                          <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(inc.id, 'ARRIVED'); }}
                            style={{ flex: 1, padding: '7px', borderRadius: '6px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', border: 'none', cursor: 'pointer', background: 'rgba(129,140,248,0.15)', color: '#818cf8' }}>
                            Arrived
                          </button>
                        )}
                        {inc.status !== 'RESOLVED' && (
                          <button onClick={(e) => { e.stopPropagation(); setShowResolve(true); }}
                            style={{ flex: 1, padding: '7px', borderRadius: '6px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', border: 'none', cursor: 'pointer', background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
                            Resolve
                          </button>
                        )}
                      </div>

                      {/* Utility buttons */}
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        {inc.status !== 'RESOLVED' && (
                          <button onClick={(e) => { e.stopPropagation(); setShowAssign(inc.id); }}
                            style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '9px', border: '1px solid #27272a', cursor: 'pointer', background: 'rgba(24,24,27,0.6)', color: '#71717a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <UserPlus size={11} /> Assign
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); loadHistory(inc.id); }}
                          style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '9px', border: '1px solid #27272a', cursor: 'pointer', background: 'rgba(24,24,27,0.6)', color: '#71717a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <History size={11} /> History
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); loadRelated(inc); }}
                          style={{ padding: '6px 10px', borderRadius: '6px', fontSize: '9px', border: '1px solid #27272a', cursor: 'pointer', background: 'rgba(24,24,27,0.6)', color: '#71717a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Link2 size={11} /> Related
                        </button>
                      </div>

                      {/* Assignment dropdown */}
                      {showAssign === inc.id && (
                        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '8px', marginBottom: '8px' }}>
                          <p style={{ fontSize: '10px', color: '#71717a', marginBottom: '6px' }}>Assign responder:</p>
                          {responders.map(r => (
                            <button key={r.id} onClick={(e) => { e.stopPropagation(); handleAssign(inc.id, r.id); }}
                              style={{ width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: r.status === 'available' ? 'rgba(34,197,94,0.05)' : 'transparent', color: r.status === 'available' ? '#4ade80' : '#52525b', fontSize: '11px', marginBottom: '2px', display: 'flex', justifyContent: 'space-between' }}>
                              <span>{r.name}</span>
                              <span style={{ fontSize: '9px', color: r.status === 'available' ? '#22c55e' : '#ef4444' }}>{r.status}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Resolve with notes */}
                      {showResolve && (
                        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                          <p style={{ fontSize: '10px', color: '#71717a', marginBottom: '6px' }}>Resolution notes:</p>
                          <textarea value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="What was done, outcome..."
                            style={{ width: '100%', background: '#09090b', border: '1px solid #27272a', borderRadius: '6px', padding: '8px', fontSize: '12px', color: '#fafafa', outline: 'none', resize: 'vertical', minHeight: '60px', marginBottom: '6px' }} />
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={(e) => { e.stopPropagation(); handleResolve(); }}
                              style={{ flex: 1, padding: '6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', background: '#22c55e', color: '#000' }}>Confirm Resolve</button>
                            <button onClick={(e) => { e.stopPropagation(); setShowResolve(false); setResolveNotes(''); }}
                              style={{ padding: '6px 12px', borderRadius: '4px', fontSize: '10px', border: '1px solid #27272a', cursor: 'pointer', background: 'transparent', color: '#71717a' }}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {/* First-aid info */}
                      {inc.condition && (
                        <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '6px', padding: '10px', marginBottom: '8px' }}>
                          <p style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', marginBottom: '4px' }}>FIRST-AID PROTOCOL</p>
                          <p style={{ fontSize: '11px', color: '#a1a1aa' }}>{getFirstAid(inc.condition + ' ' + inc.type).title}</p>
                        </div>
                      )}

                      {/* Voice transcript */}
                      {inc.transcript && (
                        <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '6px', padding: '10px' }}>
                          <p style={{ fontSize: '10px', fontWeight: 700, color: '#3b82f6', marginBottom: '6px' }}>VOICE REPORT</p>
                          <p style={{ fontSize: '12px', color: '#d4d4d8', lineHeight: 1.6, fontStyle: 'italic' }}>&ldquo;{inc.transcript}&rdquo;</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* MAP + PANELS */}
        <div style={{ flex: 1, height: '100%', width: '100%', position: 'relative', background: '#09090b', zIndex: 10, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <LiveMap incidents={incidents} activeIncident={activeIncident} onIncidentClick={setActiveIncident} />
          </div>

          {/* Status History Panel */}
          {showHistory && activeIncident && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(24,24,27,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid #27272a', maxHeight: '200px', overflowY: 'auto', padding: '16px', zIndex: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fafafa' }}>Status History</h3>
                <button onClick={() => setShowHistory(false)} style={{ color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Close</button>
              </div>
              {historyLoading ? <p style={{ color: '#71717a', fontSize: '12px' }}>Loading...</p> : history.length === 0 ? (
                <p style={{ color: '#52525b', fontSize: '12px' }}>No status changes recorded yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {history.map(entry => (
                    <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                      <span style={{ color: '#52525b', fontFamily: 'monospace', minWidth: '120px' }}>{new Date(entry.created_at).toLocaleString()}</span>
                      {entry.old_status && <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(39,39,42,0.6)', color: '#a1a1aa' }}>{entry.old_status}</span>}
                      <span style={{ color: '#71717a' }}>→</span>
                      <span style={{ padding: '2px 6px', borderRadius: '4px', background: STATUS_STYLE[entry.new_status as IncidentStatus]?.bg || '#27272a', color: STATUS_STYLE[entry.new_status as IncidentStatus]?.color || '#a1a1aa' }}>{entry.new_status}</span>
                      <span style={{ color: '#52525b' }}>by {entry.changed_by || 'system'}</span>
                      {entry.notes && <span style={{ color: '#71717a', fontStyle: 'italic' }}>({entry.notes})</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Related Incidents Panel */}
          {showRelated && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(24,24,27,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid #27272a', maxHeight: '200px', overflowY: 'auto', padding: '16px', zIndex: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#fafafa' }}>Related Incidents (same type, within 500m, 10min)</h3>
                <button onClick={() => setShowRelated(false)} style={{ color: '#71717a', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Close</button>
              </div>
              {relatedIncidents.length === 0 ? (
                <p style={{ color: '#52525b', fontSize: '12px' }}>No related incidents found.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {relatedIncidents.map(inc => (
                    <div key={inc.id} onClick={() => setActiveIncident(inc)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '6px', background: 'rgba(39,39,42,0.3)', cursor: 'pointer' }}>
                      <span>{INCIDENT_ICONS[inc.type]}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#fafafa' }}>{inc.type} — {inc.status}</p>
                        <p style={{ fontSize: '11px', color: '#71717a' }}>{inc.location}</p>
                      </div>
                      <span style={{ fontSize: '10px', color: '#52525b' }}>{timeAgo(inc.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
