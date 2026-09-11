'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FirstAidPanelProps {
  instruction: string;
  incidentType: string;
}

export default function FirstAidPanel({ instruction, incidentType }: FirstAidPanelProps) {
  return (
    <Card className="bg-[#22C55E]/10 border-[#22C55E]/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
            <span className="text-lg">🏥</span>
          </div>
          <div>
            <p className="font-bold text-[#22C55E] text-sm">First-Aid Protocol</p>
            <p className="text-[#6B7280] text-[10px]">Based on validated emergency protocols</p>
          </div>
        </div>
        <div className="bg-[#0A0E17] rounded-lg p-3 border border-[#22C55E]/20">
          <p className="text-sm leading-relaxed">{instruction}</p>
        </div>
      </CardContent>
    </Card>
  );
}
