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

/**
 * Status tone only — four accents, no per-status hue. Escalation reads red,
 * waiting reads amber, work in progress reads sky, done reads emerald.
 */
const STATUS_TONE: Record<string, string> = {
  PENDING: 'var(--warning)',
  REVIEWING: 'var(--info)',
  PRIORITIZED: 'var(--critical)',
  DISPATCHED: 'var(--info)',
  EN_ROUTE: 'var(--info)',
  ARRIVED: 'var(--success)',
  RESOLVED: 'var(--success)',
};

const toneFor = (status: string): string => STATUS_TONE[status] || 'var(--text-3)';

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
    <section className="well overflow-hidden" aria-label="Activity timeline">
      {/* Header — toggle and refresh are siblings, never nested buttons */}
      <div className="flex items-center justify-between border-b border-[var(--line-faint)] pl-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="flex flex-1 items-center gap-2 py-2.5 text-left transition-colors hover:text-ink-1"
        >
          <Clock size={13} className="text-ink-3" aria-hidden />
          <span className="data-label">Activity Timeline</span>
          {history.length > 0 && (
            <span className="mono rounded border border-[var(--line)] bg-white/5 px-1.5 py-px text-[11px] text-ink-3">
              {history.length}
            </span>
          )}
          <span className="ml-auto pr-2 text-ink-3">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); fetchHistory(); }}
          className="btn btn-icon btn-ghost mr-1"
          title="Refresh timeline"
          aria-label="Refresh timeline"
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {expanded && (
        <div className="px-3 py-3">
          {loading && history.length === 0 ? (
            <div className="flex items-center justify-center py-6" role="status" aria-label="Loading timeline">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-ink-1" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-ink-3">No activity recorded yet</p>
          ) : (
            <div className="relative">
              {/* Vertical rail */}
              <div className="absolute bottom-2 left-[6px] top-2 w-px bg-[var(--line)]" aria-hidden />

              <ol className="space-y-3.5">
                {history.map((entry, idx) => {
                  const tone = toneFor(entry.new_status);
                  const isLatest = idx === 0;
                  return (
                    <li key={entry.id} className="relative flex gap-3">
                      {/* Node */}
                      <span
                        aria-hidden
                        className="relative z-10 mt-1.5 h-3 w-3 flex-none rounded-full border-2"
                        style={{
                          borderColor: tone,
                          background: isLatest ? tone : 'var(--surface-inset)',
                        }}
                      />

                      <div className="min-w-0 flex-1 pb-0.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {entry.old_status && (
                            <span className="mono text-[11px] uppercase tracking-wide text-ink-3">
                              {entry.old_status}
                            </span>
                          )}
                          {entry.old_status && (
                            <span className="text-[11px] text-ink-3" aria-hidden>→</span>
                          )}
                          <span
                            className="mono text-[11px] font-bold uppercase tracking-wide"
                            style={{ color: tone }}
                          >
                            {entry.new_status}
                          </span>
                        </div>

                        {entry.changed_by && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <User size={11} className="text-ink-3" aria-hidden />
                            <span className="truncate text-[12px] text-ink-3">{entry.changed_by}</span>
                          </div>
                        )}

                        {entry.notes && (
                          <div className="mt-1 flex items-start gap-1.5">
                            <FileText size={11} className="mt-1 shrink-0 text-ink-3" aria-hidden />
                            <p className="text-[13px] leading-relaxed text-ink-2">{entry.notes}</p>
                          </div>
                        )}

                        <time className="mono mt-1 block text-[11px] text-ink-3">
                          {timeAgo(entry.created_at)}
                        </time>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default IncidentTimeline;
