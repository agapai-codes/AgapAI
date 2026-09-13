'use client';

import React, { useState, useEffect } from 'react';
import { Clock, User, FileText, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useIncidents } from '../hooks/useIncidents';

interface TimelineEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

interface IncidentTimelineProps {
  incidentId: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#fbbf24',
  REVIEWING: '#a78bfa',
  PRIORITIZED: '#f472b6',
  DISPATCHED: '#60a5fa',
  EN_ROUTE: '#38bdf8',
  ARRIVED: '#818cf8',
  RESOLVED: '#22c55e',
};

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({ incidentId }) => {
  const { getHistory } = useIncidents();
  const [history, setHistory] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getHistory(incidentId);
      if (data) setHistory(data);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [incidentId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-xl border border-white/5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-neutral-500" />
          <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
            Activity Timeline
          </span>
          {history.length > 0 && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-neutral-500">
              {history.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); fetchHistory(); }}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={10} className={`text-neutral-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {expanded ? <ChevronDown size={12} className="text-neutral-500" /> : <ChevronRight size={12} className="text-neutral-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {loading && history.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-[11px] text-neutral-600 text-center py-4">No activity recorded yet</p>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-white/5" />

              <div className="space-y-3">
                {history.map((entry, idx) => (
                  <div key={entry.id} className="flex gap-3 relative">
                    {/* Dot */}
                    <div className="relative z-10 mt-1.5">
                      <div
                        className="w-[14px] h-[14px] rounded-full border-2 flex items-center justify-center"
                        style={{
                          borderColor: STATUS_COLORS[entry.new_status] || '#52525b',
                          background: idx === 0 ? `${STATUS_COLORS[entry.new_status]}20` : 'transparent',
                        }}
                      >
                        <div
                          className="w-[6px] h-[6px] rounded-full"
                          style={{ background: STATUS_COLORS[entry.new_status] || '#52525b' }}
                        />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2">
                        {entry.old_status && (
                          <span className="text-[10px] text-neutral-500">{entry.old_status}</span>
                        )}
                        {entry.old_status && (
                          <span className="text-[9px] text-neutral-600">→</span>
                        )}
                        <span
                          className="text-[10px] font-bold uppercase"
                          style={{ color: STATUS_COLORS[entry.new_status] || '#71717a' }}
                        >
                          {entry.new_status}
                        </span>
                      </div>

                      {entry.changed_by && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <User size={9} className="text-neutral-600" />
                          <span className="text-[9px] text-neutral-500">{entry.changed_by}</span>
                        </div>
                      )}

                      {entry.notes && (
                        <div className="flex items-start gap-1 mt-1">
                          <FileText size={9} className="text-neutral-600 mt-0.5 shrink-0" />
                          <p className="text-[10px] text-neutral-400 leading-relaxed">{entry.notes}</p>
                        </div>
                      )}

                      <span className="text-[8px] text-neutral-600 mt-0.5 block font-mono">
                        {timeAgo(entry.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IncidentTimeline;
