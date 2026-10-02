'use client';

import { Button } from '@/components/ui/button';
import { EmergencyReport } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ReportCardProps {
  report: EmergencyReport;
  isSelected?: boolean;
  onUpdateStatus?: (id: string, status: EmergencyReport['status']) => void;
}

const incidentIcons: Record<string, string> = {
  medical: '🏥',
  accident: '🚗',
  fire: '🔥',
  violence: '⚠️',
  hazardous: '☢️',
  missing_person: '🔍',
  disaster: '🌪️',
  other: '📋',
};

/** Same rule as every other surface: red act, amber wait, emerald done. */
const URGENCY_CHIP: Record<string, string> = {
  high: 'chip-critical',
  medium: 'chip-warning',
  low: 'chip-success',
};

const STATUS_INK: Record<string, string> = {
  pending: 'var(--warning)',
  dispatched: 'var(--info)',
  resolved: 'var(--success)',
};

export default function ReportCard({ report, isSelected, onUpdateStatus }: ReportCardProps) {
  return (
    <article
      className={cn(
        'panel transition-colors duration-150',
        isSelected
          ? 'border-[var(--info)] shadow-[0_0_0_1px_rgba(56,189,248,0.35)]'
          : 'hover:border-[var(--line-strong)]'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="well flex h-10 w-10 flex-none items-center justify-center">
            <span className="text-xl" aria-hidden>{incidentIcons[report.incident_type] || '📋'}</span>
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-bold uppercase tracking-wide">
              {report.incident_type.replace('_', ' ')}
            </h3>
            <p className="mono truncate text-[11px] text-ink-3">{report.id}</p>
          </div>
        </div>
        <span className={cn('chip', URGENCY_CHIP[report.urgency] || 'chip-neutral')}>
          {report.urgency.toUpperCase()}
        </span>
      </div>

      {/* Data Grid */}
      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
        <div className="well p-2.5">
          <p className="data-label mb-1">Condition</p>
          <p className="text-[13px] font-medium capitalize text-ink-1">{report.condition}</p>
        </div>
        <div className="well p-2.5">
          <p className="data-label mb-1">People</p>
          <p className="mono text-[13px] font-medium text-ink-1">{report.people_affected}</p>
        </div>
        <div className="well p-2.5">
          <p className="data-label mb-1">Status</p>
          <p
            className="mono text-[13px] font-medium uppercase"
            style={{ color: STATUS_INK[report.status] || 'var(--text-2)' }}
          >
            {report.status}
          </p>
        </div>
        <div className="well p-2.5">
          <p className="data-label mb-1">Time</p>
          <p className="mono text-[13px] font-medium text-ink-1">
            {new Date(report.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Hazards */}
      {report.hazards.length > 0 && (
        <div className="px-4 pb-4">
          <p className="data-label mb-2">Hazards</p>
          <div className="flex flex-wrap gap-1.5">
            {report.hazards.map((hazard, i) => (
              <span key={i} className="chip chip-critical mono">
                {hazard.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {onUpdateStatus && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] p-4">
          <p className="data-label min-w-0 flex-1 truncate" title={report.urgency_reason}>
            AI: {report.urgency_reason}
          </p>
          <div className="flex gap-2">
            {report.status !== 'dispatched' && (
              <Button
                size="sm"
                onClick={() => onUpdateStatus(report.id, 'dispatched')}
                className="btn btn-sm btn-info"
              >
                Dispatch
              </Button>
            )}
            {report.status !== 'resolved' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUpdateStatus(report.id, 'resolved')}
                className="btn btn-sm btn-outline text-[var(--success)]"
              >
                Resolve
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
