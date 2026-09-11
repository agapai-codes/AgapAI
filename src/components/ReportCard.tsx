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
      "bg-[#111827] backdrop-blur-sm rounded-lg border transition-all duration-200",
      isSelected
        ? "border-[#3B82F6] shadow-[0_0_20px_rgba(59,130,246,0.15)]"
        : "border-[#374151] hover:border-[#3B82F6]/50"
    )}>
      <div className="p-4 pb-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#1F2937] flex items-center justify-center">
              <span className="text-xl">{incidentIcons[report.incident_type] || '📋'}</span>
            </div>
            <div>
              <h3 className="text-[#F9FAFB] font-bold text-sm capitalize">
                {report.incident_type.replace('_', ' ')}
              </h3>
              <p className="text-[#9CA3AF] text-xs">{report.location_description}</p>
            </div>
          </div>
          <Badge className={cn(
            "text-[10px] font-bold",
            report.urgency === 'critical' ? 'bg-[#EF4444] text-white' :
            report.urgency === 'high' ? 'bg-[#F97316] text-white' :
            report.urgency === 'medium' ? 'bg-[#EAB308] text-[#0A0E17]' :
            'bg-[#22C55E] text-white'
          )}>
            {report.urgency.toUpperCase()}
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-[#1F2937] rounded-lg p-2 border border-[#374151]">
            <p className="text-[#6B7280] text-[10px] uppercase tracking-wide">Condition</p>
            <p className="text-[#F9FAFB] font-medium text-xs capitalize mt-0.5">{report.condition}</p>
          </div>
          <div className="bg-[#1F2937] rounded-lg p-2 border border-[#374151]">
            <p className="text-[#6B7280] text-[10px] uppercase tracking-wide">People</p>
            <p className="text-[#F9FAFB] font-medium text-xs mt-0.5">{report.people_affected}</p>
          </div>
          <div className="bg-[#1F2937] rounded-lg p-2 border border-[#374151]">
            <p className="text-[#6B7280] text-[10px] uppercase tracking-wide">Status</p>
            <p className={cn(
              "font-medium text-xs mt-0.5 capitalize",
              report.status === 'pending' ? 'text-[#EAB308]' :
              report.status === 'dispatched' ? 'text-[#3B82F6]' :
              'text-[#22C55E]'
            )}>{report.status}</p>
          </div>
          <div className="bg-[#1F2937] rounded-lg p-2 border border-[#374151]">
            <p className="text-[#6B7280] text-[10px] uppercase tracking-wide">Time</p>
            <p className="text-[#F9FAFB] font-medium text-xs mt-0.5">
              {new Date(report.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Hazards */}
        {report.hazards.length > 0 && (
          <div>
            <p className="text-[#6B7280] text-[10px] uppercase tracking-wide mb-1.5">Hazards</p>
            <div className="flex flex-wrap gap-1.5">
              {report.hazards.map((hazard, i) => (
                <Badge key={i} variant="outline" className="bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30 text-[10px]">
                  {hazard}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Transcript */}
        <div>
          <p className="text-[#6B7280] text-[10px] uppercase tracking-wide mb-1.5">Original Transcript</p>
          <div className="bg-[#1F2937] rounded-lg p-3 border border-[#374151]">
            <p className="text-[#F9FAFB] italic text-xs leading-relaxed">&quot;{report.transcript}&quot;</p>
          </div>
        </div>

        {/* First Aid */}
        <FirstAidPanel instruction={report.first_aid} incidentType={report.incident_type} />

        {/* Actions */}
        {onUpdateStatus && (
          <div className="flex items-center justify-between pt-3 border-t border-[#374151]">
            <p className="text-[10px] text-[#6B7280]">
              AI: <span className="text-[#9CA3AF]">{report.urgency_reason}</span>
            </p>
            <div className="flex gap-2">
              {report.status === 'pending' && (
                <Button
                  size="sm"
                  onClick={() => onUpdateStatus(report.id, 'dispatched')}
                  className="bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs cursor-pointer h-7"
                >
                  Dispatch
                </Button>
              )}
              {(report.status === 'pending' || report.status === 'dispatched') && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onUpdateStatus(report.id, 'resolved')}
                  className="text-[#22C55E] border-[#22C55E]/30 hover:bg-[#22C55E]/10 text-xs cursor-pointer h-7"
                >
                  Resolved
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
