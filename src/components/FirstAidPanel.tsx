'use client';

import { Card, CardContent } from '@/components/ui/card';

interface FirstAidPanelProps {
  instruction: string;
  incidentType?: string;
}

export default function FirstAidPanel({ instruction, incidentType }: FirstAidPanelProps) {
  return (
    <Card className="bg-[#10B981]/5 border-[#10B981]/30 rounded-none">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-[#10B981]/20 flex items-center justify-center border border-[#10B981]/30">
            <span className="text-lg">🏥</span>
          </div>
          <div>
            <p className="text-[#10B981] font-bold text-sm">FIRST-AID PROTOCOL</p>
            <p className="text-[#6B7280] text-xs mono">VALIDATED EMERGENCY GUIDELINES</p>
          </div>
        </div>
        <div className="bg-[#080C14] p-4 border border-[#10B981]/20">
          <p className="text-[#F9FAFB] text-sm leading-relaxed">{instruction}</p>
        </div>
      </CardContent>
    </Card>
  );
}
