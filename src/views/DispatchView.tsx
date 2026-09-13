'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Toaster, toast } from 'sonner';
const DispatcherMap = dynamic(() => import('../components/DispatcherMap').then(m => m.DispatcherMap), { ssr: false });
import { DispatchIncidentPanel } from '../components/DispatchIncidentPanel';
import { Sidebar } from '../components/Sidebar';
import { useIncidents } from '../hooks/useIncidents';
import { useAuth } from '../hooks/useAuth';
import { useTriage } from '../hooks/useTriage';
import { Search, ArrowLeft, Shield, CheckCircle2, AlertTriangle, ShieldAlert, Activity, Clock, UserX, Zap, MapPin, BarChart3, Download } from 'lucide-react';
import { incidentToReport, toUrgencyLevel, reportToIncident } from '../types/incident';
import { sortByUrgencySeverity } from '../utils/queueSorting';
import { SIMULATION_DEMO_INCIDENTS } from '../utils/incidentTestingSuite';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useIncidentNotifications } from '../hooks/useIncidentNotifications';
import { exportCSV, exportJSON, exportPrintableReport } from '../utils/export';
import type { IncidentReport, UrgencyLevel, IncidentStatus } from '../types/incident';

const ALL_TYPES = ['All', 'FIRE', 'ACCIDENT', 'MEDICAL', 'NATURAL_DISASTER', 'VIOLENCE'] as const;
const ALL_URGENCIES: { label: string; value: UrgencyLevel | null }[] = [
  { label: 'ALL', value: null },
  { label: 'HIGH', value: 'HIGH' },
  { label: 'MEDIUM', value: 'MEDIUM' },
  { label: 'LOW', value: 'LOW' },
];

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

const TYPE_ICONS: Record<string, string> = {
  MEDICAL: '🏥', ACCIDENT: '🚗', FIRE: '🔥', VIOLENCE: '⚠️', NATURAL_DISASTER: '🌪️',
};

