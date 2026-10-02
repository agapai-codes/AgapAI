'use client';

import { Card, CardContent } from '@/components/ui/card';

interface FirstAidPanelProps {
  instruction: string;
  incidentType?: string;
}

export default function FirstAidPanel({ instruction, incidentType }: FirstAidPanelProps) {
  return (
    <Card className="panel overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[rgba(16,185,129,0.28)] bg-[rgba(16,185,129,0.08)] px-4 py-3">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.16)] text-lg" aria-hidden>
            🏥
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold uppercase tracking-wide text-[var(--success)]">
              First-Aid Protocol
            </p>
            <p className="data-label data-label-tight truncate">
              {incidentType ? `${incidentType} · ` : ''}Validated emergency guidelines
            </p>
          </div>
        </div>

        {/* Instruction */}
        <div className="p-4">
          <div className="well p-3.5">
            <p className="text-[14px] leading-relaxed text-ink-1">{instruction}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
