'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SOSButtonProps {
  onClick: () => void;
  isActive?: boolean;
}

export default function SOSButton({ onClick, isActive }: SOSButtonProps) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className={cn(
        "relative w-48 h-48 rounded-full text-3xl font-bold tracking-widest",
        "transition-all duration-300 cursor-pointer",
        isActive
          ? "bg-[#EF4444] text-white critical-pulse shadow-[0_0_60px_rgba(239,68,68,0.8)]"
          : "bg-[#EF4444] text-white sos-pulse hover:bg-[#DC2626] shadow-[0_0_30px_rgba(239,68,68,0.5)] hover:shadow-[0_0_50px_rgba(239,68,68,0.8)]"
      )}
    >
      <div className="absolute inset-0 rounded-full border-4 border-[#EF4444]/40 animate-ping" />
      <span className="relative z-10">{isActive ? 'STOP' : 'SOS'}</span>
    </Button>
  );
}
