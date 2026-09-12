'use client';

import React from 'react';
import { X, AlertTriangle, Zap, MapPin, Users, Clock, Shield, ChevronRight, Sparkles } from 'lucide-react';
import type { Incident, UrgencyLevel, IncidentStatus } from '../types/incident';

const URGENCY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
  high: { color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' },
  medium: { color: '#eab308', bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)' },
  low: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)' },
};

const TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  FIRE: { color: '#ef4444', label: 'FIRE' },
  ACCIDENT: { color: '#f97316', label: 'ACCIDENT' },
  MEDICAL: { color: '#3b82f6', label: 'MEDICAL' },
  DISASTER: { color: '#a855f7', label: 'DISASTER' },
  VIOLENCE: { color: '#f43f5e', label: 'VIOLENCE' },
  HAZARDOUS: { color: '#facc15', label: 'HAZARDOUS' },
  MISSING_PERSON: { color: '#06b6d4', label: 'MISSING PERSON' },
};

const STATUS_STYLE: Record<IncidentStatus, { color: string; border: string; bg: string }> = {
  PENDING: { color: '#fbbf24', border: 'rgba(245,158,11,0.2)', bg: 'rgba(245,158,11,0.05)' },
  REVIEWING: { color: '#a78bfa', border: 'rgba(167,139,250,0.2)', bg: 'rgba(167,139,250,0.05)' },
  PRIORITIZED: { color: '#f472b6', border: 'rgba(244,114,182,0.2)', bg: 'rgba(244,114,182,0.05)' },
  DISPATCHED: { color: '#60a5fa', border: 'rgba(96,165,250,0.2)', bg: 'rgba(96,165,250,0.05)' },
  EN_ROUTE: { color: '#38bdf8', border: 'rgba(56,189,248,0.2)', bg: 'rgba(56,189,248,0.05)' },
  ARRIVED: { color: '#818cf8', border: 'rgba(129,140,248,0.2)', bg: 'rgba(129,140,248,0.05)' },
  RESOLVED: { color: '#4ade80', border: 'rgba(34,197,94,0.2)', bg: 'rgba(34,197,94,0.05)' },
};

interface IncidentDetailsSidebarProps {
  incident: Incident;
  onClose: () => void;
  onStatusUpdate: (id: string, status: IncidentStatus) => void;
  onUrgencyOverride: (id: string, urgency: UrgencyLevel) => void;
  onAssign: (id: string) => void;
  onResolve: () => void;
}

