// src/hooks/useIncidents.ts
// Polling-based live incident feed (Vercel-friendly; no websocket server required).

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Incident, IncidentStatus, IncidentType } from '../types/incident';

const POLL_INTERVAL_MS = 5000;

interface CreateInput {
  type: IncidentType;
  location: string;
  description: string;
  reporter: string;
  coordinates: { lng: number; lat: number };
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
  // Seed with the known demo dataset so the UI is never empty even if the API is down.
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
      // Merge: API is source of truth, but keep local-only (just-created) items.
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

  // Initial load + polling
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
    // Optimistic local entry so the reporter sees instant feedback.
    const optimistic: Incident = {
      id: `local-${Date.now()}`,
      type: input.type,
      location: input.location,
      description: input.description,
      coordinates: input.coordinates,
      status: 'PENDING',
      reporter: input.reporter,
      timestamp: new Date().toISOString(),
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
      return optimistic; // keep the local one so the UI still shows it
    }
  }, []);

  const updateStatus = useCallback(async (id: string, status: IncidentStatus): Promise<Incident | null> => {
    const previous = incidents;
    // Optimistic update
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));

    // Local-only items never existed server-side; just keep the optimistic change.
    if (id.startsWith('local-')) return null;

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
      setIncidents(previous); // rollback
      return null;
    }
  }, [incidents]);

  return {
    incidents,
    loading,
    error,
    lastSync,
    isLive: error === null && lastSync !== null,
    refresh,
    createIncident,
    updateStatus,
  };
}

// ---------------------------------------------------------------------------
// Seed data — mirrors the Neon seed rows so the dashboard has content instantly.
// Used as initial state before the first poll resolves.
// ---------------------------------------------------------------------------
const now = Date.now();
export const SEED_INCIDENTS: Incident[] = [
  { id: 'seed-1', type: 'FIRE', location: 'V. Carral St, Poblacion, Iligan City', description: 'Residential structural fire spreading to adjacent building.', coordinates: { lng: 124.2442, lat: 8.2295 }, status: 'PENDING', reporter: 'Juan Dela Cruz', timestamp: new Date(now - 120_000).toISOString() },
  { id: 'seed-2', type: 'MEDICAL', location: 'Buru-un, Iligan City', description: 'Severe respiratory distress requiring immediate oxygen deployment.', coordinates: { lng: 124.1850, lat: 8.1960 }, status: 'PENDING', reporter: 'Maria Santos', timestamp: new Date(now - 300_000).toISOString() },
  { id: 'seed-3', type: 'ACCIDENT', location: 'MSU-IIT Engineering, Iligan City', description: 'Two-vehicle collision near the gate boundary.', coordinates: { lng: 124.2452, lat: 8.2415 }, status: 'DISPATCHED', reporter: 'Prof. Almaran', timestamp: new Date(now - 600_000).toISOString() },
  { id: 'seed-4', type: 'DISASTER', location: 'Brgy. Pala-o, Iligan City', description: 'Localized flash flood blocking intersection lanes.', coordinates: { lng: 124.2530, lat: 8.2320 }, status: 'PENDING', reporter: 'K. Vergara', timestamp: new Date(now - 900_000).toISOString() },
  { id: 'seed-5', type: 'FIRE', location: 'Sabayle St, Tibanga, Iligan City', description: 'Electrical transformer sparking over market structures.', coordinates: { lng: 124.2410, lat: 8.2365 }, status: 'DISPATCHED', reporter: 'A. Vergara', timestamp: new Date(now - 1_200_000).toISOString() },
];
