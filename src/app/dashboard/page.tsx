'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Toaster, toast } from 'sonner';
import { EmergencyReport } from '@/lib/types';
import MapView from '@/components/MapView';
import { Search, Activity, AlertTriangle, Clock, CheckCircle2, ArrowLeft, Radio, Users, MapPin, Shield, Menu, X } from 'lucide-react';

const demoReports: EmergencyReport[] = [
  {
    id: 'RPT-001',
    transcript: 'The floodwater is rising fast in our area. Our family is trapped on the second floor of our house. Water is already at the door. There are five of us including two children.',
    incident_type: 'disaster',
    condition: 'trapped, rising floodwater, children present',
    location_description: 'Brgy. Pala-o, Iligan City',
    latitude: 8.2345,
    longitude: 124.2398,
    people_affected: 5,
    hazards: ['rising floodwater', 'trapped', 'children at risk'],
    urgency: 'critical',
    urgency_reason: 'Family of 5 trapped by rising floodwater with children — immediate rescue required',
    first_aid: 'Move to the highest floor. Do NOT attempt to walk through fast-moving water. Signal for help from a window. Keep children warm and calm. Call emergency services.',
    timestamp: new Date(Date.now() - 120000),
    status: 'pending',
  },
  {
    id: 'RPT-002',
    transcript: 'There is a tricycle collision at Sabayle Street near the market. The driver is bleeding from his head and the passenger has a possible broken arm. Both are conscious but in pain.',
    incident_type: 'accident',
    condition: 'head wound, possible fracture, conscious, in pain',
    location_description: 'Sabayle Street, Tibanga Highway, Iligan City',
    latitude: 8.2267,
    longitude: 124.2534,
    people_affected: 2,
    hazards: ['road accident', 'bleeding', 'possible fracture'],
    urgency: 'high',
    urgency_reason: 'Two injured persons from vehicle collision — head wound with active bleeding requires immediate attention',
    first_aid: 'Apply firm direct pressure to the head wound with a clean cloth. Do NOT move the person with the suspected arm fracture. Keep both victims calm. Monitor for signs of concussion.',
    timestamp: new Date(Date.now() - 300000),
    status: 'dispatched',
  },
  {
    id: 'RPT-003',
    transcript: 'There is a fire in our neighbor\'s house on V. Corral Street. The family has evacuated but the fire is spreading to adjacent houses. Thick black smoke everywhere.',
    incident_type: 'fire',
    condition: 'no injuries reported, family evacuated',
    location_description: 'V. Corral St., Poblacion, Iligan City',
    latitude: 8.2312,
    longitude: 124.2478,
    people_affected: 12,
    hazards: ['active fire', 'spreading to adjacent houses', 'thick smoke', 'multiple families affected'],
    urgency: 'high',
    urgency_reason: 'Active residential fire spreading to adjacent structures — multiple families at risk',
    first_aid: 'Evacuate the area immediately. Do NOT attempt to fight the fire unless trained. Close doors behind you to slow fire spread. Move upwind from the smoke. Account for all family members.',
    timestamp: new Date(Date.now() - 180000),
    status: 'dispatched',
  },
  {
    id: 'RPT-004',
    transcript: 'My lolo is having chest pains and difficulty breathing. He is 72 years old with hypertension. He is sweating a lot and clutching his chest. We are at home on Saduc Road.',
    incident_type: 'medical',
    condition: 'chest pain, difficulty breathing, sweating, hypertension history',
    location_description: 'Saduc Road, Tubod, Iligan City',
    latitude: 8.2198,
    longitude: 124.2512,
    people_affected: 1,
    hazards: ['elderly patient', 'cardiac symptoms', 'hypertension'],
    urgency: 'critical',
    urgency_reason: 'Elderly patient with cardiac symptoms — possible heart attack requires immediate medical response',
    first_aid: 'Help the person sit upright in a comfortable position. Loosen tight clothing. If they have prescribed nitroglycerin, help them take it. If pain persists for more than 5 minutes, begin CPR.',
    timestamp: new Date(Date.now() - 60000),
    status: 'pending',
  },
  {
    id: 'RPT-005',
    transcript: 'There are visible cracks on the wall of the College of Engineering building after the earthquake tremor we just felt. Students are panicking and evacuating. Nobody seems injured yet.',
    incident_type: 'disaster',
    condition: 'no injuries reported, structural damage, panic',
    location_description: 'MSU-IIT College of Engineering, Iligan City',
    latitude: 8.2280,
    longitude: 124.2452,
    people_affected: 50,
    hazards: ['structural damage', 'aftershock risk', 'panic', 'building may be unstable'],
    urgency: 'high',
    urgency_reason: 'Structural damage to occupied building after earthquake — risk of collapse during aftershocks',
    first_aid: 'Evacuate the building immediately via stairs (NOT elevator). Move to open ground away from buildings. Account for all persons. Do NOT re-enter until cleared by structural engineers.',
    timestamp: new Date(Date.now() - 90000),
    status: 'pending',
  },
  {
    id: 'RPT-006',
    transcript: 'A child fell from a mango tree in our backyard. He is crying and cannot move his left leg. He is conscious and alert but the leg looks swollen. We are in Buru-un area.',
    incident_type: 'medical',
    condition: 'possible leg fracture, conscious, crying, swelling',
    location_description: 'Buru-un, Iligan City',
    latitude: 8.2156,
    longitude: 124.2389,
    people_affected: 1,
    hazards: ['pediatric injury', 'possible fracture'],
    urgency: 'medium',
    urgency_reason: 'Child with possible fracture — conscious and stable but requires medical evaluation',
    first_aid: 'Do NOT attempt to straighten or move the leg. Keep the child still and calm. Apply ice wrapped in cloth to reduce swelling. Immobilize the leg if possible. Seek medical evaluation for possible fracture.',
    timestamp: new Date(Date.now() - 600000),
    status: 'resolved',
  },
];

