'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Toaster, toast } from 'sonner';
import LiveMap from '../components/LiveMap';
import { Search, ArrowLeft, Shield, Menu, X, CheckCircle2, AlertTriangle, ShieldAlert, Activity, MapPin } from 'lucide-react';
import { Incident } from '../types/incident';

const INCIDENT_ICONS: Record<string, string> = { FIRE: '🔥', ACCIDENT: '🚗', MEDICAL: '🏥', DISASTER: '🌪️' };

const TYPE_CONFIG: Record<string, { color: string; border: string; from: string }> = {
  FIRE: { color: '#ef4444', border: 'border-l-red-500', from: 'from-red-500/10' },
  ACCIDENT: { color: '#f97316', border: 'border-l-orange-500', from: 'from-orange-500/10' },
  MEDICAL: { color: '#3b82f6', border: 'border-l-blue-500', from: 'from-blue-500/10' },
  DISASTER: { color: '#a855f7', border: 'border-l-purple-500', from: 'from-purple-500/10' },
};

const MOCK: Incident[] = [
  { id: 'INC-001', type: 'FIRE', location: 'V. Carral St, Poblacion, Iligan City', description: 'Residential structural fire spreading to adjacent building.', coordinates: { lng: 124.2478, lat: 8.2312 }, status: 'PENDING', timestamp: '2m ago', reporter: 'Juan Dela Cruz' },
  { id: 'INC-002', type: 'MEDICAL', location: 'Buru-un, Iligan City', description: 'Severe respiratory distress requiring immediate oxygen deployment.', coordinates: { lng: 124.2389, lat: 8.2156 }, status: 'PENDING', timestamp: '5m ago', reporter: 'Maria Santos' },
  { id: 'INC-003', type: 'ACCIDENT', location: 'MSU-IIT Engineering, Iligan City', description: 'Two-vehicle collision near the gate boundary.', coordinates: { lng: 124.2452, lat: 8.2280 }, status: 'DISPATCHED', timestamp: '10m ago', reporter: 'Prof. Almaran' },
  { id: 'INC-004', type: 'DISASTER', location: 'Brgy. Pala-o, Iligan City', description: 'Localized flash flood blocking intersection lanes.', coordinates: { lng: 124.2398, lat: 8.2345 }, status: 'PENDING', timestamp: '15m ago', reporter: 'K. Vergara' },
  { id: 'INC-005', type: 'FIRE', location: 'Sabayle St, Tibanga, Iligan City', description: 'Electrical transformer sparking over market structures.', coordinates: { lng: 124.2534, lat: 8.2267 }, status: 'DISPATCHED', timestamp: '20m ago', reporter: 'A. Vergara' },
];

interface DispatchViewProps { externalIncidents?: Incident[]; }

