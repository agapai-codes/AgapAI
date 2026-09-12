'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster, toast } from 'sonner';
import { EmergencyReport } from '@/lib/types';
import MapView from '@/components/MapView';
import { Search, ArrowLeft, MapPin, Shield, Menu, X, Clock, Users, AlertTriangle, CheckCircle2, Radio } from 'lucide-react';

const demoReports: EmergencyReport[] = [
  { id: 'RPT-001', transcript: 'The floodwater is rising fast. Our family is trapped on the second floor.', incident_type: 'disaster', condition: 'trapped, floodwater, children', location_description: 'Brgy. Pala-o, Iligan City', latitude: 8.2345, longitude: 124.2398, people_affected: 5, hazards: ['rising floodwater', 'trapped', 'children at risk'], urgency: 'critical', urgency_reason: 'Family trapped with children — immediate rescue', first_aid: 'Move to highest floor. Do NOT walk through water.', timestamp: new Date(Date.now() - 120000), status: 'pending' },
  { id: 'RPT-002', transcript: 'Tricycle collision at Sabayle Street. Driver bleeding, passenger has broken arm.', incident_type: 'accident', condition: 'head wound, possible fracture', location_description: 'Sabayle Street, Iligan City', latitude: 8.2267, longitude: 124.2534, people_affected: 2, hazards: ['road accident', 'bleeding'], urgency: 'high', urgency_reason: 'Two injured from vehicle collision', first_aid: 'Apply pressure to wound. Do NOT move fracture.', timestamp: new Date(Date.now() - 300000), status: 'dispatched' },
  { id: 'RPT-003', transcript: 'Fire in neighbor house on V. Corral Street. Spreading to adjacent houses.', incident_type: 'fire', condition: 'no injuries reported', location_description: 'V. Corral St, Iligan City', latitude: 8.2312, longitude: 124.2478, people_affected: 12, hazards: ['active fire', 'spreading'], urgency: 'high', urgency_reason: 'Fire spreading to adjacent structures', first_aid: 'Evacuate area immediately. Close doors.', timestamp: new Date(Date.now() - 180000), status: 'dispatched' },
  { id: 'RPT-004', transcript: 'Lolo having chest pains and difficulty breathing. He is 72 with hypertension.', incident_type: 'medical', condition: 'chest pain, breathing difficulty', location_description: 'Saduc Road, Iligan City', latitude: 8.2198, longitude: 124.2512, people_affected: 1, hazards: ['elderly', 'cardiac'], urgency: 'critical', urgency_reason: 'Possible heart attack', first_aid: 'Help sit upright. Loosen tight clothing.', timestamp: new Date(Date.now() - 60000), status: 'pending' },
  { id: 'RPT-005', transcript: 'Cracks on wall after earthquake. Students evacuating.', incident_type: 'disaster', condition: 'structural damage', location_description: 'MSU-IIT Engineering', latitude: 8.2280, longitude: 124.2452, people_affected: 50, hazards: ['structural damage', 'aftershock'], urgency: 'high', urgency_reason: 'Building damage after earthquake', first_aid: 'Evacuate via stairs NOT elevator.', timestamp: new Date(Date.now() - 90000), status: 'pending' },
  { id: 'RPT-006', transcript: 'Child fell from mango tree. Cannot move left leg.', incident_type: 'medical', condition: 'possible leg fracture', location_description: 'Buru-un, Iligan City', latitude: 8.2156, longitude: 124.2389, people_affected: 1, hazards: ['pediatric injury'], urgency: 'medium', urgency_reason: 'Child with possible fracture', first_aid: 'Do NOT move leg. Apply ice.', timestamp: new Date(Date.now() - 600000), status: 'resolved' },
];