function generateSerialId(id: string): string {
  const short = id.replace(/-/g, '').slice(0, 8).toUpperCase();
  const year = new Date().getFullYear();
  return `INC-${year}-${short.slice(0, 4)}`;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  const day = d.getDate().toString().padStart(2, '0');
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${day}/${h}:${m}`;
}

function confidencePercent(c: number): string {
  return (c * 100).toFixed(1) + '%';
}

function extractOperationalFactors(incident: Incident): string[] {
  const factors: string[] = [];
  if (incident.description) {
    const desc = incident.description.toLowerCase();
    if (desc.includes('spread') || desc.includes('adjacent') || desc.includes('neighboring')) {
      factors.push('Rapid fire spread to neighboring structure');
    }
    if (desc.includes('residential') || desc.includes('dense') || desc.includes('building')) {
      factors.push('Dense residential building density');
    }
  }
  if (incident.hazards && incident.hazards.length > 0) {
    factors.push(`Active hazards: ${incident.hazards.join(', ')}`);
  }
  if (incident.people_affected && incident.people_affected > 1) {
    factors.push(`${incident.people_affected} people potentially affected`);
  }
  if (incident.consciousness === false) {
    factors.push('Victim unconscious — critical intervention required');
  }
  if (incident.breathing === false) {
    factors.push('Respiratory failure detected — immediate response needed');
  }
  if (incident.bleeding) {
    factors.push('Active bleeding reported — hemorrhage control priority');
  }
  if (factors.length === 0) {
    factors.push('Standard response protocol applicable');
  }
  return factors;
}

function getConditionLabel(incident: Incident): string {
  if (incident.condition) return incident.condition;
  const desc = (incident.description || '').toLowerCase();
  if (desc.includes('fire') || desc.includes('blaze')) return 'Active Blaze';
  if (desc.includes('collision') || desc.includes('crash')) return 'Vehicle Collision';
  if (desc.includes('flood')) return 'Flooding';
  if (desc.includes('medical') || desc.includes('distress')) return 'Medical Emergency';
  return 'Under Assessment';
}

function getVisibleInjury(incident: Incident): { text: string; isCritical: boolean } {
  if (incident.bleeding) return { text: 'Active Hemorrhage', isCritical: true };
  if (incident.consciousness === false) return { text: 'Unconscious Victim', isCritical: true };
  if (incident.breathing === false) return { text: 'Respiratory Failure', isCritical: true };
  if (incident.condition) return { text: incident.condition, isCritical: false };
  const desc = (incident.description || '').toLowerCase();
  if (desc.includes('injury') || desc.includes('injured') || desc.includes('wound')) {
    return { text: 'Traumatic Injury', isCritical: true };
  }
  if (desc.includes('smoke') || desc.includes('inhalation')) {
    return { text: 'Smoke Inhalation Risk', isCritical: false };
  }
  return { text: 'Assessment Pending', isCritical: false };
}

function getSiteHazards(incident: Incident): { text: string; isAlert: boolean } {
  if (incident.hazards && incident.hazards.length > 0) {
    return { text: incident.hazards.join(', '), isAlert: true };
  }
  const desc = (incident.description || '').toLowerCase();
  if (desc.includes('electrical') || desc.includes('transformer') || desc.includes('cable')) {
    return { text: 'Exposed Electrical Cables', isAlert: true };
  }
  if (desc.includes('gas') || desc.includes('leak')) {
    return { text: 'Gas Leak Risk', isAlert: true };
  }
  if (desc.includes('structural') || desc.includes('collapse')) {
    return { text: 'Structural Instability', isAlert: true };
  }
  return { text: 'None identified', isAlert: false };
}

export default function IncidentDetailsSidebar({
  incident,
  onClose,
  onStatusUpdate,
  onUrgencyOverride,
  onAssign,
  onResolve,
}: IncidentDetailsSidebarProps) {
  const urgency = URGENCY_STYLE[incident.urgency || 'medium'];
  const typeConfig = TYPE_CONFIG[incident.type] || { color: '#71717a', label: incident.type };
  const status = STATUS_STYLE[incident.status];
  const serialId = generateSerialId(incident.id);
  const confidence = incident.confidence ?? 0.7;
  const condition = getConditionLabel(incident);
  const visibleInjury = getVisibleInjury(incident);
  const siteHazards = getSiteHazards(incident);
  const operationalFactors = extractOperationalFactors(incident);

  return (
    <div className="flex flex-col h-full w-full">

      {/* ── SECTION 1: Context Badges ── */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-black tracking-widest text-zinc-400 font-mono">
          {serialId}
        </span>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-md border"
            style={{
              color: typeConfig.color,
              backgroundColor: `${typeConfig.color}15`,
              borderColor: `${typeConfig.color}30`,
            }}
          >
            {typeConfig.label}
          </span>
          <span
            className="text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-md border"
            style={{
              color: status.color,
              backgroundColor: status.bg,
              borderColor: status.border,
            }}
          >
            {incident.status}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── SECTION 2: Incident Overview & Field Structure ── */}
      <div className="mb-4 border-b border-zinc-900 pb-4">
        <h2 className="text-xl font-black tracking-tight text-zinc-100 mb-2">
          {incident.description || 'Incident Report'}
        </h2>
        <p className="text-xs text-zinc-400 leading-relaxed mb-4">
          {incident.description}
        </p>
      </div>

      {/* ── Two-Column Metadata Matrix ── */}
      <div className="grid grid-cols-2 gap-y-4 gap-x-6 border-b border-zinc-900 pb-5 mb-5">
        {/* CONDITION */}
        <div>
          <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-1">
            CONDITION
          </p>
          <p className="text-sm font-semibold text-zinc-200">{condition}</p>
        </div>

        {/* VISIBLE INJURY */}
        <div>
          <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-1">
            VISIBLE INJURY
          </p>
          <p className={`text-sm font-semibold ${visibleInjury.isCritical ? 'text-red-400' : 'text-zinc-200'}`}>
            {visibleInjury.text}
          </p>
        </div>

        {/* LOCATION */}
        <div>
          <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-1">
            LOCATION
          </p>
          <p className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
            <MapPin size={12} className="text-zinc-500 flex-shrink-0" />
            {incident.location}
          </p>
        </div>

        {/* PEOPLE AFFECTED */}
        <div>
          <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-1">
            PEOPLE AFFECTED
          </p>
          <p className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
            <Users size={12} className="text-zinc-500" />
            {incident.people_affected || 1} {incident.people_affected === 1 ? 'person' : 'people'}
          </p>
        </div>

        {/* SITE HAZARDS */}
        <div className="col-span-2">
          <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-1">
            SITE HAZARDS
          </p>
          <p className={`text-sm font-semibold ${siteHazards.isAlert ? 'text-orange-400' : 'text-zinc-400'}`}>
            {siteHazards.text}
          </p>
        </div>

        {/* REPORT TIME */}
        <div className="col-span-2">
          <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-1">
            REPORT TIME
          </p>
          <p className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
            <Clock size={12} className="text-zinc-500" />
            {formatTime(incident.timestamp)} ({timeAgo(incident.timestamp)})
          </p>
        </div>
      </div>

      {/* ── SECTION 3: Explainable AI Recommendation ── */}
      <div className="bg-zinc-900/60 border border-zinc-900 rounded-xl p-4 mt-2 space-y-4 shadow-inner">
        {/* Section Header */}
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-zinc-500" />
          <span className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">
            AI RECOMMENDATION
          </span>
        </div>

        {/* Confidence Meter */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">
            CONFIDENCE
          </span>
          <span className="text-emerald-400 font-mono text-xs">
            {confidencePercent(confidence)}
          </span>
        </div>

        {/* Suggested Urgency */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">
            SUGGESTED URGENCY
          </span>
          <span
            className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{
              color: urgency.color,
              backgroundColor: urgency.bg,
            }}
          >
            {(incident.urgency || 'medium').toUpperCase()}
          </span>
        </div>

        {/* Urgency Reason */}
        {incident.urgency_reason && (
          <div className="pt-2 border-t border-zinc-800">
            <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-1.5">
              REASONING
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed italic">
              &ldquo;{incident.urgency_reason}&rdquo;
            </p>
          </div>
        )}

        {/* Operational Factors Extractor */}
        <div className="pt-2 border-t border-zinc-800">
          <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-2">
            OPERATIONAL FACTORS
          </p>
          <ul className="space-y-1.5">
            {operationalFactors.map((factor, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                <ChevronRight size={12} className="text-zinc-600 mt-0.5 flex-shrink-0" />
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── SECTION 4: Action Trigger Footer ── */}
      <div className="grid grid-cols-2 gap-3 mt-auto pt-6 border-t border-zinc-900">
        {/* Dispatch Action */}
        <button
          onClick={() => {
            if (incident.status === 'PENDING' || incident.status === 'REVIEWING' || incident.status === 'PRIORITIZED') {
              onStatusUpdate(incident.id, 'DISPATCHED');
            }
          }}
          disabled={incident.status !== 'PENDING' && incident.status !== 'REVIEWING' && incident.status !== 'PRIORITIZED'}
          className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider py-2.5 rounded-lg border-none flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <AlertTriangle size={14} />
          DISPATCH UNIT
        </button>

        {/* Priority Overlay */}
        <button
          onClick={() => {
            const priorities: UrgencyLevel[] = ['critical', 'high', 'medium', 'low'];
            const currentIdx = priorities.indexOf(incident.urgency || 'medium');
            const nextPriority = priorities[(currentIdx + 1) % priorities.length];
            onUrgencyOverride(incident.id, nextPriority);
          }}
          className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-bold uppercase tracking-wider py-2.5 rounded-lg flex items-center justify-center transition-colors"
        >
          <Zap size={14} />
          CONFIRM PRIORITY
        </button>
      </div>
    </div>
  );
}