const URGENCY_COLORS: Record<string, { color: string; bg: string }> = {
  HIGH: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  MEDIUM: { color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
  LOW: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
};

export default function DispatcherDashboard() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { incidents, loading, error, isLive, refresh, updateStatus, updateUrgency, resolveIncident, purge, loadDemoIncidents } = useIncidents();
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedUrgency, setSelectedUrgency] = useState<UrgencyLevel | null>(null);
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('');
  const [purging, setPurging] = useState(false);
  const [showExport, setShowExport] = useState(false);

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
    critical: incidents.filter(i => i.urgency === 'HIGH' && i.status !== 'RESOLVED').length,
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
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        const ua = order[a.urgency || 'medium'] ?? 2;
        const ub = order[b.urgency || 'medium'] ?? 2;
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

  const sortedReports = useMemo(() => [...reports].sort(sortByUrgencySeverity), [reports]);

  useEffect(() => {
    if (!selectedReport) return;
    const latest = reports.find(r => r.id === selectedReport.id);
    if (latest) setSelectedReport(latest);
  }, [reports, selectedReport?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectIncident = (report: IncidentReport) => setSelectedReport(report);

  const handleStatusUpdate = async (id: string, status: IncidentStatus) => {
    const updated = await updateStatus(id, status);
    if (updated) toast.success(`Incident marked ${status}`);
    else toast.error('Failed to update status');
  };

  const handleUrgencyOverride = async (id: string, urgency: UrgencyLevel, reason: string) => {
    const updated = await updateUrgency(id, urgency.toLowerCase() as any, reason);
    if (updated) toast.success(`Urgency updated to ${urgency}`);
    else toast.error('Failed to update urgency');
  };

  const handleResolve = async (id: string, notes: string) => {
    const updated = await resolveIncident(id, notes || 'Resolved by dispatcher');
    if (updated) {
      toast.success('Incident resolved');
      setSelectedReport(null);
    } else {
      toast.error('Failed to resolve incident');
    }
  };

  const handlePurge = async () => {
    if (!confirm('Purge all incidents and reset dashboard to 0?')) return;
    setPurging(true);
    try {
      await purge();
      setSelectedReport(null);
      toast.success('All incidents purged');
    } catch { toast.error('Failed to purge'); }
    setPurging(false);
  };

  const handleLoadDemos = () => {
    const demoIncidents = SIMULATION_DEMO_INCIDENTS.map(r => reportToIncident(r));
    loadDemoIncidents(demoIncidents);
    setSelectedReport(null);
    toast.success('4 demo incidents loaded');
  };

  const handleNavigate = useCallback((route: string) => {
    if (route === 'analytics') router.push('/analytics');
    else if (route === 'dispatcher') router.push('/dispatcher');
    else if (route === 'responder') router.push('/responder');
  }, [router]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onEscape: () => setSelectedReport(null),
    onRefresh: () => refresh(),
    onFilterAll: () => setSelectedUrgency(null),
    onFilterHigh: () => setSelectedUrgency('HIGH'),
    onFilterMedium: () => setSelectedUrgency('MEDIUM'),
    onFilterLow: () => setSelectedUrgency('LOW'),
  });

  // In-app toast notifications for new incidents
  useIncidentNotifications();

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#09090b] text-white font-sans select-none">
      <Toaster position="top-right" theme="dark" />

      {/* ── SIDEBAR ── */}
      <Sidebar
        activeRoute="dispatcher"
        onNavigate={handleNavigate}
        user={user}
        onSignOut={signOut}
      />

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

      {/* ── HEADER (h-12, slim) ── */}
      <header className="h-12 min-h-[48px] border-b border-white/5 flex items-center justify-between px-4 shrink-0 z-30"
        style={{ background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(16px)' }}>
        {/* Left: Logo + Status */}
        <div className="flex items-center gap-3">
          <Image src="/logo.jpg" alt="AgapAI" width={22} height={22} className="rounded-md" />
          <span className="font-extrabold text-sm tracking-wider text-white uppercase">
            Agap<span className="text-red-500">AI</span>
          </span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
            style={{
              background: isLive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${isLive ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: isLive ? '#22c55e' : '#ef4444', animation: isLive ? 'live-pulse 1.5s ease-in-out infinite' : 'none' }} />
            <span className="text-[9px] font-bold" style={{ color: isLive ? '#22c55e' : '#ef4444' }}>
              {loading ? 'SYNC' : isLive ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Center: Metrics pills */}
        <div className="flex items-center gap-1">
          {[
            { label: 'TOTAL', value: metrics.total, color: '#fafafa', bg: 'rgba(255,255,255,0.05)' },
            { label: 'HIGH', value: metrics.critical, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
            { label: 'DISP', value: metrics.dispatched, color: '#60a5fa', bg: 'rgba(96,165,250,0.08)' },
            { label: 'TRI', value: metrics.triaged, color: '#a855f7', bg: 'rgba(168,85,247,0.08)' },
            { label: 'WAIT', value: metrics.awaitingReview, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
            { label: 'UNAS', value: metrics.unassigned, color: '#f97316', bg: 'rgba(249,115,22,0.08)' },
            { label: 'RES', value: metrics.resolved, color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: m.bg }}>
              <span className="text-[8px] font-bold tracking-wider uppercase" style={{ color: `${m.color}99` }}>{m.label}</span>
              <span className="text-xs font-black font-mono" style={{ color: m.color }}>{m.value}</span>
            </div>
          ))}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          <button onClick={handlePurge} disabled={purging}
            className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md text-[9px] font-bold tracking-wider uppercase transition-all disabled:opacity-40">
            {purging ? '...' : 'Reset'}
          </button>
          <button onClick={handleLoadDemos}
            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 rounded-md text-[9px] font-bold tracking-wider uppercase transition-all">
            Demos
          </button>
          <a href="/analytics"
            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-neutral-400 border border-white/10 rounded-md transition-all flex items-center gap-1"
            title="Analytics Dashboard">
            <BarChart3 size={11} />
          </a>
          {/* Export dropdown */}
          <div className="relative">
            <button onClick={() => setShowExport(!showExport)}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 text-neutral-400 border border-white/10 rounded-md transition-all flex items-center gap-1"
              title="Export Data">
              <Download size={11} />
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-white/10 shadow-xl z-50 py-1"
                style={{ background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(16px)' }}>
                <button onClick={() => { exportCSV(incidents); setShowExport(false); }}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-neutral-300 hover:bg-white/5 transition-colors">
                  Export CSV
                </button>
                <button onClick={() => { exportJSON(incidents); setShowExport(false); }}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-neutral-300 hover:bg-white/5 transition-colors">
                  Export JSON
                </button>
                <button onClick={() => { exportPrintableReport(incidents); setShowExport(false); }}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-neutral-300 hover:bg-white/5 transition-colors">
                  Print Report
                </button>
              </div>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10">
              <Shield size={10} className="text-neutral-500" />
              <span className="text-[9px] text-neutral-400">{user.role}</span>
            </div>
          )}
          {mounted && <span className="text-[10px] text-neutral-500 font-mono">{time}</span>}
          <a href="/" className="text-[9px] text-neutral-500 hover:text-white transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/5">
            <ArrowLeft size={10} /> Citizen
          </a>
        </div>
      </header>

      {/* ── 3-PANE BODY ── */}
      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: selectedReport ? '320px 1fr 420px' : '320px 1fr' }}>

        {/* ═══ PANE 1: LEFT QUEUE ═══ */}
        <div className="min-h-0 overflow-y-auto border-r border-white/5" style={{ background: 'rgba(9,9,11,0.6)' }}>
          {/* Queue header */}
          <div className="p-3 border-b border-white/5 sticky top-0 z-10" style={{ background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(12px)' }}>
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-black tracking-widest text-neutral-500 uppercase">INCIDENT QUEUE</p>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-neutral-400 border border-white/10">
                {sortedReports.length}
              </span>
            </div>
            {/* Search */}
            <div className="relative mt-2">
              <Search size={12} className="text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10 transition-all" />
            </div>
          </div>

          {/* Queue cards */}
          <div className="p-2 space-y-1.5">
            {sortedReports.map((report, idx) => {
              const isSelected = selectedReport?.id === report.id;
              const urg = URGENCY_COLORS[report.urgency] || URGENCY_COLORS.MEDIUM;
              return (
                <button key={report.id} onClick={() => handleSelectIncident(report)}
                  className={`w-full text-left rounded-lg transition-all relative overflow-hidden animate-fade-in ${
                    isSelected
                      ? 'bg-white/[0.08] border border-white/20 shadow-lg shadow-black/20'
                      : 'bg-transparent border border-transparent hover:bg-white/[0.04] hover:border-white/8 hover:shadow-md hover:shadow-black/10'
                  }`}
                  style={{ animationDelay: `${idx * 30}ms` }}>
                  {/* Left accent bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg transition-all" style={{ background: urg.color, opacity: isSelected ? 1 : 0.6 }} />

                  <div className="p-3 pl-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px]">{TYPE_ICONS[report.type] || '📋'}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: urg.color }}>
                          {report.urgency}
                        </span>
                      </div>
                      <span className="text-[9px] text-neutral-500">{timeAgo(report.timeReported)}</span>
                    </div>
                    <p className="text-[12px] font-semibold text-neutral-100 truncate leading-tight">{report.condition}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin size={9} className="text-neutral-600 shrink-0" />
                      <p className="text-[10px] text-neutral-500 truncate">{report.location.landmarkText}</p>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[9px] text-neutral-600">{report.type.replace('_', ' ')}</span>
                      <span className="text-[9px] text-neutral-600">👥 {report.peopleCount}</span>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Empty state */}
            {sortedReports.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                  <MapPin size={20} className="text-neutral-600" />
                </div>
                <p className="text-[11px] text-neutral-500 font-medium">No active incidents</p>
                <p className="text-[10px] text-neutral-600 mt-1">Click "Demos" to load test data</p>
              </div>
            )}
          </div>
        </div>

        {/* ═══ PANE 2: MAP ═══ */}
        <div className="min-h-0 min-w-0 relative">
          <DispatcherMap
            incidents={reports}
            selectedIncident={selectedReport}
            onSelectIncident={handleSelectIncident}
            isRightPanelOpen={!!selectedReport}
          />
          {/* Floating filters */}
          <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1.5">
            {ALL_TYPES.map(type => (
              <button key={type} onClick={() => setSelectedType(type)}
                className="px-2 py-1 text-[9px] font-bold tracking-wider uppercase rounded-md transition-all"
                style={{
                  background: selectedType === type ? 'rgba(255,255,255,0.9)' : 'rgba(9,9,11,0.7)',
                  color: selectedType === type ? '#09090b' : '#71717a',
                  border: `1px solid ${selectedType === type ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.08)'}`,
                  backdropFilter: 'blur(12px)',
                }}>
                {type === 'All' ? type : type.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="absolute top-3 right-14 z-20 flex flex-wrap gap-1.5">
            {ALL_URGENCIES.map(u => (
              <button key={u.label} onClick={() => setSelectedUrgency(u.value)}
                className="px-2 py-1 text-[9px] font-bold tracking-wider uppercase rounded-md transition-all"
                style={{
                  background: selectedUrgency === u.value ? 'rgba(255,255,255,0.9)' : 'rgba(9,9,11,0.7)',
                  color: selectedUrgency === u.value ? '#09090b' : '#71717a',
                  border: `1px solid ${selectedUrgency === u.value ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.08)'}`,
                  backdropFilter: 'blur(12px)',
                }}>
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ PANE 3: RIGHT DETAIL ═══ */}
        {selectedReport && (
          <div className="min-h-0 overflow-y-auto border-l border-white/5">
            <DispatchIncidentPanel
              incident={selectedReport}
              onClose={() => setSelectedReport(null)}
              onStatusUpdate={handleStatusUpdate}
              onUrgencyOverride={handleUrgencyOverride}
              onAssignUnit={(id, unit) => toast.success(`Unit ${unit} assigned to ${id}`)}
              onResolve={handleResolve}
            />
          </div>
        )}
      </div>

      </div>{/* end main content */}
    </div>
  );
}
