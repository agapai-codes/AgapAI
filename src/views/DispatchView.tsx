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
import { Search, ArrowLeft, Shield, MapPin, BarChart3, Download, Inbox } from 'lucide-react';
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
  { label: 'CRITICAL', value: 'CRITICAL' },
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

/** Urgency ink + chip treatment. Red = act, amber = wait, emerald = done. */
const URGENCY_STYLE: Record<string, { ink: string; chip: string }> = {
  CRITICAL: { ink: 'var(--critical)', chip: 'chip-critical-solid' },
  HIGH: { ink: 'var(--critical)', chip: 'chip-critical' },
  MEDIUM: { ink: 'var(--warning)', chip: 'chip-warning' },
  LOW: { ink: 'var(--success)', chip: 'chip-success' },
};

/**
 * The link banner sits above every route. This shell is exactly one viewport
 * tall, so it has to subtract whatever the banner is currently occupying.
 */
function useBannerOffset() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const el = document.querySelector<HTMLElement>('[data-testid="link-status-banner"]');
      const next = `${el ? Math.round(el.getBoundingClientRect().height) : 0}px`;
      if (root.style.getPropertyValue('--banner-h') !== next) {
        root.style.setProperty('--banner-h', next);
      }
    };
    apply();
    const id = window.setInterval(apply, 500);
    window.addEventListener('resize', apply);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', apply);
    };
  }, []);
}

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

  useBannerOffset();

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
        const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const ua = order[a.urgency?.toUpperCase() || 'MEDIUM'] ?? 3;
        const ub = order[b.urgency?.toUpperCase() || 'MEDIUM'] ?? 3;
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

  const headerMetrics = [
    { label: 'Open', value: metrics.total, ink: 'var(--text-1)' },
    { label: 'Urgent', value: metrics.critical, ink: 'var(--critical)' },
    { label: 'Awaiting', value: metrics.awaitingReview, ink: 'var(--warning)' },
    { label: 'Dispatched', value: metrics.dispatched, ink: 'var(--info)' },
    { label: 'Triaged', value: metrics.triaged, ink: 'var(--text-2)' },
    { label: 'Resolved', value: metrics.resolved, ink: 'var(--success)' },
  ];

  return (
    <div className="flex w-full overflow-hidden bg-surface-0 text-white font-sans h-[calc(100dvh_-_var(--banner-h,0px))]">
      <Toaster position="top-right" theme="dark" />

      {/* ── SIDEBAR (lg and up) ── */}
      <div className="hidden lg:block">
        <Sidebar
          activeRoute="dispatcher"
          onNavigate={handleNavigate}
          user={user}
          onSignOut={signOut}
        />
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── COMMAND HEADER ── */}
        <header className="chrome flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
          {/* Left: identity + link state */}
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="" width={22} height={22} className="rounded-md" />
            <span className="font-extrabold text-sm tracking-wider uppercase">
              Agap<span className="text-[var(--critical)]">AI</span>
            </span>
            <span className={`chip ${loading ? 'chip-neutral' : isLive ? 'chip-success' : 'chip-critical'}`}>
              <span className={`status-dot ${loading ? 'status-dot-warn' : isLive ? 'status-dot-ok live-dot' : 'status-dot-off'}`} />
              {loading ? 'Sync' : isLive ? 'Live' : 'Offline'}
            </span>
            {error && <span className="chip chip-critical">{String(error).slice(0, 40)}</span>}
          </div>

          {/* Centre: ops readout (lg and up — it needs the room) */}
          <div className="order-3 hidden w-full items-stretch overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface-2)] lg:order-2 lg:flex lg:w-auto">
            {headerMetrics.map(m => (
              <div key={m.label} className="flex flex-col justify-center border-r border-[var(--line-faint)] px-3 py-1.5 last:border-r-0">
                <span className="data-label data-label-tight leading-none">{m.label}</span>
                <span className="readout text-lg leading-tight" style={{ color: m.ink }}>
                  {String(m.value).padStart(2, '0')}
                </span>
              </div>
            ))}
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-1.5 lg:order-3">
            <button type="button" onClick={handlePurge} disabled={purging}
              className="btn btn-sm btn-ghost hidden text-[var(--critical)] sm:inline-flex">
              {purging ? '…' : 'Reset'}
            </button>
            <button type="button" onClick={handleLoadDemos}
              className="btn btn-sm btn-quiet hidden sm:inline-flex">
              Demos
            </button>
            <a href="/analytics" className="btn btn-sm btn-quiet" title="Operations analytics" aria-label="Operations analytics">
              <BarChart3 size={14} aria-hidden />
            </a>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExport(!showExport)}
                className="btn btn-sm btn-quiet"
                title="Export data"
                aria-label="Export data"
                aria-expanded={showExport}
              >
                <Download size={14} aria-hidden />
              </button>
              {showExport && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--line)] bg-surface-1 shadow-2xl">
                  {[
                    { label: 'Export CSV', run: () => exportCSV(incidents) },
                    { label: 'Export JSON', run: () => exportJSON(incidents) },
                    { label: 'Print report', run: () => exportPrintableReport(incidents) },
                  ].map(item => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => { item.run(); setShowExport(false); }}
                      className="block w-full border-b border-[var(--line-faint)] px-3 py-2 text-left text-xs text-ink-2 transition-colors last:border-b-0 hover:bg-white/5 hover:text-white"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {user && (
              <span className="chip chip-neutral hidden md:inline-flex">
                <Shield size={11} aria-hidden />
                {user.role}
              </span>
            )}
            {mounted && <span className="mono hidden text-xs text-ink-3 xl:block">{time}</span>}
            <a href="/" className="btn btn-sm btn-ghost" title="Back to the citizen view">
              <ArrowLeft size={14} aria-hidden />
              <span className="hidden sm:inline">Citizen</span>
            </a>
          </div>
        </header>

        {/* ── 3-PANE BODY ── */}
        <div className={`dispatch-grid flex-1 ${selectedReport ? 'has-detail' : ''}`}>

          {/* ═══ PANE 1: QUEUE ═══ */}
          <section
            aria-label="Incident queue"
            className="flex min-h-0 flex-col overflow-hidden border-b border-[var(--line)] bg-[var(--surface-1)] lg:border-b-0 lg:border-r"
          >
            <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--line-faint)] px-3 py-2.5">
              <div className="flex items-center justify-between">
                <h2 className="data-label">Incident queue</h2>
                <span className="mono rounded-md border border-[var(--line)] bg-white/5 px-1.5 py-0.5 text-2xs text-ink-2">
                  {sortedReports.length}
                </span>
              </div>
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
                <input
                  type="search"
                  placeholder="Search location, type, condition…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="Search incidents"
                  className="field py-1.5 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="queue-rail flex-none lg:min-h-0 lg:flex-1">
              {sortedReports.map((report, idx) => {
                const isSelected = selectedReport?.id === report.id;
                const urg = URGENCY_STYLE[report.urgency] || URGENCY_STYLE.MEDIUM;
                return (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => handleSelectIncident(report)}
                    aria-pressed={isSelected}
                    className={`queue-item animate-fade-in group relative overflow-hidden rounded-xl border text-left transition-colors ${
                      isSelected ? 'border-[var(--line-strong)] bg-[var(--surface-3)]' : 'border-[var(--line-faint)] bg-[var(--surface-2)] hover:border-[var(--line-strong)]'
                    }`}
                    style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                  >
                    <span
                      aria-hidden
                      className={`absolute inset-y-0 left-0 w-[3px] ${report.urgency === 'CRITICAL' ? 'critical-pulse' : ''}`}
                      style={{ background: urg.ink }}
                    />

                    <span className="block px-3 py-2.5 pl-3.5">
                      <span className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span aria-hidden className="text-xs">{TYPE_ICONS[report.type] || '📋'}</span>
                          <span className={`chip ${urg.chip}`}>{report.urgency}</span>
                        </span>
                        <span className="mono shrink-0 text-2xs text-ink-3">{timeAgo(report.timeReported)}</span>
                      </span>

                      <span className="block truncate text-sm font-semibold leading-snug text-ink-1">
                        {report.condition}
                      </span>

                      <span className="mt-1 flex items-center gap-1.5 text-ink-3">
                        <MapPin size={11} className="shrink-0" aria-hidden />
                        <span className="truncate min-w-0 text-xs">{report.location.landmarkText}</span>
                      </span>

                      <span className="mono mt-1.5 flex items-center justify-between gap-2 text-2xs text-ink-3">
                        <span className="truncate">{report.type.replace('_', ' ')}</span>
                        <span className="flex shrink-0 items-center gap-1">👥 {report.peopleCount}</span>
                      </span>
                    </span>
                  </button>
                );
              })}

              {sortedReports.length === 0 && (
                <div className="flex w-full flex-col items-center justify-center px-4 py-10 text-center lg:py-14">
                  <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/5" aria-hidden>
                    <Inbox size={20} className="text-ink-3" />
                  </span>
                  <p className="text-sm font-medium text-ink-2">No active incidents</p>
                  <p className="mt-1 text-xs text-ink-3">Press “Demos” to load sample calls</p>
                </div>
              )}
            </div>
          </section>

          {/* ═══ PANE 2: MAP ═══ */}
          <section aria-label="Incident map" className="relative min-h-0 min-w-0 overflow-hidden">
            <DispatcherMap
              incidents={reports}
              selectedIncident={selectedReport}
              onSelectIncident={handleSelectIncident}
              isRightPanelOpen={!!selectedReport}
            />

            {/* Filters — one column, kept clear of the map controls */}
            <div className="absolute left-3 top-3 z-20 flex max-w-[calc(100%_-_5rem)] flex-col gap-1.5">
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                {ALL_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    aria-pressed={selectedType === type}
                    className={`btn btn-sm shrink-0 ${
                      selectedType === type ? 'btn-primary' : 'border border-[var(--line)] bg-[rgba(9,9,11,0.88)] text-ink-3 hover:text-ink-1'
                    }`}
                  >
                    {type === 'All' ? 'All' : type.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                {ALL_URGENCIES.map(u => (
                  <button
                    key={u.label}
                    type="button"
                    onClick={() => setSelectedUrgency(u.value)}
                    aria-pressed={selectedUrgency === u.value}
                    className={`btn btn-sm shrink-0 ${
                      selectedUrgency === u.value ? 'btn-primary' : 'border border-[var(--line)] bg-[rgba(9,9,11,0.88)] text-ink-3 hover:text-ink-1'
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ═══ PANE 3: INCIDENT DETAIL ═══ */}
          {selectedReport && (
            <div className="detail-pane">
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
