// src/hooks/useIncidents.ts
// Polling-based live incident feed (Vercel-friendly; no websocket server required).

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Incident, IncidentStatus, IncidentType, UrgencyLevel } from '../types/incident';

const POLL_INTERVAL_MS = 5000;

interface CreateInput {
  type: IncidentType;
  location: string;
  description: string;
  reporter: string;
  coordinates: { lng: number; lat: number };
  urgency?: UrgencyLevel;
  urgency_reason?: string;
  people_affected?: number;
  condition?: string;
  hazards?: string[];
  transcript?: string;
  reporter_email?: string;
  confidence?: number;
  consciousness?: boolean;
  breathing?: boolean;
  bleeding?: boolean;
}

interface ApiListResponse {
  success: boolean;
  data?: Incident[];
  error?: string;
}

interface ApiItemResponse {
  success: boolean;
  data?: Incident;
  error?: string;
}

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>(SEED_INCIDENTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const isMounted = useRef(true);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch('/api/incidents', { cache: 'no-store' });
      const payload: ApiListResponse = await res.json();
      if (!res.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || `Request failed (${res.status})`);
      }
      if (!isMounted.current) return;
      setIncidents((prev) => {
        const apiIds = new Set(payload.data!.map((i) => i.id));
        const localOnly = prev.filter((i) => i.id.startsWith('local-') && !apiIds.has(i.id));
        return [...localOnly, ...payload.data!];
      });
      setError(null);
      setLastSync(new Date());
    } catch (err) {
      if (!isMounted.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load incidents');
    } finally {
      inFlight.current = false;
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      isMounted.current = false;
      clearInterval(id);
    };
  }, [refresh]);

  const createIncident = useCallback(async (input: CreateInput): Promise<Incident | null> => {
    const optimistic: Incident = {
      id: `local-${Date.now()}`,
      type: input.type,
      location: input.location,
      description: input.description,
      coordinates: input.coordinates,
      status: 'PENDING',
      reporter: input.reporter,
      timestamp: new Date().toISOString(),
      urgency: input.urgency || 'MEDIUM',
      urgency_reason: input.urgency_reason,
      people_affected: input.people_affected,
      condition: input.condition,
      hazards: input.hazards,
      reporter_email: input.reporter_email,
      confidence: input.confidence,
      consciousness: input.consciousness,
      breathing: input.breathing,
      bleeding: input.bleeding,
    };
    setIncidents((prev) => [optimistic, ...prev]);

    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const payload: ApiItemResponse = await res.json();
      if (!res.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || `Request failed (${res.status})`);
      }
      const saved = payload.data;
      setIncidents((prev) => [saved, ...prev.filter((i) => i.id !== optimistic.id)]);
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create incident');
      setIncidents((prev) => prev.filter((i) => i.id !== optimistic.id));
      return null;
    }
  }, []);

  const updateStatus = useCallback(async (id: string, status: IncidentStatus): Promise<Incident | null> => {
    let previous: Incident[] = [];
    setIncidents((prev) => {
      previous = prev;
      return prev.map((i) => (i.id === id ? { ...i, status } : i));
    });
    const optimistic = previous.find((i) => i.id === id);

    if (id.startsWith('local-') || id.startsWith('seed-')) {
      return optimistic ? { ...optimistic, status } : null;
    }

    try {
      const res = await fetch(`/api/incidents/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const payload: ApiItemResponse = await res.json();
      if (!res.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || `Request failed (${res.status})`);
      }
      setIncidents((prev) => prev.map((i) => (i.id === id ? payload.data! : i)));
      return payload.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
      setIncidents(previous);
      return null;
    }
  }, []);

  const updateUrgency = useCallback(async (id: string, urgency: UrgencyLevel, urgency_reason: string): Promise<Incident | null> => {
    let previous: Incident[] = [];
    setIncidents((prev) => {
      previous = prev;
      return prev.map((i) => (i.id === id ? { ...i, urgency, urgency_reason } : i));
    });

    if (id.startsWith('local-') || id.startsWith('seed-')) {
      const item = previous.find((i) => i.id === id);
      return item ? { ...item, urgency, urgency_reason } : null;
    }

    try {
      const res = await fetch(`/api/incidents/${id}/urgency`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urgency, urgency_reason }),
      });
      const payload: ApiItemResponse = await res.json();
      if (!res.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || `Request failed (${res.status})`);
      }
      setIncidents((prev) => prev.map((i) => (i.id === id ? payload.data! : i)));
      return payload.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update urgency');
      setIncidents(previous);
      return null;
    }
  }, []);

  const getHistory = useCallback(async (id: string): Promise<Array<{
    id: string;
    old_status: string | null;
    new_status: string;
    changed_by: string | null;
    notes: string | null;
    created_at: string;
  }> | null> => {
    if (id.startsWith('local-') || id.startsWith('seed-')) return [];
    try {
      const res = await fetch(`/api/incidents/${id}/history`);
      const payload = await res.json();
      if (!res.ok || !payload.success) return null;
      return payload.data;
    } catch {
      return null;
    }
  }, []);

  const assignResponder = useCallback(async (incidentId: string, responderId: string): Promise<Incident | null> => {
    try {
      const res = await fetch(`/api/incidents/${incidentId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responder_id: responderId }),
      });
      const payload: ApiItemResponse = await res.json();
      if (!res.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Failed to assign');
      }
      setIncidents((prev) => prev.map((i) => (i.id === incidentId ? payload.data! : i)));
      return payload.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign responder');
      return null;
    }
  }, []);

  const resolveIncident = useCallback(async (id: string, resolutionNotes: string): Promise<Incident | null> => {
    try {
      const res = await fetch(`/api/incidents/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'RESOLVED', resolution_notes: resolutionNotes }),
      });
      const payload: ApiItemResponse = await res.json();
      if (!res.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || 'Failed to resolve');
      }
      setIncidents((prev) => prev.map((i) => (i.id === id ? payload.data! : i)));
      return payload.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve incident');
      return null;
    }
  }, []);

  const getRelated = useCallback(async (id: string): Promise<Incident[] | null> => {
    if (id.startsWith('local-') || id.startsWith('seed-')) return [];
    try {
      const res = await fetch(`/api/incidents/${id}/related`);
      const payload = await res.json();
      if (!res.ok || !payload.success) return null;
      return payload.data;
    } catch {
      return null;
    }
  }, []);

  const getResponders = useCallback(async () => {
    try {
      const res = await fetch('/api/responders');
      const payload = await res.json();
      if (!res.ok || !payload.success) return [];
      return payload.data;
    } catch {
      return [];
    }
  }, []);

  return {
    incidents,
    loading,
    error,
    lastSync,
    isLive: error === null && lastSync !== null,
    refresh,
    createIncident,
    updateStatus,
    updateUrgency,
    getHistory,
    assignResponder,
    resolveIncident,
    getRelated,
    getResponders,
  };
}

const now = Date.now();
export const SEED_INCIDENTS: Incident[] = [
  { id: 'seed-1', type: 'FIRE', location: 'V. Carral St, Poblacion, Iligan City', description: 'Residential structural fire spreading to adjacent building.', coordinates: { lng: 124.2442, lat: 8.2295 }, status: 'PENDING', reporter: 'Juan Dela Cruz', timestamp: new Date(now - 120_000).toISOString(), urgency: 'CRITICAL', urgency_reason: 'Active structural fire with potential spread' },
  { id: 'seed-2', type: 'MEDICAL', location: 'Buru-un, Iligan City', description: 'Severe respiratory distress requiring immediate oxygen deployment.', coordinates: { lng: 124.1850, lat: 8.1960 }, status: 'PENDING', reporter: 'Maria Santos', timestamp: new Date(now - 300_000).toISOString(), urgency: 'HIGH', urgency_reason: 'Respiratory distress — conscious but in difficulty' },
  { id: 'seed-3', type: 'ACCIDENT', location: 'MSU-IIT Engineering, Iligan City', description: 'Two-vehicle collision near the gate boundary.', coordinates: { lng: 124.2452, lat: 8.2415 }, status: 'DISPATCHED', reporter: 'Prof. Almaran', timestamp: new Date(now - 600_000).toISOString(), urgency: 'HIGH', urgency_reason: 'Vehicle collision with injuries reported' },
  { id: 'seed-4', type: 'NATURAL_DISASTER', location: 'Brgy. Pala-o, Iligan City', description: 'Localized flash flood blocking intersection lanes.', coordinates: { lng: 124.2530, lat: 8.2320 }, status: 'PENDING', reporter: 'K. Vergara', timestamp: new Date(now - 900_000).toISOString(), urgency: 'MEDIUM', urgency_reason: 'Localized flooding — no immediate injuries reported' },
  { id: 'seed-5', type: 'FIRE', location: 'Sabayle St, Tibanga, Iligan City', description: 'Electrical transformer sparking over market structures.', coordinates: { lng: 124.2410, lat: 8.2365 }, status: 'DISPATCHED', reporter: 'A. Vergara', timestamp: new Date(now - 1_200_000).toISOString(), urgency: 'HIGH', urgency_reason: 'Electrical fire near market — structural risk' },
  { id: 'seed-6', type: 'MEDICAL', location: 'Rizal Ave, Cebu City', description: 'Cardiac arrest in elderly patient at restaurant.', coordinates: { lng: 123.8854, lat: 10.3157 }, status: 'PENDING', reporter: 'B. Reyes', timestamp: new Date(now - 180_000).toISOString(), urgency: 'CRITICAL', urgency_reason: 'Cardiac arrest — CPR in progress' },
  { id: 'seed-7', type: 'ACCIDENT', location: 'EDSA, Makati City', description: 'Multi-vehicle pileup during rush hour.', coordinates: { lng: 121.0500, lat: 14.5547 }, status: 'DISPATCHED', reporter: 'Traffic Bureau', timestamp: new Date(now - 450_000).toISOString(), urgency: 'HIGH', urgency_reason: 'Multiple injuries reported at scene' },
  { id: 'seed-8', type: 'VIOLENCE', location: 'Poblacion, Davao City', description: 'Reported stabbing incident near night market.', coordinates: { lng: 125.6128, lat: 7.0731 }, status: 'PENDING', reporter: 'C. Santos', timestamp: new Date(now - 240_000).toISOString(), urgency: 'HIGH', urgency_reason: 'Active violence scene with victim down' },
];
