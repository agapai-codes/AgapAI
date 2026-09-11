'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface UrgencyBadgeProps {
  urgency: 'critical' | 'high' | 'medium' | 'low';
  reason?: string;
  size?: 'sm' | 'md' | 'lg';
}

const urgencyConfig = {
  critical: { 
    className: 'bg-[#EF4444] text-white border-[#EF4444]',
    label: 'CRITICAL',
    icon: '🔴'
  },
  high: { 
    className: 'bg-[#F97316] text-white border-[#F97316]',
    label: 'HIGH',
    icon: '🟠'
  },
  medium: { 
    className: 'bg-[#EAB308] text-[#0A0E17] border-[#EAB308]',
    label: 'MEDIUM',
    icon: '🟡'
  },
  low: { 
    className: 'bg-[#22C55E] text-white border-[#22C55E]',
    label: 'LOW',
    icon: '🟢'
  },
};

export default function UrgencyBadge({ urgency, reason, size = 'md' }: UrgencyBadgeProps) {
  const config = urgencyConfig[urgency];
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0' : 
                      size === 'lg' ? 'text-sm px-3 py-1' : 
                      'text-xs px-2 py-0.5';

  return (
    <div className="flex flex-col items-start gap-1">
      <Badge 
        variant="outline"
        className={cn(
          "font-bold rounded-full gap-1",
          config.className,
          sizeClasses,
          urgency === 'critical' && "critical-pulse"
        )}
      >
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </Badge>
      {reason && (
        <p className="text-xs text-[#9CA3AF] ml-1">{reason}</p>
      )}
    </div>
  );
}
