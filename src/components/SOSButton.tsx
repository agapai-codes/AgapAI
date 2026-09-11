'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SOSButtonProps {
  onClick: () => void;
  isActive?: boolean;
}

export default function SOSButton({ onClick, isActive }: SOSButtonProps) {
  const button = (
    <Button
      onClick={onClick}
      className={cn(
        "relative w-40 h-40 md:w-48 md:h-48 text-2xl md:text-3xl font-bold tracking-widest mono",
        "transition-all duration-200 cursor-pointer rounded-none",
        isActive
          ? "bg-[#DC2626] text-white critical-pulse shadow-[0_0_40px_rgba(220,38,38,0.6)] border-2 border-[#F87171]"
          : "bg-[#DC2626] text-white sos-pulse hover:bg-[#B91C1C] shadow-[0_0_20px_rgba(220,38,38,0.4)] border-2 border-[#DC2626] hover:border-[#F87171]"
      )}
    >
      {isActive && (
        <div className="absolute inset-0 border-2 border-[#F87171]/50 animate-ping" />
      )}
      <span className="relative z-10">{isActive ? 'DEACTIVATE' : 'SOS'}</span>
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger>
        {button}
      </TooltipTrigger>
      <TooltipContent>
        <p>{isActive ? 'Click to stop recording' : 'Click to activate emergency mode'}</p>
      </TooltipContent>
    </Tooltip>
  );
}