export default function Dashboard() {
  const [reports, setReports] = useState<EmergencyReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'transcript' | 'ai' | 'firstaid'>('transcript');
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('agap-reports') || '[]');
    if (stored.length > 0) {
      setReports(stored.map((r: EmergencyReport) => ({ ...r, timestamp: new Date(r.timestamp) })));
    } else {
      setReports(demoReports);
    }
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const matchesUrgency = filter === 'all' || r.urgency === filter;
      const matchesSearch = searchQuery === '' ||
        r.transcript.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.location_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.condition.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesUrgency && matchesSearch;
    });
  }, [reports, filter, searchQuery]);

  const selectedReport = reports.find(r => r.id === selectedReportId);

  const stats = useMemo(() => ({
    total: reports.length,
    critical: reports.filter(r => r.urgency === 'critical').length,
    pending: reports.filter(r => r.status === 'pending').length,
    dispatched: reports.filter(r => r.status === 'dispatched').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
  }), [reports]);

  const urgencyCounts = useMemo(() => ({
    all: reports.length,
    critical: reports.filter(r => r.urgency === 'critical').length,
    high: reports.filter(r => r.urgency === 'high').length,
    medium: reports.filter(r => r.urgency === 'medium').length,
    low: reports.filter(r => r.urgency === 'low').length,
  }), [reports]);

  const handleUpdateStatus = (reportId: string, status: EmergencyReport['status']) => {
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
    toast.success(`STATUS UPDATED`, { description: `Report marked as ${status.toUpperCase()}` });
  };

  const handleOverrideUrgency = (reportId: string, newUrgency: EmergencyReport['urgency']) => {
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, urgency: newUrgency } : r));
    toast.success(`PRIORITY OVERRIDE`, { description: `Urgency set to ${newUrgency.toUpperCase()}` });
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'border-l-[#DC2626]';
      case 'high': return 'border-l-[#F59E0B]';
      case 'medium': return 'border-l-[#3B82F6]';
      case 'low': return 'border-l-[#10B981]';
      default: return 'border-l-[#6B7280]';
    }
  };

  const getUrgencyBg = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-[#DC2626]';
      case 'high': return 'bg-[#F59E0B]';
      case 'medium': return 'bg-[#3B82F6]';
      case 'low': return 'bg-[#10B981]';
      default: return 'bg-[#6B7280]';
    }
  };

  const SidebarContent = () => (
    <>
      {/* Search */}
      <div className="p-3 border-b border-[#1E3A5F]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <Input
            placeholder="SEARCH INCIDENTS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[#080C14] border-[#1E3A5F] text-[#F9FAFB] placeholder-[#6B7280] focus:border-[#3B82F6] rounded-none font-mono text-xs"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 border-b border-[#1E3A5F]">
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded-none text-[10px] font-bold mono tracking-wider transition-all cursor-pointer ${
                filter === f
                  ? f === 'critical' ? 'bg-[#DC2626] text-white' :
                    f === 'high' ? 'bg-[#F59E0B] text-[#080C14]' :
                    f === 'medium' ? 'bg-[#3B82F6] text-white' :
                    f === 'low' ? 'bg-[#10B981] text-white' :
                    'bg-[#3B82F6] text-white'
                  : 'bg-[#1C2738] text-[#6B7280] hover:bg-[#243347] border border-[#1E3A5F]'
              }`}
            >
              {f === 'all' ? 'ALL' : f.toUpperCase()} ({urgencyCounts[f]})
            </button>
          ))}
        </div>
      </div>

      {/* Incident List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {filteredReports.length === 0 ? (
            <div className="text-center text-[#6B7280] py-12">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="mono text-xs">NO INCIDENTS FOUND</p>
            </div>
          ) : (
                filteredReports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => {
                      setSelectedReportId(report.id);
                      setActiveTab('transcript');
                      if (window.innerWidth < 768) setShowSidebar(false);
                    }}
                    className={`
                      w-full text-left p-3 cursor-pointer transition-colors border-l-4 focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:outline-none
                      ${getUrgencyColor(report.urgency)}
                      ${selectedReportId === report.id
                        ? 'tactical-card-active'
                        : 'bg-[#0F1520] hover:bg-[#1C2738] border-[#1E3A5F]'
                      }
                    `}
                  >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden="true">
                      {report.incident_type === 'medical' ? '🏥' :
                       report.incident_type === 'fire' ? '🔥' :
                       report.incident_type === 'accident' ? '🚗' :
                       report.incident_type === 'disaster' ? '🌪️' : '📋'}
                    </span>
                    <div>
                      <p className="font-bold text-xs uppercase tracking-wide">{report.incident_type.replace('_', ' ')}</p>
                      <p className="text-[#6B7280] text-[10px] mono flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{report.location_description}</span>
                      </p>
                    </div>
                  </div>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${getUrgencyBg(report.urgency)} ${report.urgency === 'critical' ? 'marker-pulse' : ''}`} />
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3 text-[10px] text-[#6B7280] mono">
                    <span>{formatTimeAgo(report.timestamp)}</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-2.5 h-2.5" />
                      {report.people_affected}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 rounded-none mono font-bold ${
                      report.status === 'pending' ? 'border-[#F59E0B] text-[#F59E0B]' :
                      report.status === 'dispatched' ? 'border-[#3B82F6] text-[#3B82F6]' :
                      'border-[#10B981] text-[#10B981]'
                    }`}
                  >
                    {report.status.toUpperCase()}
                  </Badge>
                </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
    </>
  );

  return (
    <div className="min-h-screen bg-[#080C14] text-[#F9FAFB] flex flex-col">
      <Toaster position="top-right" theme="dark" />

      {/* Header */}
      <header className="h-14 bg-[#0F1520] border-b border-[#1E3A5F] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger>
              <Button variant="ghost" size="icon" className="md:hidden text-[#9CA3AF] cursor-pointer" aria-label="Open incidents menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px] bg-[#0F1520] border-[#1E3A5F] p-0">
              <div className="h-full flex flex-col">
                <div className="p-3 border-b border-[#1E3A5F]">
                  <span className="data-label">INCIDENTS</span>
                </div>
                <SidebarContent />
              </div>
            </SheetContent>
          </Sheet>

          <img src="/logo.jpg" alt="AgapAI" className="w-8 h-8" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight">AGAP<span className="text-[#DC2626]">AI</span></span>
            <span className="text-[#6B7280] text-xs hidden sm:inline">DISPATCH</span>
          </div>
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-[#10B981]/10 border border-[#10B981]/30">
                <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] live-indicator" />
                <span className="text-[#10B981] text-[10px] mono font-bold">LIVE</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>System Online</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="data-label">TIME</p>
            <p className="text-sm mono">{currentTime.toLocaleTimeString()}</p>
          </div>
          <div className="h-8 w-px bg-[#1E3A5F] hidden sm:block" />
          <a href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-[#9CA3AF] hover:text-[#F9FAFB] cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">CITIZEN APP</span>
            </Button>
          </a>
        </div>
      </header>

      {/* Stats Row */}
      <div className="px-4 py-3 bg-[#0F1520] border-b border-[#1E3A5F] shrink-0">
        <div className="grid grid-cols-5 gap-2 md:gap-3">
          {[
            { label: 'TOTAL', value: stats.total, icon: Activity, color: '#3B82F6' },
            { label: 'CRITICAL', value: stats.critical, icon: AlertTriangle, color: '#DC2626' },
            { label: 'PENDING', value: stats.pending, icon: Clock, color: '#F59E0B' },
            { label: 'DISPATCHED', value: stats.dispatched, icon: Radio, color: '#3B82F6' },
            { label: 'RESOLVED', value: stats.resolved, icon: CheckCircle2, color: '#10B981' },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-2 px-2 md:px-3 py-2 bg-[#080C14] border border-[#1E3A5F] min-w-0">
              <stat.icon className="w-4 h-4 shrink-0" style={{ color: stat.color }} />
              <div className="min-w-0">
                <p className="data-label truncate">{stat.label}</p>
                <p className="text-lg font-bold mono" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-[340px] bg-[#0F1520] border-r border-[#1E3A5F] flex-col shrink-0`}>
          <SidebarContent />
        </div>

        {/* Right Side */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Map */}
          <div className="h-[45%] p-3 border-b border-[#1E3A5F]">
            <MapView
              reports={reports}
              selectedReportId={selectedReportId || undefined}
              onReportSelect={(id) => {
                setSelectedReportId(id);
                setActiveTab('transcript');
              }}
            />
          </div>

          {/* Detail Panel */}
          <div className="h-[55%] p-3 flex flex-col min-h-0 overflow-hidden">
            {selectedReport ? (
              <div className="flex-1 bg-[#0F1520] border border-[#1E3A5F] overflow-hidden flex flex-col min-h-0">
                {/* Detail Header */}
                <div className="px-4 py-3 border-b border-[#1E3A5F] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {selectedReport.incident_type === 'medical' ? '🏥' :
                       selectedReport.incident_type === 'fire' ? '🔥' :
                       selectedReport.incident_type === 'accident' ? '🚗' :
                       selectedReport.incident_type === 'disaster' ? '🌪️' : '📋'}
                    </span>
                    <div>
                      <h3 className="font-bold text-sm uppercase tracking-wide">{selectedReport.incident_type.replace('_', ' ')}</h3>
                      <p className="text-[#6B7280] text-[10px] mono flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" />
                        {selectedReport.location_description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${getUrgencyBg(selectedReport.urgency)} text-white border-0 rounded-none mono text-[10px]`}>
                      {selectedReport.urgency.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className={`rounded-none mono text-[10px] ${
                      selectedReport.status === 'pending' ? 'border-[#F59E0B] text-[#F59E0B]' :
                      selectedReport.status === 'dispatched' ? 'border-[#3B82F6] text-[#3B82F6]' :
                      'border-[#10B981] text-[#10B981]'
                    }`}>
                      {selectedReport.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[#1E3A5F] shrink-0">
                  {[
                    { id: 'transcript' as const, label: 'TRANSCRIPT' },
                    { id: 'ai' as const, label: 'AI ASSESSMENT' },
                    { id: 'firstaid' as const, label: 'FIRST AID' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 md:px-4 py-2.5 text-[10px] md:text-xs font-bold mono tracking-wider transition-colors cursor-pointer ${
                        activeTab === tab.id ? 'tab-active' : 'tab-inactive'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="p-4 overflow-y-auto flex-1 min-h-0">
                  {activeTab === 'transcript' && (
                    <div className="animate-fade-in space-y-4">
                      <div className="bg-[#080C14] p-4 border border-[#1E3A5F]">
                        <p className="data-label mb-2">ORIGINAL VOICE REPORT</p>
                        <p className="text-sm italic leading-relaxed text-[#9CA3AF]">&quot;{selectedReport.transcript}&quot;</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-[#080C14] p-3 border border-[#1E3A5F]">
                          <p className="data-label mb-1">CONDITION</p>
                          <p className="text-sm font-medium capitalize">{selectedReport.condition}</p>
                        </div>
                        <div className="bg-[#080C14] p-3 border border-[#1E3A5F]">
                          <p className="data-label mb-1">PEOPLE</p>
                          <p className="text-sm font-medium mono">{selectedReport.people_affected}</p>
                        </div>
                        <div className="bg-[#080C14] p-3 border border-[#1E3A5F]">
                          <p className="data-label mb-1">TIME</p>
                          <p className="text-sm font-medium mono">{new Date(selectedReport.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      {selectedReport.hazards.length > 0 && (
                        <div>
                          <p className="data-label mb-2">HAZARDS</p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedReport.hazards.map((hazard, i) => (
                              <Badge key={i} variant="outline" className="border-[#DC2626] text-[#DC2626] text-[10px] rounded-none mono">
                                {hazard.toUpperCase()}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'ai' && (
                    <div className="animate-fade-in space-y-4">
                      <div className="bg-[#080C14] p-4 border border-[#1E3A5F]">
                        <p className="data-label mb-2">AI URGENCY ASSESSMENT</p>
                        <p className="font-bold text-lg mb-1">PRIORITY: <span className="uppercase">{selectedReport.urgency}</span></p>
                        <p className="text-[#9CA3AF] text-sm">{selectedReport.urgency_reason}</p>
                      </div>
                      <div className="bg-[#080C14] p-4 border border-[#1E3A5F]">
                        <p className="data-label mb-2">AI EXTRACTED FIELDS</p>
                        <div className="space-y-2">
                          {Object.entries({
                            'INCIDENT TYPE': selectedReport.incident_type,
                            'CONDITION': selectedReport.condition,
                            'LOCATION': selectedReport.location_description,
                            'PEOPLE AFFECTED': selectedReport.people_affected,
                            'HAZARDS': selectedReport.hazards.join(', ') || 'None',
                          }).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-sm py-1 border-b border-[#1E3A5F]/50">
                              <span className="data-label">{key}</span>
                              <span className="font-medium capitalize mono">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'firstaid' && (
                    <div className="animate-fade-in">
                      <div className="bg-[#10B981]/5 p-4 border border-[#10B981]/30">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 bg-[#10B981]/20 flex items-center justify-center border border-[#10B981]/30">
                            <span className="text-lg">🏥</span>
                          </div>
                          <div>
                            <p className="font-bold text-[#10B981] text-sm">FIRST-AID PROTOCOL</p>
                            <p className="text-[#6B7280] text-[10px] mono">VALIDATED EMERGENCY GUIDELINES</p>
                          </div>
                        </div>
                        <div className="bg-[#080C14] p-4 border border-[#10B981]/20">
                          <p className="leading-relaxed text-sm">{selectedReport.first_aid}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Bar */}
                <div className="px-4 py-3 border-t border-[#1E3A5F] bg-[#080C14] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1 md:gap-2">
                    <span className="data-label mr-2">OVERRIDE:</span>
                    {(['critical', 'high', 'medium', 'low'] as const).map((u) => (
                      <button
                        key={u}
                        onClick={() => handleOverrideUrgency(selectedReport.id, u)}
                        className={`px-1.5 md:px-2 py-1 rounded-none text-[9px] md:text-[10px] font-bold mono cursor-pointer transition-colors ${
                          selectedReport.urgency === u
                            ? `${getUrgencyBg(u)} text-white`
                            : 'bg-[#1C2738] text-[#6B7280] hover:bg-[#243347] border border-[#1E3A5F]'
                        }`}
                      >
                        {u.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedReport.status !== 'dispatched' && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(selectedReport.id, 'dispatched')}
                        className="bg-[#3B82F6] hover:bg-[#2563EB] text-white cursor-pointer text-[10px] h-7 rounded-none mono"
                      >
                        <Radio className="w-3 h-3 mr-1" />
                        DISPATCH
                      </Button>
                    )}
                    {selectedReport.status !== 'resolved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(selectedReport.id, 'resolved')}
                        className="border-[#10B981] text-[#10B981] hover:bg-[#10B981]/10 cursor-pointer text-[10px] h-7 rounded-none mono"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        RESOLVE
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-[#0F1520] border border-[#1E3A5F] flex items-center justify-center">
                <div className="text-center text-[#6B7280]">
                  <MapPin className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-sm mono">SELECT AN INCIDENT</p>
                  <p className="text-xs mt-1">Click a sidebar item or map marker</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
