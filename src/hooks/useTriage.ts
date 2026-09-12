import { useState, useCallback, useMemo } from 'react';
import type { Incident, IncidentStatus, UrgencyLevel } from '../types/incident';
import type { TriageResult, QueueItem, QueueSortBy, QueueFilterBy } from '../types/triage';
import { generateTriageRecommendation, calculatePriorityScore, recalculatePriorityScore } from '../lib/triageEngine';

interface UseTriageOptions {
  incidents: Incident[];
  sortBy?: QueueSortBy;
  filterBy?: QueueFilterBy;
}

export function useTriage({ incidents, sortBy = 'priority', filterBy = 'all' }: UseTriageOptions) {
  const [triageResults, setTriageResults] = useState<Map<string, TriageResult>>(new Map());

  // Generate triage for an incident
  const triageIncident = useCallback((incident: Incident): TriageResult => {
    // Check if already triaged
    const existing = triageResults.get(incident.id);
    if (existing) return existing;

    const recommendation = generateTriageRecommendation(
      incident.type,
      incident.urgency || 'medium',
      incident.confidence ?? 0.7,
      incident.people_affected || 1,
      incident.consciousness ?? true,
      incident.breathing ?? true,
      incident.bleeding || false,
      incident.hazards || []
    );

    const result: TriageResult = {
      incident_type: incident.type,
      condition: incident.condition || 'Under Assessment',
      injuries: incident.bleeding ? ['Active bleeding'] : [],
      location_description: incident.location,
      coordinates: incident.coordinates,
      consciousness: incident.consciousness ?? null,
      breathing: incident.breathing ?? null,
      bleeding: incident.bleeding || false,
      people_affected: incident.people_affected || 1,
      hazards: incident.hazards || [],
      urgency: incident.urgency || 'medium',
      urgency_reason: incident.urgency_reason || 'Standard assessment',
      confidence: incident.confidence ?? 0.7,
      recommendation,
      transcript: incident.transcript || '',
      extracted_at: new Date().toISOString(),
    };

    setTriageResults(prev => new Map(prev).set(incident.id, result));
    return result;
  }, [triageResults]);

  // Triage all incidents
  const triageAll = useCallback(() => {
    incidents.forEach(inc => triageIncident(inc));
  }, [incidents, triageIncident]);

  // Build priority queue
  const queue = useMemo((): QueueItem[] => {
    let filtered = incidents;

    // Filter by status
    if (filterBy === 'pending') {
      filtered = filtered.filter(i => i.status === 'PENDING' || i.status === 'REVIEWING');
    } else if (filterBy === 'dispatched') {
      filtered = filtered.filter(i => ['DISPATCHED', 'EN_ROUTE', 'ARRIVED'].includes(i.status));
    } else if (filterBy === 'critical') {
      filtered = filtered.filter(i => i.urgency === 'critical' && i.status !== 'RESOLVED');
    }

    // Build queue items with triage scores (recalculated with actual elapsed time)
    const items: QueueItem[] = filtered
      .filter(i => i.status !== 'RESOLVED')
      .map(inc => {
        const triage = triageIncident(inc);
        const minutesElapsed = (Date.now() - new Date(inc.timestamp).getTime()) / 60000;
        // Recalculate priority score with actual elapsed time for dynamic queue ranking
        const updatedScore = recalculatePriorityScore(
          triage.recommendation.severity_score,
          triage.confidence,
          minutesElapsed
        );
        return {
          incident_id: inc.id,
          dispatch_priority_score: updatedScore,
          triage_result: { ...triage, recommendation: { ...triage.recommendation, dispatch_priority_score: updatedScore } },
          status: inc.status,
          created_at: inc.timestamp,
          time_elapsed_minutes: Math.round(minutesElapsed),
        };
      });

    // Sort by priority score (descending) then by time (oldest first)
    items.sort((a, b) => {
      if (sortBy === 'priority') {
        if (b.dispatch_priority_score !== a.dispatch_priority_score) {
          return b.dispatch_priority_score - a.dispatch_priority_score;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'time') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'urgency') {
        const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (urgencyOrder[a.triage_result.urgency] ?? 3) - (urgencyOrder[b.triage_result.urgency] ?? 3);
      }
      return 0;
    });

    return items;
  }, [incidents, filterBy, sortBy, triageIncident]);

  return {
    queue,
    triageIncident,
    triageAll,
    triageResults,
  };
}
