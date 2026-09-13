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
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const isMounted = useRef(true);
  const inFlight = useRef(false);
  const demoIdsRef = useRef(new Set<string>());

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
        const preserved = prev.filter(
          (i) => i.id.startsWith('local-') || demoIdsRef.current.has(i.id)
        );
        const localOnly = preserved.filter((i) => !apiIds.has(i.id));
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

    if (id.startsWith('local-')) {
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

    if (id.startsWith('local-')) {
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

  const purge = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/incidents/reset', { method: 'POST' });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Purge failed');
      }
      demoIdsRef.current.clear();
      setIncidents([]);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to purge incidents');
      return false;
    }
  }, []);

  const loadDemoIncidents = useCallback((demoIncidents: Incident[]) => {
    demoIncidents.forEach((d) => demoIdsRef.current.add(d.id));
    setIncidents(demoIncidents);
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
    purge,
    loadDemoIncidents,
  };
}

// SEED_INCIDENTS removed — dashboard starts empty, populated by DB via /api/incidents
