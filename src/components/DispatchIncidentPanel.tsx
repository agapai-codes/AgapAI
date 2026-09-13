'use client';

import React from 'react';
import type { IncidentReport } from '@/types/incident';

interface DispatchIncidentPanelProps {
  incident: IncidentReport | null;
  onClose: () => void;
}

export const DispatchIncidentPanel: React.FC<DispatchIncidentPanelProps> = ({
  incident,
  onClose,
}) => {
  if (!incident) return null;

  const urgencyColor = incident.urgency === 'critical' ? '#ef4444'
    : incident.urgency === 'high' ? '#f97316'
    : incident.urgency === 'medium' ? '#eab308'
    : '#22c55e';

  return (
    <aside className="w-96 bg-neutral-950 text-white border-l border-neutral-800 h-full flex flex-col z-20 shadow-2xl overflow-y-auto shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 flex justify-between items-start">
        <div>
          <span className="text-[10px] text-neutral-400 font-mono tracking-wider">INCIDENT DETAILS</span>
          <h2 className="text-base font-bold mt-1 text-neutral-100">{incident.condition}</h2>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-white text-lg px-2 py-0.5 rounded border border-neutral-800 hover:bg-neutral-800 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Primary Attributes Grid */}
      <div className="grid grid-cols-3 gap-2 p-4 bg-neutral-900/50 border-b border-neutral-800 text-xs">
        <div>
          <span className="text-neutral-500 uppercase block text-[10px]">Type</span>
          <span className="font-semibold text-neutral-200">{incident.type}</span>
        </div>
        <div>
          <span className="text-neutral-500 uppercase block text-[10px]">Urgency</span>
          <span className="font-bold" style={{ color: urgencyColor }}>
            {incident.urgency}
          </span>
        </div>
        <div>
          <span className="text-neutral-500 uppercase block text-[10px]">People</span>
          <span className="font-semibold text-neutral-200">{incident.peopleCount}</span>
        </div>
      </div>

      {/* Location Details */}
      <div className="p-4 border-b border-neutral-800 text-xs">
        <span className="text-neutral-500 uppercase block text-[10px]">Location &amp; Coordinates</span>
        <p className="font-medium text-neutral-200 mt-1">{incident.locationName}</p>
        <p className="font-mono text-neutral-400 mt-0.5">
          {incident.coordinates[1].toFixed(5)}, {incident.coordinates[0].toFixed(5)}
        </p>
      </div>

      {/* Vitals Summary */}
      <div className="p-4 border-b border-neutral-800 text-xs">
        <span className="text-neutral-500 uppercase block text-[10px] mb-2">Vitals Assessment</span>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-neutral-900 p-2 rounded">
            <span className="block text-[10px] text-neutral-400">Conscious</span>
            <span className={`font-bold ${incident.vitals.conscious === false ? 'text-red-400' : 'text-green-400'}`}>
              {incident.vitals.conscious === null ? '—' : incident.vitals.conscious ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="bg-neutral-900 p-2 rounded">
            <span className="block text-[10px] text-neutral-400">Breathing</span>
            <span className={`font-bold ${incident.vitals.breathing === false ? 'text-red-400' : 'text-green-400'}`}>
              {incident.vitals.breathing === null ? '—' : incident.vitals.breathing ? 'YES' : 'NO'}
            </span>
          </div>
          <div className="bg-neutral-900 p-2 rounded">
            <span className="block text-[10px] text-neutral-400">Bleeding</span>
            <span className={`font-bold ${incident.vitals.bleeding ? 'text-red-400' : 'text-green-400'}`}>
              {incident.vitals.bleeding === null ? '—' : incident.vitals.bleeding ? 'YES' : 'NO'}
            </span>
          </div>
        </div>
      </div>

      {/* AI Triage Rationale */}
      <div className="p-4 border-b border-neutral-800 text-xs">
        <span className="text-neutral-500 uppercase block text-[10px] mb-1">AI Triage Rationale</span>
        <p className="italic text-neutral-300 bg-neutral-900/60 p-2.5 rounded border border-neutral-800">
          &ldquo;{incident.triageRationale}&rdquo;
        </p>
      </div>

      {/* First-Aid Protocol */}
      {incident.firstAidGuidelines && (
        <div className="p-4 text-xs">
          <h4 className="text-emerald-400 font-bold uppercase text-[11px] mb-2">
            {incident.firstAidGuidelines.title}
          </h4>
          <p className="text-[10px] text-neutral-500 font-mono mb-2">{incident.firstAidGuidelines.source}</p>
          <ol className="list-decimal list-inside space-y-1 text-neutral-300">
            {incident.firstAidGuidelines.steps.map((step, idx) => (
              <li key={idx} className="leading-relaxed">{step}</li>
            ))}
          </ol>
          {incident.firstAidGuidelines.warnings.length > 0 && (
            <div className="mt-3 bg-red-950/30 border border-red-900/30 rounded p-2">
              <p className="text-[10px] font-bold text-red-400 mb-1">WARNINGS</p>
              {incident.firstAidGuidelines.warnings.map((w, idx) => (
                <p key={idx} className="text-[10px] text-neutral-400">• {w}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timestamp */}
      <div className="p-4 border-t border-neutral-800 text-[10px] text-neutral-500 mt-auto">
        Reported: {new Date(incident.timestamp).toLocaleString()}
      </div>
    </aside>
  );
};

export default DispatchIncidentPanel;
