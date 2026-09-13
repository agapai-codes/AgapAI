'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { Toaster, toast } from 'sonner';
import { DispatcherMap } from '../components/DispatcherMap';
import { DispatchIncidentPanel } from '../components/DispatchIncidentPanel';
import { useIncidents } from '../hooks/useIncidents';
import { useAuth } from '../hooks/useAuth';
import { useTriage } from '../hooks/useTriage';
import { Search, ArrowLeft, Shield, CheckCircle2, AlertTriangle, ShieldAlert, Activity, Clock, UserX, Zap } from 'lucide-react';
import { incidentToReport, toUrgencyLevel, sortByUrgency } from '../types/incident';
import { SIMULATION_DEMO_INCIDENTS } from '../utils/incidentTestingSuite';
import { reportToIncident } from '../types/incident';
import type { IncidentReport, UrgencyLevel, IncidentStatus } from '../types/incident';

const ALL_TYPES = ['All', 'FIRE', 'ACCIDENT', 'MEDICAL', 'NATURAL_DISASTER', 'VIOLENCE'] as const;
const ALL_URGENCIES: { label: string; value: UrgencyLevel | null }[] = [
  { label: 'ALL', value: null },
  { label: 'CRITICAL', value: 'CRITICAL' },
  { label: 'HIGH', value: 'HIGH' },
  { label: 'MEDIUM', value: 'MEDIUM' },
  { label: 'LOW', value: 'LOW' },
];

