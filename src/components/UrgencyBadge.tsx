'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface UrgencyBadgeProps {
  urgency: 'critical' | 'high' | 'medium' | 'low';
  reason?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Urgency is the only thing coloured on an incident row. Critical and high
 * share the red family; critical earns the solid fill.
 */
const urgencyConfig = {
  critical: {
    className: 'chip-critical-solid',
    label: 'CRITICAL',
  },
  high: {
    className: 'chip-critical',
    label: 'HIGH',
  },
  medium: {
    className: 'chip-warning',
    label: 'MEDIUM',
  },
  low: {
    className: 'chip-success',
    label: 'LOW',
  },
} as const;

export default function UrgencyBadge({ urgency, reason, size = 'md' }: UrgencyBadgeProps) {
  const config = urgencyConfig[urgency];
  const sizeClasses =
    size === 'sm'
      ? 'px-1.5 text-[11px]'
      : size === 'lg'
        ? 'px-3 py-1 text-xs'
        : '';

  const badge = (
    <Badge
      variant="outline"
      aria-label={`Urgency: ${config.label}`}
      className={cn('chip mono', config.className, sizeClasses)}
    >
      {config.label}
    </Badge>
  );

  if (reason) {
    return (
      <Tooltip>
        <TooltipTrigger>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-xs">{reason}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return badge;
}
