'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Toaster, toast } from 'sonner';
import LiveMap from '../components/LiveMap';
import { useIncidents } from '../hooks/useIncidents';
import { useAuth } from '../hooks/useAuth';
import { Search, ArrowLeft, Shield, CheckCircle2, AlertTriangle, ShieldAlert, Activity, Clock, UserX } from 'lucide-react';
import IncidentDrawer from '../components/IncidentDrawer';
import type { Incident, IncidentStatus, UrgencyLevel } from '../types/incident';

const ALL_TYPES = ['All', 'FIRE', 'ACCIDENT', 'MEDICAL', 'DISASTER', 'VIOLENCE', 'HAZARDOUS', 'MISSING_PERSON'];
const ALL_URGENCIES: { label: string; value: UrgencyLevel | null }[] = [
  { label: 'ALL', value: null },
  { label: 'CRITICAL', value: 'critical' },
  { label: 'HIGH', value: 'high' },
  { label: 'MEDIUM', value: 'medium' },
  { label: 'LOW', value: 'low' },
];

interface Responder {
  id: string;
  name: string;
  email: string;
  status: string;
}

export default function DispatcherDashboard() {
  const { user } = useAuth();
  const { incidents, loading, error, isLive, refresh, updateStatus, updateUrgency, assignResponder, resolveIncident, getResponders, getRelated, getHistory } = useIncidents();
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedUrgency, setSelectedUrgency] = useState<UrgencyLevel | null>(null);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('');
  const [responders, setResponders] = useState<Responder[]>([]);

  useEffect(() => {
    setMounted(true);
    setTime(new Date().toLocaleTimeString());
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    getResponders().then(setResponders);
  }, [getResponders]);

  // Trigger map resize when drawer toggles
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 350);
    return () => clearTimeout(timer);
  }, [activeIncident]);

  const metrics = useMemo(() => ({
    total: incidents.length,
    critical: incidents.filter(i => i.urgency === 'critical' && i.status !== 'RESOLVED').length,
    dispatched: incidents.filter(i => i.status === 'DISPATCHED').length,
    resolved: incidents.filter(i => i.status === 'RESOLVED').length,
    awaitingReview: incidents.filter(i => i.status === 'PENDING' || i.status === 'REVIEWING').length,
    unassigned: incidents.filter(i => !i.assigned_responder_id && i.status !== 'RESOLVED').length,
  }), [incidents]);

  const filtered = useMemo(() => {
    return incidents
      .filter(i => i.status !== 'RESOLVED')
      .filter(i => {
        const ms = i.location.toLowerCase().includes(search.toLowerCase()) ||
          i.type.toLowerCase().includes(search.toLowerCase()) ||
          (i.condition || '').toLowerCase().includes(search.toLowerCase()) ||
          (i.description || '').toLowerCase().includes(search.toLowerCase());
        const mt = selectedType === 'All' || i.type === selectedType;
        const mu = selectedUrgency === null || (i.urgency || 'medium') === selectedUrgency;
        return ms && mt && mu;
      })
      .sort((a, b) => {
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        const ua = order[a.urgency || 'medium'] ?? 3;
        const ub = order[b.urgency || 'medium'] ?? 3;
        if (ua !== ub) return ua - ub;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
  }, [incidents, search, selectedType, selectedUrgency]);

  const handleStatusUpdate = async (id: string, status: IncidentStatus) => {
    const updated = await updateStatus(id, status);
    if (updated) {
      setActiveIncident(updated);
      toast.success(`Incident marked ${status}`);
    } else {
      toast.error('Failed to update incident');
    }
  };

  const handleUrgencyOverride = async (id: string, urgency: UrgencyLevel, reason?: string) => {
    const updated = await updateUrgency(id, urgency, reason || `Dispatcher override at ${new Date().toLocaleTimeString()}`);
    if (updated) {
      setActiveIncident(updated);
      toast.success(`Urgency updated to ${urgency}`);
    } else {
      toast.error('Failed to update urgency');
    }
  };

  const handleAssign = async (incidentId: string, responderId: string) => {
    const updated = await assignResponder(incidentId, responderId);
    if (updated) {
      setActiveIncident(updated);
      toast.success('Responder assigned');
    } else {
      toast.error('Failed to assign responder');
    }
  };

  const handleResolve = async (notes: string) => {
    if (!activeIncident) return;
    const updated = await resolveIncident(activeIncident.id, notes || 'Resolved by dispatcher');
    if (updated) {
      setActiveIncident(updated);
      toast.success('Incident resolved');
    } else {
      toast.error('Failed to resolve incident');
    }
  };

  return (
    <div className="w-full h-screen bg-[#0a0c10] text-zinc-50 flex flex-col overflow-hidden font-sans select-none">
      <Toaster position="top-right" theme="dark" />

      {/* ── TOP RIBBON ── */}
      <header className="w-full h-12 min-h-[48px] border-b border-zinc-800/60 bg-[#0a0c10]/95 backdrop-blur-xl px-5 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <Image src="/logo.jpg" alt="AgapAI" width={24} height={24} className="rounded-lg" />
          <span className="font-black text-base tracking-widest text-zinc-100 uppercase">
            Agap<span className="text-red-500">AI</span>
          </span>
          <span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded border"
            style={{
              background: isLive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              color: isLive ? '#22c55e' : '#f87171',
              borderColor: isLive ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
            }}>
            {loading ? 'SYNCING' : isLive ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono text-zinc-400">
          {user && (
            <span className="text-zinc-500">
              <Shield size={11} className="inline mr-1" />{user.role}
            </span>
          )}
          <button onClick={refresh} className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/50 border border-zinc-700/50 rounded-md text-zinc-400 hover:bg-zinc-800 transition-colors">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: isLive ? '#22c55e' : '#71717a' }} />
            <span className="text-zinc-500">MODE:</span> COMMANDER
          </button>
          {mounted && <span className="text-zinc-500">{time}</span>}
          <a href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <ArrowLeft size={12} className="inline mr-1" />Citizen
          </a>
        </div>
      </header>

      {/* ── METRICS RIBBON ── */}
      <div className="w-full h-14 min-h-[56px] grid grid-cols-6 gap-3 px-4 bg-[#0a0c10]/95 backdrop-blur-xl shrink-0 border-b border-zinc-800/60 z-20 items-center">
        {[
          { label: 'TOTAL INCIDENTS', value: metrics.total, icon: Activity, color: '#f4f4f5' },
          { label: 'CRITICAL / HIGH', value: metrics.critical, icon: ShieldAlert, color: '#ef4444' },
          { label: 'UNITS DISPATCHED', value: metrics.dispatched, icon: AlertTriangle, color: '#60a5fa' },
          { label: 'AWAITING REVIEW', value: metrics.awaitingReview, icon: Clock, color: '#fbbf24' },
          { label: 'UNASSIGNED', value: metrics.unassigned, icon: UserX, color: '#f97316' },
          { label: 'CASES RESOLVED', value: metrics.resolved, icon: CheckCircle2, color: '#22c55e' },
        ].map(m => (
          <div key={m.label} className="bg-zinc-900/30 backdrop-blur-xl border border-zinc-800/50 rounded-lg px-3 py-2 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">{m.label}</p>
              <h3 className="text-xl font-black mt-0.5" style={{ color: m.color }}>{m.value}</h3>
            </div>
            <m.icon size={16} style={{ color: m.color, opacity: 0.5 }} />
          </div>
        ))}
      </div>

      {/* ── MAIN WORKSPACE: MAP + DRAWER ── */}
      <div className="w-full flex-1 min-h-0 flex flex-row overflow-hidden relative bg-[#0a0c10]">

        {/* ═══ FULL-WIDTH MAP ═══ */}
        <main className="flex-1 h-full relative overflow-hidden">
          <LiveMap incidents={filtered} activeIncident={activeIncident} onIncidentClick={setActiveIncident} />

          {/* Floating Search & Filter Bar */}
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-[360px]">
            <div className="relative flex items-center w-full">
              <Search size={14} className="text-zinc-500 absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search incidents, conditions, locations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Search incidents"
                className="w-full bg-[#0d0f12]/90 backdrop-blur-xl border border-zinc-700/50 rounded-lg pl-9 pr-4 py-2 text-xs font-medium text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 shadow-xl"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TYPES.map(type => (
                <button key={type} onClick={() => setSelectedType(type)}
                  type="button"
                  aria-pressed={selectedType === type}
                  className="px-2 py-1 text-[9px] font-black tracking-wider uppercase rounded-md border cursor-pointer transition-all"
                  style={{
                    background: selectedType === type ? '#f4f4f5' : 'rgba(13,15,18,0.8)',
                    color: selectedType === type ? '#09090b' : '#71717a',
                    borderColor: selectedType === type ? '#f4f4f5' : 'rgba(63,63,70,0.3)',
                    backdropFilter: 'blur(12px)',
                  }}>
                  {type === 'All' ? type : type.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_URGENCIES.map(u => (
                <button key={u.label} onClick={() => setSelectedUrgency(u.value)}
                  type="button"
                  aria-pressed={selectedUrgency === u.value}
                  className="px-2 py-1 text-[9px] font-black tracking-wider uppercase rounded-md border cursor-pointer transition-all"
                  style={{
                    background: selectedUrgency === u.value ? '#f4f4f5' : 'rgba(13,15,18,0.8)',
                    color: selectedUrgency === u.value ? '#09090b' : '#71717a',
                    borderColor: selectedUrgency === u.value ? '#f4f4f5' : 'rgba(63,63,70,0.3)',
                    backdropFilter: 'blur(12px)',
                  }}>
                  {u.label}
                </button>
              ))}
            </div>
            {error && <p className="text-[10px] text-red-400/80 bg-[#0d0f12]/80 backdrop-blur-xl px-2 py-1 rounded-md">{error}</p>}
          </div>
        </main>

        {/* ═══ RIGHT-SIDE DRAWER ═══ */}
        {activeIncident && (
          <IncidentDrawer
            key={activeIncident.id}
            incident={activeIncident}
            responders={responders}
            onClose={() => setActiveIncident(null)}
            onSelectIncident={setActiveIncident}
            onStatusUpdate={handleStatusUpdate}
            onUrgencyOverride={handleUrgencyOverride}
            onAssign={handleAssign}
            onResolve={handleResolve}
            getRelated={getRelated}
            getHistory={getHistory}
          />
        )}
      </div>
    </div>
  );
}
