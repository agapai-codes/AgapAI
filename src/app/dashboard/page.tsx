'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster, toast } from 'sonner';
import { EmergencyReport } from '@/lib/types';
import MapView from '@/components/MapView';
import { Search, Activity, AlertTriangle, Clock, CheckCircle2, ArrowLeft, Radio, Users, MapPin, Shield, Menu, X } from 'lucide-react';

const demoReports: EmergencyReport[] = [
  {
    id: 'demo-1',
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
    id: 'demo-2',
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
    id: 'demo-3',
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
    id: 'demo-4',
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
    id: 'demo-5',
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
    id: 'demo-6',
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
    toast.success(`Report marked as ${status}`);
  };

  const handleOverrideUrgency = (reportId: string, newUrgency: EmergencyReport['urgency']) => {
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, urgency: newUrgency } : r));
    toast.success(`Urgency overridden to ${newUrgency}`);
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'border-l-[#EF4444]';
      case 'high': return 'border-l-[#F97316]';
      case 'medium': return 'border-l-[#EAB308]';
      case 'low': return 'border-l-[#22C55E]';
      default: return 'border-l-[#6B7280]';
    }
  };

  const getUrgencyBg = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-[#EF4444]';
      case 'high': return 'bg-[#F97316]';
      case 'medium': return 'bg-[#EAB308]';
      case 'low': return 'bg-[#22C55E]';
      default: return 'bg-[#6B7280]';
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] text-[#F9FAFB] flex flex-col">
      <Toaster position="top-right" theme="dark" />
      
      {/* Header */}
      <header className="h-14 bg-[#111827] border-b border-[#374151] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-[#9CA3AF] cursor-pointer"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <img src="/logo.jpg" alt="AgapAI" className="w-8 h-8 rounded-lg" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">Agap<span className="text-[#EF4444]">AI</span></span>
            <span className="text-[#6B7280] text-sm hidden sm:inline">Dispatch</span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#22C55E]/20 rounded-full">
            <div className="w-2 h-2 rounded-full bg-[#22C55E] live-indicator" />
            <span className="text-[#22C55E] text-xs font-medium">LIVE</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-[#6B7280] text-[10px]">TIME</p>
            <p className="text-sm font-mono">{currentTime.toLocaleTimeString()}</p>
          </div>
          <div className="h-8 w-px bg-[#374151] hidden sm:block" />
          <a href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-[#9CA3AF] hover:text-[#F9FAFB] cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Citizen App</span>
            </Button>
          </a>
        </div>
      </header>

      {/* Stats Row */}
      <div className="px-4 py-3 bg-[#111827] border-b border-[#374151] shrink-0">
        <div className="grid grid-cols-5 gap-2 md:gap-3 overflow-x-auto">
          {[
            { label: 'TOTAL', value: stats.total, icon: Activity, color: 'text-[#3B82F6]' },
            { label: 'CRIT', value: stats.critical, icon: AlertTriangle, color: 'text-[#EF4444]' },
            { label: 'PEND', value: stats.pending, icon: Clock, color: 'text-[#EAB308]' },
            { label: 'DISP', value: stats.dispatched, icon: Radio, color: 'text-[#3B82F6]' },
            { label: 'DONE', value: stats.resolved, icon: CheckCircle2, color: 'text-[#22C55E]' },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-2 px-2 md:px-3 py-2 bg-[#1F2937] rounded-lg border border-[#374151] min-w-0">
              <stat.icon className={`w-4 h-4 ${stat.color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-[9px] text-[#6B7280] font-medium tracking-wider truncate">{stat.label}</p>
                <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar - Incident List */}
        <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-[380px] bg-[#111827] border-r border-[#374151] flex-col absolute md:relative z-10 h-[calc(100vh-116px)]`}>
          {/* Search */}
          <div className="p-3 border-b border-[#374151]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
              <Input
                placeholder="Search incidents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#1F2937] border-[#374151] text-[#F9FAFB] placeholder-[#6B7280] focus:border-[#3B82F6]"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="p-3 border-b border-[#374151]">
            <div className="flex gap-1.5 flex-wrap">
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 md:px-3 py-1 rounded text-[10px] md:text-xs font-medium capitalize transition-all cursor-pointer ${
                    filter === f
                      ? f === 'critical' ? 'bg-[#EF4444] text-white' :
                        f === 'high' ? 'bg-[#F97316] text-white' :
                        f === 'medium' ? 'bg-[#EAB308] text-[#0A0E17]' :
                        f === 'low' ? 'bg-[#22C55E] text-white' :
                        'bg-[#3B82F6] text-white'
                      : 'bg-[#1F2937] text-[#9CA3AF] hover:bg-[#253044]'
                  }`}
                >
                  {f === 'all' ? 'All' : f} ({urgencyCounts[f]})
                </button>
              ))}
            </div>
          </div>

          {/* Incident List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {filteredReports.length === 0 ? (
                <div className="text-center text-[#6B7280] py-12">
                  <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No incidents found</p>
                </div>
              ) : (
                filteredReports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => {
                      setSelectedReportId(report.id);
                      setActiveTab('transcript');
                      if (window.innerWidth < 768) setShowSidebar(false);
                    }}
                    className={`
                      p-3 rounded-lg cursor-pointer transition-all border-l-4 card-hover
                      ${getUrgencyColor(report.urgency)}
                      ${selectedReportId === report.id
                        ? 'bg-[#253044] border-[#3B82F6]'
                        : 'bg-[#1F2937] hover:bg-[#253044]'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {report.incident_type === 'medical' ? '🏥' :
                           report.incident_type === 'fire' ? '🔥' :
                           report.incident_type === 'accident' ? '🚗' :
                           report.incident_type === 'disaster' ? '🌪️' : '📋'}
                        </span>
                        <div>
                          <p className="font-medium text-sm capitalize">{report.incident_type.replace('_', ' ')}</p>
                          <p className="text-[#9CA3AF] text-xs flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{report.location_description}</span>
                          </p>
                        </div>
                      </div>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${getUrgencyBg(report.urgency)} ${report.urgency === 'critical' ? 'marker-pulse' : ''}`} />
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3 text-[11px] text-[#6B7280]">
                        <span>{formatTimeAgo(report.timestamp)}</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {report.people_affected}
                        </span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] px-1.5 py-0 ${
                          report.status === 'pending' ? 'border-[#EAB308] text-[#EAB308]' :
                          report.status === 'dispatched' ? 'border-[#3B82F6] text-[#3B82F6]' :
                          'border-[#22C55E] text-[#22C55E]'
                        }`}
                      >
                        {report.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Side - Map + Detail */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Map */}
          <div className="h-1/2 p-3">
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
          <div className="h-1/2 p-3 pt-0 flex flex-col min-h-0">
            {selectedReport ? (
              <div className="flex-1 bg-[#111827] rounded-lg border border-[#374151] overflow-hidden flex flex-col min-h-0">
                {/* Detail Header */}
                <div className="px-4 py-3 border-b border-[#374151] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">
                      {selectedReport.incident_type === 'medical' ? '🏥' :
                       selectedReport.incident_type === 'fire' ? '🔥' :
                       selectedReport.incident_type === 'accident' ? '🚗' :
                       selectedReport.incident_type === 'disaster' ? '🌪️' : '📋'}
                    </span>
                    <div>
                      <h3 className="font-bold capitalize">{selectedReport.incident_type.replace('_', ' ')}</h3>
                      <p className="text-[#9CA3AF] text-xs flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {selectedReport.location_description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${getUrgencyBg(selectedReport.urgency)} text-white border-0`}>
                      {selectedReport.urgency.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className={`${
                      selectedReport.status === 'pending' ? 'border-[#EAB308] text-[#EAB308]' :
                      selectedReport.status === 'dispatched' ? 'border-[#3B82F6] text-[#3B82F6]' :
                      'border-[#22C55E] text-[#22C55E]'
                    }`}>
                      {selectedReport.status}
                    </Badge>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[#374151] shrink-0">
                  {[
                    { id: 'transcript' as const, label: 'Transcript' },
                    { id: 'ai' as const, label: 'AI Assessment' },
                    { id: 'firstaid' as const, label: 'First Aid' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3 md:px-4 py-2.5 text-xs md:text-sm font-medium transition-colors cursor-pointer ${
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
                    <div className="animate-fade-in">
                      <div className="bg-[#1F2937] rounded-lg p-4 border border-[#374151]">
                        <p className="text-[#9CA3AF] text-[10px] uppercase tracking-wider mb-2">Original Voice Report</p>
                        <p className="italic leading-relaxed">&quot;{selectedReport.transcript}&quot;</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="bg-[#1F2937] rounded-lg p-3 border border-[#374151]">
                          <p className="text-[#6B7280] text-[10px] uppercase">Condition</p>
                          <p className="text-sm font-medium capitalize mt-1">{selectedReport.condition}</p>
                        </div>
                        <div className="bg-[#1F2937] rounded-lg p-3 border border-[#374151]">
                          <p className="text-[#6B7280] text-[10px] uppercase">People</p>
                          <p className="text-sm font-medium mt-1">{selectedReport.people_affected}</p>
                        </div>
                        <div className="bg-[#1F2937] rounded-lg p-3 border border-[#374151]">
                          <p className="text-[#6B7280] text-[10px] uppercase">Time</p>
                          <p className="text-sm font-medium mt-1">{new Date(selectedReport.timestamp).toLocaleTimeString()}</p>
                        </div>
                      </div>
                      {selectedReport.hazards.length > 0 && (
                        <div className="mt-4">
                          <p className="text-[#6B7280] text-[10px] uppercase mb-2">Hazards</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedReport.hazards.map((hazard, i) => (
                              <Badge key={i} variant="outline" className="border-[#EF4444] text-[#EF4444] text-xs">
                                {hazard}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'ai' && (
                    <div className="animate-fade-in">
                      <div className="bg-[#1F2937] rounded-lg p-4 border border-[#374151] mb-4">
                        <p className="text-[#9CA3AF] text-[10px] uppercase tracking-wider mb-2">AI Urgency Assessment</p>
                        <p className="font-bold text-lg mb-1">Priority: <span className="capitalize">{selectedReport.urgency}</span></p>
                        <p className="text-[#9CA3AF] text-sm">{selectedReport.urgency_reason}</p>
                      </div>
                      <div className="bg-[#1F2937] rounded-lg p-4 border border-[#374151]">
                        <p className="text-[#9CA3AF] text-[10px] uppercase tracking-wider mb-2">AI Extracted Fields</p>
                        <div className="space-y-2">
                          {Object.entries({
                            'Incident Type': selectedReport.incident_type,
                            'Condition': selectedReport.condition,
                            'Location': selectedReport.location_description,
                            'People Affected': selectedReport.people_affected,
                            'Hazards': selectedReport.hazards.join(', ') || 'None',
                          }).map(([key, value]) => (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="text-[#6B7280]">{key}</span>
                              <span className="font-medium capitalize">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'firstaid' && (
                    <div className="animate-fade-in">
                      <div className="bg-[#22C55E]/10 rounded-lg p-4 border border-[#22C55E]/30">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-8 h-8 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                            <span className="text-lg">🏥</span>
                          </div>
                          <div>
                            <p className="font-bold text-[#22C55E]">First-Aid Protocol</p>
                            <p className="text-[#6B7280] text-xs">Based on validated emergency protocols</p>
                          </div>
                        </div>
                        <div className="bg-[#0A0E17] rounded-lg p-4 border border-[#22C55E]/20">
                          <p className="leading-relaxed text-sm">{selectedReport.first_aid}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Bar */}
                <div className="px-4 py-3 border-t border-[#374151] bg-[#1F2937] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1 md:gap-2">
                    <span className="text-[#6B7280] text-[10px] md:text-xs">Override:</span>
                    {(['critical', 'high', 'medium', 'low'] as const).map((u) => (
                      <button
                        key={u}
                        onClick={() => handleOverrideUrgency(selectedReport.id, u)}
                        className={`px-1.5 md:px-2 py-1 rounded text-[9px] md:text-[10px] font-medium cursor-pointer transition-colors ${
                          selectedReport.urgency === u
                            ? `${getUrgencyBg(u)} text-white`
                            : 'bg-[#374151] text-[#9CA3AF] hover:bg-[#4B5563]'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedReport.status !== 'dispatched' && (
                      <Button 
                        size="sm" 
                        onClick={() => handleUpdateStatus(selectedReport.id, 'dispatched')}
                        className="bg-[#3B82F6] hover:bg-[#2563EB] text-white cursor-pointer text-xs"
                      >
                        <Radio className="w-3 h-3 mr-1" />
                        Dispatch
                      </Button>
                    )}
                    {selectedReport.status !== 'resolved' && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleUpdateStatus(selectedReport.id, 'resolved')}
                        className="border-[#22C55E] text-[#22C55E] hover:bg-[#22C55E]/10 cursor-pointer text-xs"
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Resolved
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-[#111827] rounded-lg border border-[#374151] flex items-center justify-center">
                <div className="text-center text-[#6B7280]">
                  <MapPin className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Select an incident</p>
                  <p className="text-sm mt-1">Click a sidebar item or map marker</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
