'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { ArrowLeft, Activity, Clock, AlertTriangle, CheckCircle2, TrendingUp, BarChart3 } from 'lucide-react';
import type { Incident } from '../../types/incident';

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

    return { total, resolved, active, high, medium, low, types, statuses, avgResponseTime, hourly };
  }, [incidents]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Header */}
      <header className="h-12 min-h-[48px] border-b border-white/5 flex items-center justify-between px-4"
        style={{ background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-3">
          <Image src="/logo.jpg" alt="AgapAI" width={22} height={22} className="rounded-md" />
          <span className="font-extrabold text-sm tracking-wider uppercase">Agap<span className="text-red-500">AI</span></span>
          <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
            ANALYTICS
          </span>
        </div>
        <a href="/dispatcher" className="text-[10px] text-neutral-500 hover:text-white transition-colors flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/5">
          <ArrowLeft size={10} /> Dispatcher
        </a>
      </header>

      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-xl font-bold mb-6">Incident Analytics</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, icon: Activity, color: '#fafafa' },
            { label: 'Active', value: stats.active, icon: AlertTriangle, color: '#f97316' },
            { label: 'Resolved', value: stats.resolved, icon: CheckCircle2, color: '#22c55e' },
            { label: 'Avg Response', value: `${stats.avgResponseTime.toFixed(0)}m`, icon: Clock, color: '#60a5fa' },
          ].map(m => (
            <div key={m.label} className="rounded-xl p-4 border border-white/5" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold tracking-wider text-neutral-500 uppercase">{m.label}</span>
                <m.icon size={14} style={{ color: `${m.color}60` }} />
              </div>
              <p className="text-2xl font-black" style={{ color: m.color }}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Urgency Distribution */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'HIGH', value: stats.high, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
            { label: 'MEDIUM', value: stats.medium, color: '#eab308', bg: 'rgba(234,179,8,0.08)' },
            { label: 'LOW', value: stats.low, color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
          ].map(u => (
            <div key={u.label} className="rounded-xl p-4 border border-white/5" style={{ background: u.bg }}>
              <span className="text-[9px] font-bold tracking-wider uppercase" style={{ color: `${u.color}99` }}>{u.label}</span>
              <p className="text-xl font-black mt-1" style={{ color: u.color }}>{u.value}</p>
              <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${stats.total > 0 ? (u.value / stats.total) * 100 : 0}%`, background: u.color }} />
              </div>
            </div>
          ))}
        </div>

        {/* Type Distribution */}
        <div className="rounded-xl border border-white/5 p-4 mb-6" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <h2 className="text-[11px] font-bold tracking-wider text-neutral-500 uppercase mb-3 flex items-center gap-2">
            <BarChart3 size={12} /> Incidents by Type
          </h2>
          <div className="space-y-2">
            {Object.entries(stats.types).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <span className="text-[11px] text-neutral-300 w-24 truncate">{type.replace('_', ' ')}</span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(count / stats.total) * 100}%` }} />
                </div>
                <span className="text-[11px] font-mono text-neutral-400 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="rounded-xl border border-white/5 p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <h2 className="text-[11px] font-bold tracking-wider text-neutral-500 uppercase mb-3 flex items-center gap-2">
            <TrendingUp size={12} /> Incidents by Status
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(stats.statuses).map(([status, count]) => {
              const colors: Record<string, string> = {
                PENDING: '#fbbf24', DISPATCHED: '#60a5fa', EN_ROUTE: '#38bdf8',
                ARRIVED: '#818cf8', RESOLVED: '#22c55e', REVIEWING: '#a78bfa', PRIORITIZED: '#f472b6',
              };
              return (
                <div key={status} className="text-center p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <p className="text-lg font-black" style={{ color: colors[status] || '#71717a' }}>{count}</p>
                  <p className="text-[9px] text-neutral-500 font-mono uppercase">{status}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
