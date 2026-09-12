'use client';

import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Incident } from '../types/incident';

const FREE_OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 255,
      minzoom: 0,
      maxzoom: 18,
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    { id: 'osm-layer', type: 'raster' as const, source: 'osm', minzoom: 0, maxzoom: 24 },
  ],
};

const INCIDENT_COLORS: Record<string, string> = {
  FIRE: '#ef4444',
  ACCIDENT: '#f97316',
  MEDICAL: '#3b82f6',
  DISASTER: '#a855f7',
  VIOLENCE: '#f43f5e',
  HAZARDOUS: '#facc15',
  MISSING_PERSON: '#06b6d4',
};

const STATUS_ICONS: Record<string, string> = {
  PENDING: '⏳',
  DISPATCHED: '🚑',
  EN_ROUTE: '🚗',
  ARRIVED: '📍',
  REVIEWING: '👁️',
  PRIORITIZED: '🔴',
  RESOLVED: '✅',
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)
  );
}

// ── Clustering ────────────────────────────────────────────────────────────────
// ~50m at Iligan City latitude — tight enough to avoid false clusters, loose
// enough for same-building reports.
const CLUSTER_RADIUS_DEG = 0.00045;

// Minimum distance (degrees) between two incidents before we apply a micro-jitter
// so that identical-GPS reports render as a spiderified fan instead of a single pin.
const JITTER_THRESHOLD_DEG = 0.00005; // ~5m

interface Cluster {
  center: { lng: number; lat: number };
  incidents: Incident[];
  id: string;
}

/**
 * Assign micro-jitter offsets to incidents that share near-identical coordinates.
 * Returns a Map<incidentId, { lng, lat }> with the jittered position.
 */
function computeJitteredPositions(incidents: Incident[]): Map<string, { lng: number; lat: number }> {
  const positions = new Map<string, { lng: number; lat: number }>();

  // Group by near-identical coordinates
  const groups: Incident[][] = [];
  const assigned = new Set<string>();

  for (const inc of incidents) {
    if (assigned.has(inc.id)) continue;
    const group: Incident[] = [inc];
    assigned.add(inc.id);
    for (const other of incidents) {
      if (assigned.has(other.id)) continue;
      if (
        Math.abs(inc.coordinates.lng - other.coordinates.lng) < JITTER_THRESHOLD_DEG &&
        Math.abs(inc.coordinates.lat - other.coordinates.lat) < JITTER_THRESHOLD_DEG
      ) {
        group.push(other);
        assigned.add(other.id);
      }
    }
    groups.push(group);
  }

  // Apply radial jitter for groups with >1 incident
  for (const group of groups) {
    if (group.length === 1) {
      positions.set(group[0].id, group[0].coordinates);
      continue;
    }
    const base = group[0].coordinates;
    const jitterRadius = 0.00015; // ~15m offset
    group.forEach((inc, i) => {
      const angle = (2 * Math.PI * i) / group.length;
      positions.set(inc.id, {
        lng: base.lng + jitterRadius * Math.cos(angle),
        lat: base.lat + jitterRadius * Math.sin(angle),
      });
    });
  }

  return positions;
}