export default function Dashboard() {
  const [reports, setReports] = useState<EmergencyReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [time, setTime] = useState('');
  const [tab, setTab] = useState<'transcript' | 'ai' | 'firstaid'>('transcript');
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTime(new Date().toLocaleTimeString());
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('agap-reports') || '[]');
      setReports(s.length > 0 ? s.map((r: EmergencyReport) => ({ ...r, timestamp: new Date(r.timestamp) })) : demoReports);
    } catch { setReports(demoReports); }
  }, []);

  const filtered = useMemo(() => reports.filter(r => {
    const uf = filter === 'all' || r.urgency === filter;
    const sf = search === '' || r.transcript.toLowerCase().includes(search.toLowerCase()) || r.location_description.toLowerCase().includes(search.toLowerCase());
    return uf && sf;
  }), [reports, filter, search]);

  const sel = reports.find(r => r.id === selectedId);

  const stats = useMemo(() => ({
    total: reports.length,
    critical: reports.filter(r => r.urgency === 'critical').length,
    pending: reports.filter(r => r.status === 'pending').length,
    dispatched: reports.filter(r => r.status === 'dispatched').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
  }), [reports]);

  const ucounts = useMemo(() => ({
    all: reports.length,
    critical: reports.filter(r => r.urgency === 'critical').length,
    high: reports.filter(r => r.urgency === 'high').length,
    medium: reports.filter(r => r.urgency === 'medium').length,
    low: reports.filter(r => r.urgency === 'low').length,
  }), [reports]);

  const updateStatus = (id: string, s: EmergencyReport['status']) => {
    setReports(p => p.map(r => r.id === id ? { ...r, status: s } : r));
    toast.success('UPDATED', { description: `Marked ${s.toUpperCase()}` });
  };

  const overrideUrgency = (id: string, u: EmergencyReport['urgency']) => {
    setReports(p => p.map(r => r.id === id ? { ...r, urgency: u } : r));
    toast.success('OVERRIDE', { description: `Priority set to ${u.toUpperCase()}` });
  };

  const timeAgo = (d: Date) => {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  };

  const uColor = (u: string) => ({ critical: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#10B981' }[u] || '#6B7280');
  const uBg = (u: string) => ({ critical: 'bg-[#EF4444]', high: 'bg-[#F59E0B]', medium: 'bg-[#3B82F6]', low: 'bg-[#10B981]' }[u] || 'bg-[#6B7280]');
  const uIcon = (t: string) => ({ medical: '🏥', fire: '🔥', accident: '🚗', disaster: '🌪️' }[t] || '📋');
  const sColor = (s: string) => ({ pending: '#F59E0B', dispatched: '#3B82F6', resolved: '#10B981' }[s] || '#6B7280');

  return (
    <div className="h-screen flex flex-col bg-[#0B1120] text-[#F9FAFB] overflow-hidden">
      <Toaster position="top-right" theme="dark" />

      {/* HEADER */}
      <header className="h-11 bg-[#111827] border-b border-[#1E3A5F] px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-[#9CA3AF] cursor-pointer p-1" aria-label="Toggle menu" aria-expanded={menuOpen}>
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <Image src="/logo.jpg" alt="AgapAI" width={24} height={24} className="object-contain" />
          <span className="font-bold text-sm tracking-tight">AGAP<span className="text-[#EF4444]">AI</span></span>
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#10B981]/10 border border-[#10B981]/30">
            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] live-indicator" />
            <span className="text-[#10B981] text-[9px] font-bold" style={{ fontFamily: 'var(--font-mono)' }}>LIVE</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {mounted && <span className="text-[#6B7280] text-xs" style={{ fontFamily: 'var(--font-mono)' }}>{time}</span>}
          <a href="/" className="text-[#9CA3AF] hover:text-[#F9FAFB] text-xs flex items-center gap-1">
            <ArrowLeft size={12} /> CITIZEN
          </a>
        </div>
      </header>

      {/* STATS */}
      <div className="px-3 py-2 bg-[#111827] border-b border-[#1E3A5F] shrink-0">
        <div className="grid grid-cols-5 gap-2">
          {[
            { l: 'TOTAL', v: stats.total, c: '#3B82F6' },
            { l: 'CRIT', v: stats.critical, c: '#EF4444' },
            { l: 'PEND', v: stats.pending, c: '#F59E0B' },
            { l: 'DISP', v: stats.dispatched, c: '#3B82F6' },
            { l: 'DONE', v: stats.resolved, c: '#10B981' },
          ].map(s => (
            <div key={s.l} className="flex items-center gap-2 px-2 py-1.5 bg-[#0B1120] border border-[#1E3A5F]">
              <div className="w-1 h-6" style={{ backgroundColor: s.c }} />
              <div>
                <div className="text-[8px] text-[#6B7280]" style={{ fontFamily: 'var(--font-mono)' }}>{s.l}</div>
                <div className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: s.c }}>{s.v}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN 3-PANEL */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* SIDEBAR */}
        <div className={`${menuOpen ? 'absolute inset-0 z-30 bg-[#111827] flex flex-col' : 'hidden'} md:relative md:flex md:w-64 lg:w-72 flex-col border-r border-[#1E3A5F] shrink-0`}>
          <div className="p-2 border-b border-[#1E3A5F]">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <Input placeholder="SEARCH..." value={search} onChange={e => setSearch(e.target.value)}
                className="pl-7 bg-[#0B1120] border-[#1E3A5F] text-[#F9FAFB] placeholder-[#6B7280] focus:border-[#3B82F6] rounded-none h-7 text-[11px]" style={{ fontFamily: 'var(--font-mono)' }} />
            </div>
          </div>
          <div className="px-2 py-1.5 border-b border-[#1E3A5F] flex gap-1 flex-wrap">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-1.5 py-0.5 rounded-none text-[8px] font-bold cursor-pointer ${
                  filter === f ? (f === 'critical' ? 'bg-[#EF4444] text-white' : f === 'high' ? 'bg-[#F59E0B] text-[#0B1120]' : f === 'medium' ? 'bg-[#3B82F6] text-white' : f === 'low' ? 'bg-[#10B981] text-white' : 'bg-[#3B82F6] text-white') : 'bg-[#1F2937] text-[#6B7280]'
                }`} style={{ fontFamily: 'var(--font-mono)' }}>
                {f === 'all' ? 'ALL' : f.toUpperCase()} ({ucounts[f]})
              </button>
            ))}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1.5 space-y-1">
              {filtered.length === 0 ? (
                <div className="text-center text-[#6B7280] py-6">
                  <Shield size={24} className="mx-auto mb-1 opacity-30" />
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px' }}>NO INCIDENTS</p>
                </div>
              ) : filtered.map(r => (
                <button key={r.id} onClick={() => { setSelectedId(r.id); setTab('transcript'); setMenuOpen(false); }}
                  className={`w-full text-left p-2 cursor-pointer transition-colors border-l-[3px] focus-visible:ring-1 focus-visible:ring-[#3B82F6] focus-visible:outline-none ${selectedId === r.id ? 'bg-[#243347]' : 'bg-[#111827] hover:bg-[#1F2937]'}`}
                  style={{ borderLeftColor: uColor(r.urgency) }}>
                  <div className="flex items-start justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs shrink-0">{uIcon(r.incident_type)}</span>
                      <div className="min-w-0">
                        <p className="font-bold text-[10px] uppercase truncate">{r.incident_type.replace('_', ' ')}</p>
                        <p className="text-[#6B7280] text-[9px] truncate" style={{ fontFamily: 'var(--font-mono)' }}>{r.location_description}</p>
                      </div>
                    </div>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ml-1 mt-1 ${r.urgency === 'critical' ? 'marker-pulse' : ''}`} style={{ backgroundColor: uColor(r.urgency) }} />
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[8px] text-[#6B7280]" style={{ fontFamily: 'var(--font-mono)' }}>{timeAgo(r.timestamp)}</span>
                    <Badge variant="outline" className="text-[7px] px-1 py-0 rounded-none" style={{ fontFamily: 'var(--font-mono)', borderColor: sColor(r.status), color: sColor(r.status) }}>
                      {r.status.toUpperCase()}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* MAP */}
        <div className="hidden md:flex flex-col flex-1 min-w-0">
          <MapView reports={reports} selectedReportId={selectedId || undefined} onReportSelect={setSelectedId} />
        </div>

        {/* DETAIL */}
        <div className="hidden md:flex flex-col w-80 lg:w-96 border-l border-[#1E3A5F] shrink-0 bg-[#111827]">
          {sel ? (
            <>
              <div className="px-3 py-2.5 border-b border-[#1E3A5F] flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{uIcon(sel.incident_type)}</span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs uppercase truncate">{sel.incident_type.replace('_', ' ')}</h3>
                    <p className="text-[#6B7280] text-[9px] truncate" style={{ fontFamily: 'var(--font-mono)' }}>{sel.location_description}</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Badge className="text-white border-0 rounded-none text-[9px]" style={{ fontFamily: 'var(--font-mono)', backgroundColor: uColor(sel.urgency) }}>{sel.urgency.toUpperCase()}</Badge>
                  <Badge variant="outline" className="rounded-none text-[9px]" style={{ fontFamily: 'var(--font-mono)', borderColor: sColor(sel.status), color: sColor(sel.status) }}>{sel.status.toUpperCase()}</Badge>
                </div>
              </div>
              <div className="flex border-b border-[#1E3A5F]">
                {(['transcript', 'ai', 'firstaid'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 px-2 py-1.5 text-[9px] font-bold cursor-pointer border-b-2 transition-colors ${tab === t ? 'border-[#3B82F6] text-[#F9FAFB] bg-[#3B82F6]/10' : 'border-transparent text-[#6B7280] hover:text-[#9CA3AF]'}`}
                    style={{ fontFamily: 'var(--font-mono)' }}>
                    {t === 'transcript' ? 'TRANSCRIPT' : t === 'ai' ? 'AI' : 'FIRST AID'}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {tab === 'transcript' && (
                  <>
                    <div className="bg-[#0B1120] p-3 border border-[#1E3A5F]">
                      <div className="text-[9px] text-[#6B7280] mb-1" style={{ fontFamily: 'var(--font-mono)' }}>VOICE REPORT</div>
                      <div className="text-xs italic text-[#9CA3AF]">&quot;{sel.transcript}&quot;</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#0B1120] p-2 border border-[#1E3A5F]">
                        <div className="text-[8px] text-[#6B7280]" style={{ fontFamily: 'var(--font-mono)' }}>CONDITION</div>
                        <div className="text-[11px] capitalize">{sel.condition}</div>
                      </div>
                      <div className="bg-[#0B1120] p-2 border border-[#1E3A5F]">
                        <div className="text-[8px] text-[#6B7280]" style={{ fontFamily: 'var(--font-mono)' }}>PEOPLE</div>
                        <div className="text-[11px]" style={{ fontFamily: 'var(--font-mono)' }}>{sel.people_affected}</div>
                      </div>
                    </div>
                    {sel.hazards.length > 0 && (
                      <div>
                        <div className="text-[8px] text-[#6B7280] mb-1" style={{ fontFamily: 'var(--font-mono)' }}>HAZARDS</div>
                        <div className="flex flex-wrap gap-1">
                          {sel.hazards.map((h, i) => <span key={i} className="px-1.5 py-0.5 text-[8px] border border-[#EF4444] text-[#EF4444]" style={{ fontFamily: 'var(--font-mono)' }}>{h.toUpperCase()}</span>)}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {tab === 'ai' && (
                  <>
                    <div className="bg-[#0B1120] p-3 border border-[#1E3A5F]">
                      <div className="text-[9px] text-[#6B7280] mb-1" style={{ fontFamily: 'var(--font-mono)' }}>ASSESSMENT</div>
                      <div className="font-bold text-sm">PRIORITY: <span className="uppercase">{sel.urgency}</span></div>
                      <div className="text-[#9CA3AF] text-xs mt-1">{sel.urgency_reason}</div>
                    </div>
                    <div className="bg-[#0B1120] p-3 border border-[#1E3A5F]">
                      <div className="text-[9px] text-[#6B7280] mb-2" style={{ fontFamily: 'var(--font-mono)' }}>EXTRACTED DATA</div>
                      {Object.entries({ 'TYPE': sel.incident_type, 'CONDITION': sel.condition, 'LOCATION': sel.location_description, 'PEOPLE': sel.people_affected }).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-[11px] py-1 border-b border-[#1E3A5F]/50">
                          <span className="text-[#6B7280]" style={{ fontFamily: 'var(--font-mono)' }}>{k}</span>
                          <span className="capitalize">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {tab === 'firstaid' && (
                  <div className="bg-[#10B981]/5 p-3 border border-[#10B981]/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🏥</span>
                      <div>
                        <p className="font-bold text-[#10B981] text-xs">FIRST-AID PROTOCOL</p>
                        <p className="text-[#6B7280] text-[9px]" style={{ fontFamily: 'var(--font-mono)' }}>VALIDATED GUIDELINES</p>
                      </div>
                    </div>
                    <div className="bg-[#0B1120] p-3 border border-[#10B981]/20">
                      <p className="text-xs leading-relaxed">{sel.first_aid}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-3 py-2 border-t border-[#1E3A5F] bg-[#0B1120] flex items-center justify-between shrink-0">
                <div className="flex gap-1">
                  {(['critical', 'high', 'medium', 'low'] as const).map(u => (
                    <button key={u} onClick={() => overrideUrgency(sel.id, u)}
                      className={`px-1.5 py-0.5 text-[8px] font-bold cursor-pointer ${sel.urgency === u ? 'text-white' : 'bg-[#1F2937] text-[#6B7280]'}`}
                      style={{ fontFamily: 'var(--font-mono)', backgroundColor: sel.urgency === u ? uColor(u) : undefined }}>
                      {u.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  {sel.status !== 'dispatched' && <button onClick={() => updateStatus(sel.id, 'dispatched')} className="px-2 py-0.5 text-[9px] font-bold bg-[#3B82F6] text-white cursor-pointer" style={{ fontFamily: 'var(--font-mono)' }}>DISPATCH</button>}
                  {sel.status !== 'resolved' && <button onClick={() => updateStatus(sel.id, 'resolved')} className="px-2 py-0.5 text-[9px] font-bold border border-[#10B981] text-[#10B981] cursor-pointer" style={{ fontFamily: 'var(--font-mono)' }}>RESOLVE</button>}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#6B7280]">
              <div className="text-center">
                <MapPin size={40} className="mx-auto mb-2 opacity-20" />
                <p className="text-[11px]" style={{ fontFamily: 'var(--font-mono)' }}>SELECT AN INCIDENT</p>
                <p className="text-[9px] mt-1 opacity-60">Click sidebar or map marker</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
