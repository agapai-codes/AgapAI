'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import {
  MapPin, Clock, CheckCircle2, Navigation, ChevronRight, LogOut,
  ArrowLeft, AlertTriangle, Phone, Brain, Wind, Droplets, Activity
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Sidebar } from '../components/Sidebar';
import { getFirstAid } from '../lib/firstAid';
import type { Incident, IncidentStatus } from '../types/incident';

const URGENCY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  high: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  medium: { color: '#eab308', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.3)' },
  low: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
};

const INCIDENT_ICONS: Record<string, string> = {
  FIRE: '🔥', ACCIDENT: '🚗', MEDICAL: '🏥', DISASTER: '🌪️',
  VIOLENCE: '⚠️', HAZARDOUS: '☢️', MISSING_PERSON: '🔍', NATURAL_DISASTER: '🌪️',
};

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
    const urg = URGENCY_STYLE[inc.urgency || 'medium'];
    const protocol = getFirstAid((inc.condition || '') + ' ' + inc.type);

    return (
      <div className="min-h-screen bg-[#09090b] text-white">
        <Toaster position="top-center" theme="dark" />

        {/* Header */}
        <header className="h-12 min-h-[48px] border-b border-white/5 flex items-center px-4 gap-3"
          style={{ background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(16px)' }}>
          <button onClick={() => { setSelectedIncident(null); setShowResolve(false); }}
            className="flex items-center gap-1.5 text-neutral-400 hover:text-white text-[11px] font-medium transition-colors">
            <ArrowLeft size={14} /> Back
          </button>
          <span className="text-[11px] font-bold text-white">Incident Detail</span>
        </header>

        <div className="p-4 max-w-lg mx-auto space-y-4">
          {/* Header card */}
          <div className="rounded-xl p-4 border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{INCIDENT_ICONS[inc.type] || '📋'}</span>
              <div className="flex-1 min-w-0">
                <h2 className="text-[15px] font-bold text-white">{inc.type.replace('_', ' ')}</h2>
                <p className="text-[10px] text-neutral-500">{inc.status} · {timeAgo(inc.timestamp)}</p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: urg.bg, color: urg.color, border: `1px solid ${urg.border}` }}>
                {(inc.urgency || 'medium').toUpperCase()}
              </span>
            </div>
            <p className="text-[13px] text-neutral-300 leading-relaxed mb-3">{inc.description}</p>

            {/* Vitals chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {inc.condition && <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-neutral-400 border border-white/10">Condition: {inc.condition}</span>}
              {inc.people_affected && inc.people_affected > 1 && <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-neutral-400 border border-white/10">People: {inc.people_affected}</span>}
              {inc.consciousness === false && <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1"><Brain size={9} /> Unconscious</span>}
              {inc.breathing === false && <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1"><Wind size={9} /> Not Breathing</span>}
              {inc.bleeding && <span className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1"><Droplets size={9} /> Bleeding</span>}
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
              <MapPin size={14} className="text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-neutral-200 truncate">{inc.location}</p>
                <p className="text-[9px] text-neutral-600 font-mono">{inc.coordinates.lat.toFixed(4)}, {inc.coordinates.lng.toFixed(4)}</p>
              </div>
              <button onClick={() => openNavigation(inc.coordinates.lat, inc.coordinates.lng)}
                className="px-3 py-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all hover:bg-blue-500/25">
                <Navigation size={10} /> Navigate
              </button>
            </div>

            {/* Reporter */}
            <div className="mt-2 text-[11px] text-neutral-500">
              Reported by: <span className="text-neutral-300 font-medium">{inc.reporter}</span>
            </div>
          </div>

          {/* First-aid */}
          <div className="rounded-xl p-4 border border-emerald-500/15" style={{ background: 'rgba(16,185,129,0.04)' }}>
            <p className="text-[11px] font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
              🏥 FIRST-AID: {protocol.title.toUpperCase()}
            </p>
            <ol className="list-decimal list-inside space-y-1 mb-2">
              {protocol.steps.map((s, i) => <li key={i} className="text-[11px] text-neutral-300 leading-relaxed">{s}</li>)}
            </ol>
            <p className="text-[9px] text-neutral-600 font-mono">{protocol.source}</p>
          </div>

          {/* Actions */}
          <div className="space-y-2.5">
            {inc.status === 'DISPATCHED' && (
              <>
                <button onClick={() => updateStatus(inc.id, 'EN_ROUTE')} disabled={updateLoading}
                  className="w-full py-3 rounded-lg text-[13px] font-bold border border-amber-500/30 bg-amber-500/10 text-amber-400 transition-all hover:bg-amber-500/20 disabled:opacity-50">
                  En Route
                </button>
                <button onClick={() => updateStatus(inc.id, 'ARRIVED')} disabled={updateLoading}
                  className="w-full py-3 rounded-lg text-[13px] font-bold bg-blue-500 text-white border-none transition-all hover:bg-blue-400 disabled:opacity-50">
                  On Scene
                </button>
              </>
            )}
            {inc.status === 'EN_ROUTE' && (
              <>
                <button onClick={() => updateStatus(inc.id, 'ARRIVED')} disabled={updateLoading}
                  className="w-full py-3 rounded-lg text-[13px] font-bold bg-blue-500 text-white border-none transition-all hover:bg-blue-400 disabled:opacity-50">
                  Arrived on Scene
                </button>
                <button onClick={() => setShowResolve(true)} disabled={updateLoading}
                  className="w-full py-3 rounded-lg text-[13px] font-bold bg-emerald-500 text-black border-none transition-all hover:bg-emerald-400 disabled:opacity-50">
                  Mark Resolved
                </button>
              </>
            )}
            {inc.status === 'ARRIVED' && (
              <button onClick={() => setShowResolve(true)} disabled={updateLoading}
                className="w-full py-3 rounded-lg text-[13px] font-bold bg-emerald-500 text-black border-none transition-all hover:bg-emerald-400 disabled:opacity-50">
                Mark Resolved
              </button>
            )}
            {inc.status === 'PENDING' && (
              <button onClick={() => updateStatus(inc.id, 'DISPATCHED')} disabled={updateLoading}
                className="w-full py-3 rounded-lg text-[13px] font-bold bg-blue-500 text-white border-none transition-all hover:bg-blue-400 disabled:opacity-50">
                Accept Assignment
              </button>
            )}
          </div>

          {/* Resolve form */}
          {showResolve && (
            <div className="rounded-xl p-4 border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-[11px] font-bold text-white mb-2">Resolution Notes</p>
              <textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)}
                placeholder="Describe what was done, patient outcome..."
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-[12px] text-white placeholder-neutral-600 outline-none resize-y min-h-[80px] mb-3" />
              <div className="flex gap-2">
                <button onClick={() => updateStatus(inc.id, 'RESOLVED', resolutionNotes)} disabled={updateLoading}
                  className="flex-1 py-2.5 rounded-lg text-[12px] font-bold bg-emerald-500 text-black border-none transition-all hover:bg-emerald-400 disabled:opacity-50">
                  Confirm Resolve
                </button>
                <button onClick={() => { setShowResolve(false); setResolutionNotes(''); }}
                  className="px-4 py-2.5 rounded-lg text-[12px] border border-white/10 text-neutral-400 hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </div>
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
    <div className="h-screen w-screen overflow-hidden flex bg-[#09090b] text-white font-sans select-none">
      <Toaster position="top-right" theme="dark" />

      {/* Sidebar */}
      <Sidebar
        activeRoute="responder"
        onNavigate={handleNavigate}
        user={user}
        onSignOut={signOut}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

      {/* Header */}
      <header className="h-12 min-h-[48px] border-b border-white/5 flex items-center justify-between px-4 shrink-0"
        style={{ background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-2.5">
          <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            RESPONDER
          </span>
          <span className="text-[11px] text-neutral-500">{incidents.length} assigned</span>
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto">
        <h2 className="text-[14px] font-bold text-white mb-4">Assigned Incidents</h2>

        {loading ? (
          <div className="flex flex-col items-center py-16">
            <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin mb-3" />
            <p className="text-[11px] text-neutral-500">Loading incidents...</p>
          </div>
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <CheckCircle2 size={24} className="text-emerald-500/50" />
            </div>
            <p className="text-[12px] text-neutral-400 font-medium">No assigned incidents</p>
            <p className="text-[10px] text-neutral-600 mt-1">All clear — check back later</p>
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map(inc => {
              const urg = URGENCY_STYLE[inc.urgency || 'medium'];
              return (
                <div key={inc.id} onClick={() => setSelectedIncident(inc)}
                  className="rounded-xl p-3.5 border border-white/5 cursor-pointer transition-all hover:bg-white/[0.03] hover:border-white/10 relative overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {/* Left accent */}
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ background: urg.color }} />

                  <div className="flex items-center gap-2.5 pl-3">
                    <span className="text-lg">{INCIDENT_ICONS[inc.type] || '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold text-white truncate">{inc.type.replace('_', ' ')}</p>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: urg.bg, color: urg.color }}>
                          {(inc.urgency || 'medium').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 truncate mt-0.5">{inc.description?.slice(0, 60)}...</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[9px] text-neutral-600 flex items-center gap-1"><MapPin size={8} /> {inc.location?.slice(0, 25)}</span>
                        <span className="text-[9px] text-neutral-600 flex items-center gap-1"><Clock size={8} /> {timeAgo(inc.timestamp)}</span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-neutral-600 shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      </div>{/* end main content */}
    </div>
  );
}
