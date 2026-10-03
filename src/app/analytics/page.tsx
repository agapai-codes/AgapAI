'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { ArrowLeft, Activity, Clock, AlertTriangle, CheckCircle2, BarChart3, TrendingUp } from 'lucide-react';
import type { Incident } from '../../types/incident';

/** Status tone — four accents, no per-status hue. */
const STATUS_TONE: Record<string, string> = {
  PENDING: 'var(--warning)',
  REVIEWING: 'var(--info)',
  PRIORITIZED: 'var(--critical)',
  DISPATCHED: 'var(--info)',
  EN_ROUTE: 'var(--info)',
  ARRIVED: 'var(--success)',
  RESOLVED: 'var(--success)',
};

const URGENCY_TONE: Record<string, string> = {
  CRITICAL: 'var(--critical)',
  HIGH: 'var(--critical)',
  MEDIUM: 'var(--warning)',
  LOW: 'var(--success)',
};

/** The readout band: label above, mono value below, hairline dividers. */
function Readout({ label, value, ink, icon: Icon }: {
  label: string;
  value: string | number;
  ink?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="flex min-w-[104px] flex-1 flex-col justify-center border-r border-[var(--line-faint)] px-4 py-3 last:border-r-0">
      <span className="data-label data-label-tight flex items-center gap-1.5">
        {Icon && <Icon size={11} aria-hidden />}
        {label}
      </span>
      <span className="readout mt-1 text-2xl leading-none" style={{ color: ink }}>
        {value}
      </span>
    </div>
  );
}