export default function DispatcherDashboard({ externalIncidents = [] }: DispatchViewProps) {
  const [incidents, setIncidents] = useState<Incident[]>(MOCK);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState('');

  useEffect(() => {
    if (externalIncidents.length > 0) {
      setIncidents(prev => {
        const existing = new Set(prev.map(i => i.id));
        return [...externalIncidents.filter(i => !existing.has(i.id)), ...prev];
      });
    }
  }, [externalIncidents]);

  useEffect(() => {
    setMounted(true);
    setTime(new Date().toLocaleTimeString());
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  const metrics = useMemo(() => ({
    total: incidents.length,
    critical: incidents.filter(i => i.status === 'PENDING' && (i.type === 'FIRE' || i.type === 'DISASTER')).length,
    dispatched: incidents.filter(i => i.status === 'DISPATCHED').length,
    resolved: incidents.filter(i => i.status === 'RESOLVED').length,
  }), [incidents]);

  const filtered = useMemo(() => incidents.filter(i => {
    const ms = i.location.toLowerCase().includes(search.toLowerCase()) || i.type.toLowerCase().includes(search.toLowerCase());
    const mt = selectedType === 'All' || i.type === selectedType;
    return ms && mt;
  }), [incidents, search, selectedType]);

  const handleSelect = (inc: Incident) => setActiveIncident(inc);

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
          <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', padding: '2px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>LIVE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', fontFamily: 'monospace', color: '#a1a1aa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(24,24,27,0.8)', border: '1px solid #27272a', borderRadius: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#71717a' }}>MODE:</span> COMMANDER
          </div>
          {mounted && <span>{time}</span>}
          <a href="/" style={{ color: '#71717a', textDecoration: 'none' }}><ArrowLeft size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Citizen</a>
        </div>
      </header>

      {/* METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '16px', background: '#09090b', flexShrink: 0, borderBottom: '1px solid #18181b', zIndex: 20 }}>
        {[
          { label: 'TOTAL INCIDENTS', value: metrics.total, icon: Activity, color: '#f4f4f5' },
          { label: 'CRITICAL PRIORITY', value: metrics.critical, icon: ShieldAlert, color: '#ef4444' },
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
        
        {/* SIDEBAR - 380px FIXED */}
        <div style={{ width: '380px', height: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid #18181b', background: '#09090b', zIndex: 20, overflow: 'hidden' }}>
          {/* Search + Filters */}
          <div style={{ padding: '16px', borderBottom: '1px solid #18181b', background: 'rgba(9,9,11,0.8)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#71717a' }} />
              <Input placeholder="Query dispatch records..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '36px', background: '#18181b', border: '1px solid #27272a', color: '#e4e4e7', height: '40px', width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
              {['All', 'FIRE', 'ACCIDENT', 'MEDICAL', 'DISASTER'].map(type => (
                <button key={type} onClick={() => setSelectedType(type)} style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer', flexShrink: 0, background: selectedType === type ? '#f4f4f5' : '#18181b', color: selectedType === type ? '#09090b' : '#a1a1aa' }}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* CARDS - SCROLLABLE */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#52525b', padding: '48px 0', fontSize: '14px' }}>No active telemetry matches.</div>
            ) : filtered.map(inc => {
              const config = TYPE_CONFIG[inc.type];
              const isSelected = activeIncident?.id === inc.id;
              return (
                <div key={inc.id} onClick={() => handleSelect(inc)} style={{
                  background: 'rgba(24,24,27,0.4)',
                  border: `1px solid ${isSelected ? '#3f3f46' : '#27272a'}`,
                  borderLeft: `4px solid ${config.color}`,
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: isSelected ? '0 0 20px rgba(0,0,0,0.3)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{INCIDENT_ICONS[inc.type]}</span>
                    <span style={{ fontSize: '12px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: config.color }}>{inc.type}</span>
                    <span style={{ fontSize: '9px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '6px', border: `1px solid ${inc.status === 'PENDING' ? 'rgba(245,158,11,0.2)' : inc.status === 'DISPATCHED' ? 'rgba(96,165,250,0.2)' : 'rgba(34,197,94,0.2)'}`, color: inc.status === 'PENDING' ? '#fbbf24' : inc.status === 'DISPATCHED' ? '#60a5fa' : '#4ade80', background: inc.status === 'PENDING' ? 'rgba(245,158,11,0.05)' : inc.status === 'DISPATCHED' ? 'rgba(96,165,250,0.05)' : 'rgba(34,197,94,0.05)' }}>
                      {inc.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#d4d4d8', lineHeight: 1.5, marginBottom: '8px' }}>{inc.description}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '10px', color: '#71717a', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={10} />{inc.location}</span>
                    <span style={{ fontSize: '9px', color: '#52525b', fontFamily: 'monospace' }}>{inc.reporter}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MAP - FILL REMAINDER */}
        <div style={{ flex: 1, height: '100%', width: '100%', position: 'relative', background: '#09090b', zIndex: 10 }}>
          <LiveMap incidents={incidents} activeIncident={activeIncident} onIncidentClick={handleSelect} />
        </div>
      </div>
    </div>
  );
}