export default function DispatcherDashboard() {
  const { user } = useAuth();
  const { incidents, loading, error, isLive, refresh, updateStatus, updateUrgency, purge, loadDemoIncidents } = useIncidents();
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedUrgency, setSelectedUrgency] = useState<UrgencyLevel | null>(null);
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('');
  const [purging, setPurging] = useState(false);

  const { queue, triageAll } = useTriage({ incidents, sortBy: 'priority' });

  useEffect(() => {
    setMounted(true);
    setTime(new Date().toLocaleTimeString());
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (incidents.length > 0) triageAll();
  }, [incidents, triageAll]); // eslint-disable-line react-hooks/exhaustive-deps

  const metrics = useMemo(() => ({
    total: incidents.length,
    critical: incidents.filter(i => i.urgency === 'CRITICAL' && i.status !== 'RESOLVED').length,
    dispatched: incidents.filter(i => i.status === 'DISPATCHED').length,
    resolved: incidents.filter(i => i.status === 'RESOLVED').length,
    awaitingReview: incidents.filter(i => i.status === 'PENDING' || i.status === 'REVIEWING').length,
    unassigned: incidents.filter(i => !i.assigned_responder_id && i.status !== 'RESOLVED').length,
    triaged: queue.filter(q => q.dispatch_priority_score > 50).length,
  }), [incidents, queue]);

  const scoreMap = useMemo(() => {
    const map = new Map<string, number>();
    queue.forEach(q => map.set(q.incident_id, q.dispatch_priority_score));
    return map;
  }, [queue]);

  const filtered = useMemo(() => {
    return incidents
      .filter(i => i.status !== 'RESOLVED')
      .filter(i => {
        const matchSearch = i.location.toLowerCase().includes(search.toLowerCase()) ||
          i.type.toLowerCase().includes(search.toLowerCase()) ||
          (i.condition || '').toLowerCase().includes(search.toLowerCase()) ||
          (i.description || '').toLowerCase().includes(search.toLowerCase());
        const matchType = selectedType === 'All' || i.type === selectedType;
        const matchUrgency = selectedUrgency === null || toUrgencyLevel(i.urgency) === selectedUrgency;
        return matchSearch && matchType && matchUrgency;
      })
      .sort((a, b) => {
        const scoreA = scoreMap.get(a.id) ?? 0;
        const scoreB = scoreMap.get(b.id) ?? 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        const ua = order[a.urgency || 'medium'] ?? 3;
        const ub = order[b.urgency || 'medium'] ?? 3;
        if (ua !== ub) return ua - ub;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
  }, [incidents, search, selectedType, selectedUrgency, scoreMap]);

  const reports = useMemo(() => {
    return filtered.map(inc => {
      const triageRationale = queue.find(q => q.incident_id === inc.id)?.triage_result?.urgency_reason;
      return incidentToReport(inc, triageRationale);
    });
  }, [filtered, queue]);

  const sortedReports = useMemo(() => [...reports].sort(sortByUrgency), [reports]);

  useEffect(() => {
    if (!selectedReport) return;
    const latest = reports.find(r => r.id === selectedReport.id);
    if (latest) setSelectedReport(latest);
  }, [reports, selectedReport?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectIncident = (report: IncidentReport) => {
    setSelectedReport(report);
  };

  const handleStatusUpdate = async (id: string, status: IncidentStatus) => {
    const updated = await updateStatus(id, status);
    if (updated) {
      toast.success(`Incident marked ${status}`);
    } else {
      toast.error('Failed to update status');
    }
  };

  const handleUrgencyOverride = async (id: string, urgency: UrgencyLevel, reason: string) => {
    const updated = await updateUrgency(id, urgency.toLowerCase() as any, reason);
    if (updated) {
      toast.success(`Urgency updated to ${urgency}`);
    } else {
      toast.error('Failed to update urgency');
    }
  };

  const handlePurge = async () => {
    if (!confirm('Purge all incidents and reset dashboard to 0?')) return;
    setPurging(true);
    try {
      await purge();
      setSelectedReport(null);
      toast.success('All incidents purged');
    } catch {
      toast.error('Failed to purge');
    }
    setPurging(false);
  };

  const handleLoadDemos = () => {
    const demoIncidents = SIMULATION_DEMO_INCIDENTS.map(r => reportToIncident(r));
    loadDemoIncidents(demoIncidents);
    setSelectedReport(null);
    toast.success('4 demo incidents loaded');
  };

  return (
    <div className="w-screen h-screen bg-[#0a0c10] text-zinc-50 flex flex-col overflow-hidden font-sans select-none">
      <Toaster position="top-right" theme="dark" />

      {/* ── TOP BAR (h-14) ── */}
      <header className="w-full h-14 min-h-[56px] border-b border-zinc-800/60 bg-[#0a0c10]/95 backdrop-blur-xl px-4 flex items-center justify-between shrink-0 z-30">
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

        {/* ── METRICS (inline in top bar) ── */}
        <div className="flex items-center gap-1.5">
          {[
            { label: 'TOTAL', value: metrics.total, color: '#f4f4f5' },
            { label: 'CRIT', value: metrics.critical, color: '#ef4444' },
            { label: 'DISP', value: metrics.dispatched, color: '#60a5fa' },
            { label: 'TRI', value: metrics.triaged, color: '#a855f7' },
            { label: 'WAIT', value: metrics.awaitingReview, color: '#fbbf24' },
            { label: 'UNAS', value: metrics.unassigned, color: '#f97316' },
            { label: 'RES', value: metrics.resolved, color: '#22c55e' },
          ].map(m => (
            <div key={m.label} className="flex flex-col items-center px-2">
              <span className="text-[7px] font-black tracking-widest text-zinc-500 uppercase">{m.label}</span>
              <span className="text-sm font-black" style={{ color: m.color }}>{m.value}</span>
            </div>
          ))}
        </div>

        {/* ── CONTROLS ── */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePurge}
            disabled={purging}
            className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900/80 text-red-300 border border-red-800/50 rounded text-[10px] font-bold tracking-wider uppercase transition-colors disabled:opacity-50"
          >
            {purging ? 'Purging...' : 'Reset to 0'}
          </button>
          <button
            onClick={handleLoadDemos}
            className="px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border border-zinc-700/50 rounded text-[10px] font-bold tracking-wider uppercase transition-colors"
          >
            Load Demos
          </button>
          {mounted && <span className="text-[10px] text-zinc-500 font-mono">{time}</span>}
          <a href="/" className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1">
            <ArrowLeft size={10} /> Citizen
          </a>
        </div>
      </header>

      {/* ── MAIN 3-PANE WORKSPACE ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ═══ LEFT: INCIDENT QUEUE (w-80) ═══ */}
        <div className="w-80 shrink-0 border-r border-zinc-800/60 overflow-y-auto bg-[#0a0c10] min-w-0">
          <div className="p-3 border-b border-zinc-800/60 sticky top-0 bg-[#0a0c10] z-10">
            <p className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">INCIDENT QUEUE</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{sortedReports.length} active</p>
          </div>
          <div className="p-2 space-y-1.5">
            {sortedReports.map(report => {
              const isSelected = selectedReport?.id === report.id;
              const urgStyle = {
                CRITICAL: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                HIGH: { color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
                MEDIUM: { color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
                LOW: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
              }[report.urgency];

              return (
                <button
                  key={report.id}
                  onClick={() => handleSelectIncident(report)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-zinc-800/60 border-zinc-600/60'
                      : 'bg-zinc-900/20 border-zinc-800/30 hover:bg-zinc-800/30 hover:border-zinc-700/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ color: urgStyle.color, background: urgStyle.bg }}>
                      {report.urgency}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono">{report.type.replace('_', ' ')}</span>
                  </div>
                  <p className="text-xs font-semibold text-zinc-200 truncate">{report.condition}</p>
                  <p className="text-[10px] text-zinc-500 truncate mt-0.5">{report.location.landmarkText}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[9px] text-zinc-600 flex items-center gap-1">
                      <Clock size={9} /> {new Date(report.timeReported).toLocaleTimeString()}
                    </span>
                    <span className="text-[9px] text-zinc-600 flex items-center gap-1">
                      👥 {report.peopleCount}
                    </span>
                  </div>
                </button>
              );
            })}
            {sortedReports.length === 0 && (
              <p className="text-[11px] text-zinc-600 text-center py-8">No active incidents</p>
            )}
          </div>
        </div>

        {/* ═══ CENTER: MAP (flex-1) ═══ */}
        <div className="flex-1 min-w-0 relative h-full">
          <DispatcherMap
            incidents={reports}
            selectedIncident={selectedReport}
            onSelectIncident={handleSelectIncident}
            isRightPanelOpen={!!selectedReport}
          />

          {/* Floating Search & Filters */}
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 max-w-[300px]">
            <div className="relative flex items-center w-full">
              <Search size={14} className="text-zinc-500 absolute left-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search incidents..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#0d0f12]/90 backdrop-blur-xl border border-zinc-700/50 rounded-lg pl-9 pr-4 py-2 text-xs font-medium text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 shadow-xl"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TYPES.map(type => (
                <button key={type} onClick={() => setSelectedType(type)}
                  className="px-2 py-1 text-[9px] font-black tracking-wider uppercase rounded-md border cursor-pointer transition-all"
                  style={{
                    background: selectedType === type ? '#f4f4f5' : 'rgba(13,15,18,0.8)',
                    color: selectedType === type ? '#09090b' : '#71717a',
                    borderColor: selectedType === type ? '#f4f4f5' : 'rgba(63,63,70,0.3)',
                  }}>
                  {type === 'All' ? type : type.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_URGENCIES.map(u => (
                <button key={u.label} onClick={() => setSelectedUrgency(u.value)}
                  className="px-2 py-1 text-[9px] font-black tracking-wider uppercase rounded-md border cursor-pointer transition-all"
                  style={{
                    background: selectedUrgency === u.value ? '#f4f4f5' : 'rgba(13,15,18,0.8)',
                    color: selectedUrgency === u.value ? '#09090b' : '#71717a',
                    borderColor: selectedUrgency === u.value ? '#f4f4f5' : 'rgba(63,63,70,0.3)',
                  }}>
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: DETAIL PANEL (w-[420px]) ═══ */}
        {selectedReport && (
          <DispatchIncidentPanel
            incident={selectedReport}
            onClose={() => setSelectedReport(null)}
            onStatusUpdate={handleStatusUpdate}
            onUrgencyOverride={handleUrgencyOverride}
            onAssignUnit={(id, unit) => toast.success(`Unit ${unit} assigned to ${id}`)}
          />
        )}
      </div>
    </div>
  );
}
