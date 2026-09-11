'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmergencyReport } from '@/lib/types';
import FirstAidPanel from './FirstAidPanel';
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

export default function ReportCard({ report, isSelected, onUpdateStatus }: ReportCardProps) {
  return (
    <div className={cn(
      "bg-[#0F1520] border transition-all duration-150",
      isSelected
        ? "border-[#3B82F6] shadow-[0_0_15px_rgba(59,130,246,0.15)]"
        : "border-[#1E3A5F] hover:border-[#3B82F6]/50"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-[#1E3A5F] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1C2738] flex items-center justify-center border border-[#1E3A5F]">
            <span className="text-xl">{incidentIcons[report.incident_type] || '📋'}</span>
          </div>
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wide">{report.incident_type.replace('_', ' ')}</h3>
            <p className="text-[#6B7280] text-xs mono">{report.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn(
            "text-[10px] font-bold rounded-none mono",
            report.urgency === 'critical' ? 'bg-[#DC2626] text-white' :
            report.urgency === 'high' ? 'bg-[#F59E0B] text-[#080C14]' :
            report.urgency === 'medium' ? 'bg-[#3B82F6] text-white' :
            'bg-[#10B981] text-white'
          )}>
            {report.urgency.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Data Grid */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#080C14] p-2 border border-[#1E3A5F]">
          <p className="data-label mb-1">CONDITION</p>
          <p className="text-[#F9FAFB] font-medium text-xs capitalize">{report.condition}</p>
        </div>
        <div className="bg-[#080C14] p-2 border border-[#1E3A5F]">
          <p className="data-label mb-1">PEOPLE</p>
          <p className="text-[#F9FAFB] font-medium text-xs mono">{report.people_affected}</p>
        </div>
        <div className="bg-[#080C14] p-2 border border-[#1E3A5F]">
          <p className="data-label mb-1">STATUS</p>
          <p className={cn(
            "font-medium text-xs uppercase mono",
            report.status === 'pending' ? 'text-[#F59E0B]' :
            report.status === 'dispatched' ? 'text-[#3B82F6]' :
            'text-[#10B981]'
          )}>{report.status}</p>
        </div>
        <div className="bg-[#080C14] p-2 border border-[#1E3A5F]">
          <p className="data-label mb-1">TIME</p>
          <p className="text-[#F9FAFB] font-medium text-xs mono">{new Date(report.timestamp).toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Hazards */}
      {report.hazards.length > 0 && (
        <div className="px-4 pb-4">
          <p className="data-label mb-2">HAZARDS</p>
          <div className="flex flex-wrap gap-1.5">
            {report.hazards.map((hazard, i) => (
              <Badge key={i} variant="outline" className="bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30 text-[10px] rounded-none mono">
                {hazard.toUpperCase()}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {onUpdateStatus && (
        <div className="p-4 border-t border-[#1E3A5F] flex items-center justify-between">
          <p className="data-label truncate max-w-[200px]">AI: {report.urgency_reason}</p>
          <div className="flex gap-2">
            {report.status !== 'dispatched' && (
              <Button
                size="sm"
                onClick={() => onUpdateStatus(report.id, 'dispatched')}
                className="bg-[#3B82F6] hover:bg-[#2563EB] text-white cursor-pointer text-xs h-7 rounded-none"
              >
                DISPATCH
              </Button>
            )}
            {report.status !== 'resolved' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onUpdateStatus(report.id, 'resolved')}
                className="text-[#10B981] border-[#10B981]/30 hover:bg-[#10B981]/10 cursor-pointer text-xs h-7 rounded-none"
              >
                RESOLVE
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