function clusterIncidents(incidents: Incident[]): Cluster[] {
  const clusters: Cluster[] = [];
  const used = new Set<string>();

  for (const inc of incidents) {
    if (used.has(inc.id)) continue;

    const cluster: Incident[] = [inc];
    used.add(inc.id);

    for (const other of incidents) {
      if (used.has(other.id)) continue;
      const dlng = Math.abs(inc.coordinates.lng - other.coordinates.lng);
      const dlat = Math.abs(inc.coordinates.lat - other.coordinates.lat);
      if (dlng < CLUSTER_RADIUS_DEG && dlat < CLUSTER_RADIUS_DEG) {
        cluster.push(other);
        used.add(other.id);
      }
    }

    const avgLng = cluster.reduce((s, c) => s + c.coordinates.lng, 0) / cluster.length;
    const avgLat = cluster.reduce((s, c) => s + c.coordinates.lat, 0) / cluster.length;

    clusters.push({
      center: { lng: avgLng, lat: avgLat },
      incidents: cluster,
      id: `cluster-${cluster[0].id}`,
    });
  }

  return clusters;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface LiveMapProps {
  incidents: Incident[];
  activeIncident: Incident | null;
  onIncidentClick: (incident: Incident) => void;
}

export default function LiveMap({ incidents, activeIncident, onIncidentClick }: LiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupsRef = useRef<maplibregl.Popup[]>([]);
  const incidentsRef = useRef<Incident[]>([]);
  const onIncidentClickRef = useRef(onIncidentClick);
  const jitteredPositionsRef = useRef<Map<string, { lng: number; lat: number }>>(new Map());

  // Keep refs fresh without triggering re-renders
  incidentsRef.current = incidents;
  onIncidentClickRef.current = onIncidentClick;

  // Compute jittered positions whenever incidents change
  useEffect(() => {
    jitteredPositionsRef.current = computeJitteredPositions(incidents);
  }, [incidents]);

  // ── ResizeObserver for reliable container resize ────────────────────────────
  useEffect(() => {
    if (!mapContainer.current) return;
    const container = mapContainer.current;

    const observer = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // ── Map init (once) ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Calculate initial center from incidents or fall back to Philippines center
    const incs = incidentsRef.current;
    let initialCenter: [number, number] = [121.7, 12.8]; // Philippines center
    let initialZoom = 6;

    if (incs.length > 0) {
      const avgLng = incs.reduce((s, i) => s + i.coordinates.lng, 0) / incs.length;
      const avgLat = incs.reduce((s, i) => s + i.coordinates.lat, 0) / incs.length;
      initialCenter = [avgLng, avgLat];
      initialZoom = incs.length === 1 ? 15 : 13;
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: FREE_OSM_STYLE as any,
      center: initialCenter,
      zoom: initialZoom,
      pitch: 0,
      bearing: 0,
      maxZoom: 20,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.resize();

      const canvas = mapContainer.current?.querySelector('canvas');
      if (canvas) {
        canvas.style.filter = 'brightness(0.75) contrast(1.15) saturate(0.8)';
      }

      renderMarkers(map, incidentsRef.current, null);
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      popupsRef.current.forEach((p) => p.remove());
      popupsRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Re-render markers on incident or activeIncident changes ─────────────────
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.loaded()) return;
    renderMarkers(mapRef.current, incidents, activeIncident?.id ?? null);
  }, [incidents, activeIncident?.id]);

  // ── Fly to active incident ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !activeIncident?.coordinates) return;

    // Close any open popups first
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];

    mapRef.current.flyTo({
      center: [activeIncident.coordinates.lng, activeIncident.coordinates.lat],
      zoom: 16,
      pitch: 0,
      duration: 1500,
    });
  }, [activeIncident]);

  // ── Render markers ─────────────────────────────────────────────────────────
  function renderMarkers(map: maplibregl.Map, incs: Incident[], activeId: string | null) {
    // Clear existing
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];

    if (incs.length === 0) return;

    const clusters = clusterIncidents(incs);
    const positions = jitteredPositionsRef.current;

    for (const cluster of clusters) {
      if (cluster.incidents.length === 1) {
        const inc = cluster.incidents[0];
        const pos = positions.get(inc.id) || inc.coordinates;
        const el = createSingleMarker(inc, activeId);
        const popup = createSinglePopup(inc);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([pos.lng, pos.lat])
          .setPopup(popup)
          .addTo(map);

        // Use data attribute + event delegation to avoid stale closures
        el.dataset.incidentId = inc.id;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = (e.currentTarget as HTMLElement).dataset.incidentId;
          if (id) {
            const found = incidentsRef.current.find((i) => i.id === id);
            if (found) onIncidentClickRef.current(found);
          }
        });

        markersRef.current.push(marker);
        popupsRef.current.push(popup);
      } else {
        const el = createClusterMarker(cluster);
        const popup = createClusterPopup(cluster);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([cluster.center.lng, cluster.center.lat])
          .setPopup(popup)
          .addTo(map);

        // Cluster marker click → zoom in to show individual pins
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          map.flyTo({
            center: [cluster.center.lng, cluster.center.lat],
            zoom: Math.min(map.getZoom() + 2, 18),
            duration: 800,
          });
        });

        markersRef.current.push(marker);
        popupsRef.current.push(popup);

        // Attach click handlers to cluster popup items after it's in the DOM
        popup.on('open', () => {
          const container = popup.getElement();
          if (!container) return;

          container.addEventListener('click', (e) => {
            const target = (e.target as HTMLElement).closest('[data-cluster-item-id]');
            if (!target) return;
            e.stopPropagation();

            const id = (target as HTMLElement).dataset.clusterItemId;
            if (!id) return;

            const found = incidentsRef.current.find((i) => i.id === id);
            if (found) {
              popup.remove();
              onIncidentClickRef.current(found);
            }
          });
        });
      }
    }
  }

  // ── Single incident marker ─────────────────────────────────────────────────
  function createSingleMarker(inc: Incident, activeId: string | null): HTMLDivElement {
    const color = INCIDENT_COLORS[inc.type] || '#71717a';
    const icon = STATUS_ICONS[inc.status] || '📋';
    const isActive = activeId === inc.id;

    const el = document.createElement('div');
    el.style.cssText = `position: relative; cursor: pointer; width: ${isActive ? 40 : 32}px; height: ${isActive ? 40 : 32}px; transition: transform 0.2s;`;
    if (isActive) el.style.transform = 'scale(1.25)';

    if (inc.status === 'PENDING') {
      const ping = document.createElement('div');
      ping.style.cssText = `position: absolute; width: 100%; height: 100%; border-radius: 50%; background: ${color}; opacity: 0.4; top: 0; left: 0; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;`;
      el.appendChild(ping);
    }

    const marker = document.createElement('div');
    const size = isActive ? 40 : 32;
    marker.style.cssText = `width: ${size}px; height: ${size}px; border-radius: 8px; background: ${color}; border: 2px solid rgba(255,255,255,0.4); display: flex; align-items: center; justify-content: center; font-size: ${isActive ? 16 : 14}px; box-shadow: 0 4px 16px rgba(0,0,0,0.5); position: relative; z-index: 1;`;
    marker.innerHTML = icon;
    el.appendChild(marker);

    if (inc.urgency === 'critical') {
      const dot = document.createElement('div');
      dot.style.cssText = 'position: absolute; top: -4px; right: -4px; width: 10px; height: 10px; border-radius: 50%; background: #ef4444; border: 2px solid #000; z-index: 2; animation: pulse 1.5s ease-in-out infinite;';
      el.appendChild(dot);
    }

    return el;
  }

  // ── Cluster marker ─────────────────────────────────────────────────────────
  function createClusterMarker(cluster: Cluster): HTMLDivElement {
    const count = cluster.incidents.length;
    const hasCritical = cluster.incidents.some((i) => i.urgency === 'critical');
    const bgColor = hasCritical ? '#ef4444' : count >= 10 ? '#dc2626' : '#f97316';

    const el = document.createElement('div');
    el.style.cssText = 'position: relative; cursor: pointer; width: 44px; height: 44px;';

    const ring = document.createElement('div');
    ring.style.cssText = `position: absolute; width: 44px; height: 44px; border-radius: 50%; border: 3px solid ${bgColor}; opacity: 0.4; top: 0; left: 0; animation: pulse 2s ease-in-out infinite;`;
    el.appendChild(ring);

    const circle = document.createElement('div');
    circle.style.cssText = `width: 44px; height: 44px; border-radius: 50%; background: ${bgColor}; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 900; color: white; box-shadow: 0 4px 16px rgba(0,0,0,0.5); position: relative; z-index: 1; border: 2px solid rgba(255,255,255,0.3);`;
    circle.textContent = String(count);
    el.appendChild(circle);

    return el;
  }

  // ── Single incident popup ──────────────────────────────────────────────────
  function createSinglePopup(inc: Incident): maplibregl.Popup {
    const color = INCIDENT_COLORS[inc.type] || '#6B7280';
    const urgencyColor =
      inc.urgency === 'critical' ? '#ef4444'
      : inc.urgency === 'high' ? '#f97316'
      : inc.urgency === 'medium' ? '#eab308'
      : '#22c55e';

    return new maplibregl.Popup({ offset: 15, closeButton: false, maxWidth: '280px' }).setHTML(`
      <div style="padding: 12px; font-family: system-ui, sans-serif; background: rgba(24,24,27,0.95); backdrop-filter: blur(12px); border: 1px solid rgba(39,39,42,0.4); border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <span style="font-size: 18px;">${STATUS_ICONS[inc.status] || '📋'}</span>
          <div>
            <div style="font-weight: 600; font-size: 14px; color: #fafafa;">${escapeHtml(inc.type)}</div>
            <div style="font-size: 12px; color: #a1a1aa;">${escapeHtml(inc.location)}</div>
          </div>
        </div>
        <div style="display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap;">
          <span style="padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: ${color}22; color: ${color}; border: 1px solid ${color}44;">${escapeHtml(inc.type)}</span>
          <span style="padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: #27272a; color: #a1a1aa; border: 1px solid #3f3f46;">${escapeHtml(inc.status)}</span>
          <span style="padding: 3px 10px; border-radius: 9999px; font-size: 10px; font-weight: 700; background: ${urgencyColor}22; color: ${urgencyColor}; border: 1px solid ${urgencyColor}44;">${(inc.urgency || 'medium').toUpperCase()}</span>
        </div>
        ${inc.condition ? `<p style="font-size: 11px; color: #a1a1aa; margin-bottom: 6px;"><strong>Condition:</strong> ${escapeHtml(inc.condition)}</p>` : ''}
        ${inc.people_affected && inc.people_affected > 1 ? `<p style="font-size: 11px; color: #a1a1aa; margin-bottom: 6px;"><strong>People:</strong> ${inc.people_affected}</p>` : ''}
        <div style="font-size: 12px; color: #71717a;">${new Date(inc.timestamp).toLocaleTimeString()}</div>
      </div>
    `);
  }

  // ── Cluster popup ──────────────────────────────────────────────────────────
  function createClusterPopup(cluster: Cluster): maplibregl.Popup {
    const listHtml = cluster.incidents
      .map(
        (inc) => `
      <div data-cluster-item-id="${inc.id}" style="padding: 10px 12px; border-bottom: 1px solid #27272a; cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='rgba(63,63,70,0.3)'" onmouseout="this.style.background='transparent'">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 14px;">${STATUS_ICONS[inc.status] || '📋'}</span>
          <span style="font-size: 12px; font-weight: 600; color: #fafafa;">${escapeHtml(inc.type)}</span>
          <span style="font-size: 10px; color: #71717a; margin-left: auto;">${escapeHtml(inc.status)}</span>
        </div>
        <p style="font-size: 11px; color: #a1a1aa; margin: 4px 0 0 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;">${escapeHtml(inc.location)}</p>
      </div>`,
      )
      .join('');

    return new maplibregl.Popup({ offset: 15, closeButton: true, maxWidth: '320px', closeOnClick: false }).setHTML(`
      <div style="font-family: system-ui, sans-serif; background: rgba(24,24,27,0.95); backdrop-filter: blur(12px); border: 1px solid rgba(39,39,42,0.4); border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); overflow: hidden;">
        <div style="padding: 10px 12px; border-bottom: 1px solid #27272a; display: flex; align-items: center; justify-content: space-between;">
          <p style="font-size: 12px; font-weight: 700; color: #fafafa; margin: 0;">${cluster.incidents.length} incidents at this location</p>
          <span style="font-size: 10px; color: #71717a;">Click item to open</span>
        </div>
        <div style="max-height: 300px; overflow-y: auto;">
          ${listHtml}
        </div>
      </div>
    `);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const locationLabel = incidents.length > 0
    ? `${incidents.length} Active Incident${incidents.length !== 1 ? 's' : ''}`
    : 'No active incidents';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#09090b' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      <div style={{
        position: 'absolute', top: '12px', left: '12px',
        background: 'rgba(24,24,27,0.9)', backdropFilter: 'blur(8px)',
        padding: '8px 12px', borderRadius: '8px',
        border: '1px solid #27272a', zIndex: 10,
      }}>
        <p style={{ fontSize: '10px', color: '#71717a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Philippines
        </p>
        <p style={{ fontSize: '12px', color: '#d4d4d8', fontWeight: 500 }}>{locationLabel}</p>
      </div>
    </div>
  );
}
