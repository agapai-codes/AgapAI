'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import type { Incident } from '../types/incident';

const URGENCY_LABELS: Record<string, string> = {
  HIGH: '🔴 HIGH',
  MEDIUM: '🟡 MEDIUM',
  LOW: '🟢 LOW',
};

const TYPE_ICONS: Record<string, string> = {
  FIRE: '🔥', ACCIDENT: '🚗', MEDICAL: '🏥', VIOLENCE: '⚠️',
  NATURAL_DISASTER: '🌪️', DISASTER: '🌪️', HAZARDOUS: '☢️', MISSING_PERSON: '🔍',
};

/**
 * Listens for 'incident:new' custom events and shows toast notifications.
 * Wire this into the dispatcher dashboard.
 */
export function useIncidentNotifications() {
  useEffect(() => {
    const handler = (e: Event) => {
      const inc = (e as CustomEvent<Incident>).detail;
      if (!inc) return;

      const icon = TYPE_ICONS[inc.type] || '📋';
      const urgency = URGENCY_LABELS[inc.urgency?.toUpperCase() || 'MEDIUM'] || 'MEDIUM';
      const location = inc.location?.slice(0, 30) || 'Unknown location';

      toast(`${icon} New ${inc.type.replace('_', ' ')} incident`, {
        description: `${urgency} — ${location}`,
        duration: 5000,
      });
    };

    window.addEventListener('incident:new', handler);
    return () => window.removeEventListener('incident:new', handler);
  }, []);
}