/** One horizontal bar row shared by the urgency / type / status breakdowns. */
function BarRow({ label, count, total, ink, mono }: {
  label: string;
  count: number;
  total: number;
  ink: string;
  mono?: boolean;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <li className="grid grid-cols-[7rem_1fr_4.5rem] items-center gap-3">
      <span className={`truncate text-[12px] text-ink-2 ${mono ? 'mono uppercase' : ''}`}>{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <span
          className="block h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: ink }}
        />
      </span>
      <span className="mono text-right text-[12px] text-ink-3">
        {count}
        <span className="ml-1 text-ink-3/70">({pct}%)</span>
      </span>
    </li>
  );
}

export default function AnalyticsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/incidents', { cache: 'no-store' })
      .then(r => r.json())
      .then(p => { if (p.success) setIncidents(p.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const total = incidents.length;
    const resolved = incidents.filter(i => i.status === 'RESOLVED').length;
    const active = total - resolved;
    const critical = incidents.filter(i => i.urgency === 'CRITICAL').length;
    const high = incidents.filter(i => i.urgency === 'HIGH').length;
    const medium = incidents.filter(i => i.urgency === 'MEDIUM').length;
    const low = incidents.filter(i => i.urgency === 'LOW').length;

    // Type distribution
    const types: Record<string, number> = {};
    incidents.forEach(i => { types[i.type] = (types[i.type] || 0) + 1; });

    // Status distribution
    const statuses: Record<string, number> = {};
    incidents.forEach(i => { statuses[i.status] = (statuses[i.status] || 0) + 1; });

    // Average response time (dispatched - created)
    const responseTimes = incidents
      .filter(i => i.dispatched_at && i.timestamp)
      .map(i => (new Date(i.dispatched_at!).getTime() - new Date(i.timestamp).getTime()) / 60000);
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    // Incidents per hour (last 24h)
    const now = Date.now();
    const last24h = incidents.filter(i => now - new Date(i.timestamp).getTime() < 86400000);
    const hourly = Array.from({ length: 24 }, (_, h) => {
      const hourStart = now - (24 - h) * 3600000;
      const hourEnd = hourStart + 3600000;
      return last24h.filter(i => {
        const t = new Date(i.timestamp).getTime();
        return t >= hourStart && t < hourEnd;
      }).length;
    });

    return { total, resolved, active, critical, high, medium, low, types, statuses, avgResponseTime, hourly };
  }, [incidents]);

  const peak = Math.max(1, ...stats.hourly);
  const typeRows = Object.entries(stats.types).sort((a, b) => b[1] - a[1]);
  const statusRows = Object.entries(stats.statuses).sort((a, b) => b[1] - a[1]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh_-_var(--banner-h,0px))] items-center justify-center bg-surface-0">
        <div className="text-center" role="status" aria-label="Loading analytics">
          <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-ink-1" />
          <p className="data-label">Loading analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh_-_var(--banner-h,0px))] bg-surface-0 text-ink-1">
      {/* Header */}
      <header className="chrome sticky top-0 z-40 flex h-14 items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/logo.jpg" alt="" width={22} height={22} className="rounded-md" />
          <span className="text-sm font-extrabold uppercase tracking-[0.14em]">
            Agap<span className="text-[var(--critical)]">AI</span>
          </span>
          <span className="chip chip-neutral">Analytics</span>
        </div>
        <a href="/dispatcher" className="btn btn-sm btn-quiet" aria-label="Back to dispatcher dashboard">
          <ArrowLeft size={13} aria-hidden />
          <span className="hidden sm:inline">Dispatcher</span>
        </a>
      </header>

      <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Incident analytics</h1>
            <p className="data-label mt-1">Operations readout · rolling 24 hours</p>
          </div>
          <span className="mono text-[11px] text-ink-3">
            {stats.total} records
          </span>
        </div>

        {/* ── READOUT BAND ── */}
        <section className="panel flex flex-wrap overflow-hidden" aria-label="Key metrics">
          <Readout label="Total" value={stats.total} icon={Activity} />
          <Readout label="Active" value={stats.active} ink="var(--warning)" icon={AlertTriangle} />
          <Readout label="Resolved" value={stats.resolved} ink="var(--success)" icon={CheckCircle2} />
          <Readout
            label="Avg response"
            value={`${stats.avgResponseTime.toFixed(0)}m`}
            ink="var(--info)"
            icon={Clock}
          />
        </section>

        {/* ── 24H HOURLY HISTOGRAM ── */}
        <section className="panel p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="data-label flex items-center gap-2">
              <BarChart3 size={12} aria-hidden /> Incidents per hour
            </h2>
            <span className="mono text-[11px] text-ink-3">peak {peak}</span>
          </div>

          {/* Chart */}
          <div
            className="flex h-36 items-end gap-[3px]"
            role="img"
            aria-label={`Incidents per hour over the last 24 hours. Peak ${peak}.`}
          >
            {stats.hourly.map((count, h) => {
              const hourLabel = new Date(Date.now() - (24 - h) * 3600000).getHours();
              return (
                <div key={h} className="group relative flex h-full flex-1 items-end">
                  <div
                    className="w-full rounded-sm transition-colors"
                    style={{
                      height: `${Math.max(count > 0 ? 6 : 2, (count / peak) * 100)}%`,
                      background: count > 0 ? 'var(--info)' : 'rgba(255,255,255,0.08)',
                    }}
                    title={`${String(hourLabel).padStart(2, '0')}:00 — ${count} incident${count === 1 ? '' : 's'}`}
                  />
                </div>
              );
            })}
          </div>

          {/* Axis */}
          <div className="mono mt-2 flex justify-between border-t border-[var(--line-faint)] pt-2 text-[11px] text-ink-3">
            <span>-24h</span>
            <span>-18h</span>
            <span>-12h</span>
            <span>-6h</span>
            <span>now</span>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* ── URGENCY ── */}
          <section className="panel p-4 sm:p-5">
            <h2 className="data-label mb-4 flex items-center gap-2">
              <AlertTriangle size={12} aria-hidden /> By urgency
            </h2>
            <ul className="space-y-3">
              {[
                { label: 'Critical', value: stats.critical, ink: URGENCY_TONE.CRITICAL },
                { label: 'High', value: stats.high, ink: URGENCY_TONE.HIGH },
                { label: 'Medium', value: stats.medium, ink: URGENCY_TONE.MEDIUM },
                { label: 'Low', value: stats.low, ink: URGENCY_TONE.LOW },
              ].map(u => (
                <BarRow key={u.label} label={u.label} count={u.value} total={stats.total} ink={u.ink} />
              ))}
            </ul>
          </section>

          {/* ── TYPE ── */}
          <section className="panel p-4 sm:p-5">
            <h2 className="data-label mb-4 flex items-center gap-2">
              <TrendingUp size={12} aria-hidden /> By type
            </h2>
            {typeRows.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-ink-3">No incidents recorded</p>
            ) : (
              <ul className="space-y-3">
                {typeRows.map(([type, count]) => (
                  <BarRow
                    key={type}
                    label={type.replace('_', ' ')}
                    count={count}
                    total={stats.total}
                    ink="var(--info)"
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ── STATUS ── */}
        <section className="panel p-4 sm:p-5">
          <h2 className="data-label mb-4">By status</h2>
          {statusRows.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-3">No incidents recorded</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {statusRows.map(([status, count]) => {
                const tone = STATUS_TONE[status] || 'var(--text-3)';
                return (
                  <li key={status} className="well flex items-center justify-between gap-2 px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="status-dot" style={{ background: tone }} aria-hidden />
                      <span className="mono truncate text-[11px] uppercase tracking-wide text-ink-3">
                        {status}
                      </span>
                    </span>
                    <span className="mono text-[15px] font-bold" style={{ color: tone }}>
                      {count}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
