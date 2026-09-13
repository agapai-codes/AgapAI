'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface UrgencyBadgeProps {
  urgency: 'high' | 'medium' | 'low';
  reason?: string;
  size?: 'sm' | 'md' | 'lg';
}

const urgencyConfig = {
  high: {
    className: 'bg-[#DC2626] text-white border-[#DC2626]',
    label: 'HIGH',
    icon: '●'
  },
  medium: {
    className: 'bg-[#F59E0B] text-[#080C14] border-[#F59E0B]',
    label: 'MEDIUM',
    icon: '●'
  },
  low: {
    className: 'bg-[#10B981] text-white border-[#10B981]',
    label: 'LOW',
    icon: '●'
  },
};

export default function UrgencyBadge({ urgency, reason, size = 'md' }: UrgencyBadgeProps) {
  const config = urgencyConfig[urgency];
  const sizeClasses = size === 'sm' ? 'text-[9px] px-1.5 py-0' :
                      size === 'lg' ? 'text-xs px-3 py-1' :
                      'text-[10px] px-2 py-0.5';

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "font-bold rounded-none gap-1 mono tracking-wider",
        config.className,
        sizeClasses
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </Badge>
  );

  if (reason) {
    return (
      <Tooltip>
        <TooltipTrigger>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{reason}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}
