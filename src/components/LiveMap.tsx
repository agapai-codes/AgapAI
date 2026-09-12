'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Incident } from '../types/incident';

const FREE_OSM_STYLE = {
  version: 8 as const,
  sources: {
    'osm': {
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
  RESOLVED: '✅',
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

// Cluster radius in degrees (≈200m at Iligan City latitude)
const CLUSTER_RADIUS_DEG = 0.002;

interface Cluster {
  center: { lng: number; lat: number };
  incidents: Incident[];
  id: string;
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

export default function LiveMap({ incidents, activeIncident, onIncidentClick }: { incidents: Incident[]; activeIncident: Incident | null; onIncidentClick: (incident: Incident) => void }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const incidentsRef = useRef<Incident[]>([]);

  // Keep incidentsRef in sync
  incidentsRef.current = incidents;

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: FREE_OSM_STYLE as any,
      center: [124.2452, 8.2280],
      zoom: 13,
      pitch: 0,
      bearing: 0,
      maxZoom: 20,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      setTimeout(() => map.resize(), 100);

      // Lighter filter — markers stay visible
      const canvas = mapContainer.current?.querySelector('canvas');
      if (canvas) {
        canvas.style.filter = 'brightness(0.75) contrast(1.15) saturate(0.8)';
      }

      // Render initial markers
      renderMarkers(map, incidentsRef.current);
    });

    const handleResize = () => map.resize();
    window.addEventListener('resize', handleResize);
    mapRef.current = map;

    return () => {
      window.removeEventListener('resize', handleResize);
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Re-render markers whenever incidents change
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.loaded()) return;
    renderMarkers(mapRef.current, incidents);
  }, [incidents]);

  // Fly to active incident
  useEffect(() => {
    if (!mapRef.current || !activeIncident) return;
    mapRef.current.flyTo({
      center: [activeIncident.coordinates.lng, activeIncident.coordinates.lat],
      zoom: 15,
      pitch: 0,
      duration: 1500,
    });
  }, [activeIncident]);

  function renderMarkers(map: maplibregl.Map, incs: Incident[]) {
    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (incs.length === 0) return;

    const clusters = clusterIncidents(incs);

    for (const cluster of clusters) {
      if (cluster.incidents.length === 1) {
        // Single incident — standard marker
        const inc = cluster.incidents[0];
        const el = createSingleMarker(inc);

        const popup = createPopup(inc);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([inc.coordinates.lng, inc.coordinates.lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener('click', () => onIncidentClick(inc));
        markersRef.current.push(marker);
      } else {
        // Cluster — count badge
        const el = createClusterMarker(cluster);

        // Build popup listing all incidents in cluster
        const popupHtml = cluster.incidents.map(inc => `
          <div style="padding: 8px; border-bottom: 1px solid #27272a; cursor: pointer;" class="cluster-item" data-id="${inc.id}">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 14px;">${STATUS_ICONS[inc.status] || '📋'}</span>
              <span style="font-size: 12px; font-weight: 600; color: #fafafa;">${escapeHtml(inc.type)}</span>
              <span style="font-size: 10px; color: #71717a;">${escapeHtml(inc.status)}</span>
            </div>
            <p style="font-size: 11px; color: #a1a1aa; margin-top: 4px;">${escapeHtml(inc.location)}</p>
          </div>
        `).join('');

        const popup = new maplibregl.Popup({ offset: 15, closeButton: true, maxWidth: '300px' }).setHTML(`
          <div style="font-family: system-ui, sans-serif; background: rgba(24,24,27,0.95); backdrop-filter: blur(12px); border: 1px solid rgba(39,39,42,0.4); border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); overflow: hidden;">
            <div style="padding: 10px 12px; border-bottom: 1px solid #27272a;">
              <p style="font-size: 12px; font-weight: 700; color: #fafafa; margin: 0;">${cluster.incidents.length} incidents at this location</p>
            </div>
            ${popupHtml}
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([cluster.center.lng, cluster.center.lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener('click', () => {
          // If cluster has few items, fly to show them all
          if (cluster.incidents.length <= 5) {
            onIncidentClick(cluster.incidents[0]);
          }
        });

        markersRef.current.push(marker);
      }
    }
  }

  function createSingleMarker(inc: Incident): HTMLDivElement {
    const color = INCIDENT_COLORS[inc.type] || '#71717a';
    const icon = STATUS_ICONS[inc.status] || '📋';
    const isPending = inc.status === 'PENDING';

    const el = document.createElement('div');
    el.style.cssText = 'position: relative; cursor: pointer; width: 32px; height: 32px;';

    if (isPending) {
      const ping = document.createElement('div');
      ping.style.cssText = `position: absolute; width: 32px; height: 32px; border-radius: 50%; background: ${color}; opacity: 0.4; top: 0; left: 0; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;`;
      el.appendChild(ping);
    }

    const marker = document.createElement('div');
    marker.style.cssText = `width: 32px; height: 32px; border-radius: 8px; background: ${color}; border: 2px solid rgba(255,255,255,0.4); display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.5); position: relative; z-index: 1;`;
    marker.innerHTML = icon;
    el.appendChild(marker);

    // Urgency dot
    if (inc.urgency === 'critical') {
      const dot = document.createElement('div');
      dot.style.cssText = 'position: absolute; top: -4px; right: -4px; width: 10px; height: 10px; border-radius: 50%; background: #ef4444; border: 2px solid #000; z-index: 2; animation: pulse 1.5s ease-in-out infinite;';
      el.appendChild(dot);
    }

    return el;
  }

  function createClusterMarker(cluster: Cluster): HTMLDivElement {
    const count = cluster.incidents.length;
    const hasCritical = cluster.incidents.some(i => i.urgency === 'critical');
    const bgColor = hasCritical ? '#ef4444' : '#f97316';

    const el = document.createElement('div');
    el.style.cssText = 'position: relative; cursor: pointer; width: 40px; height: 40px;';

    // Outer ring
    const ring = document.createElement('div');
    ring.style.cssText = `position: absolute; width: 40px; height: 40px; border-radius: 50%; border: 3px solid ${bgColor}; opacity: 0.5; top: 0; left: 0;`;
    el.appendChild(ring);

    // Inner circle with count
    const circle = document.createElement('div');
    circle.style.cssText = `width: 40px; height: 40px; border-radius: 50%; background: ${bgColor}; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; color: white; box-shadow: 0 4px 16px rgba(0,0,0,0.5); position: relative; z-index: 1; border: 2px solid rgba(255,255,255,0.3);`;
    circle.textContent = String(count);
    el.appendChild(circle);

    return el;
  }

  function createPopup(inc: Incident): maplibregl.Popup {
    const color = INCIDENT_COLORS[inc.type] || '#6B7280';
    const urgencyColor = inc.urgency === 'critical' ? '#ef4444' : inc.urgency === 'high' ? '#f97316' : inc.urgency === 'medium' ? '#eab308' : '#22c55e';

    return new maplibregl.Popup({ offset: 15, closeButton: false, maxWidth: '280px' }).setHTML(`
      <div style="padding: 12px; font-family: system-ui, sans-serif; background: rgba(24,24,27,0.95); backdrop-filter: blur(12px); border: 1px solid rgba(39,39,42,0.4); border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <span style="font-size: 18px;">${STATUS_ICONS[inc.status]}</span>
          <div>
            <div style="font-weight: 600; font-size: 14px; color: #fafafa;">${escapeHtml(inc.type)}</div>
            <div style="font-size: 12px; color: #a1a1aa;">${escapeHtml(inc.location)}</div>
          </div>
        </div>
        <div style="display: flex; gap: 6px; margin-bottom: 10px;">
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

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px', position: 'relative', overflow: 'hidden', background: '#09090b' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(24,24,27,0.9)', backdropFilter: 'blur(8px)', padding: '8px 12px', borderRadius: '8px', border: '1px solid #27272a', zIndex: 10 }}>
        <p style={{ fontSize: '10px', color: '#71717a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Iligan City, Philippines</p>
        <p style={{ fontSize: '12px', color: '#d4d4d8', fontWeight: 500 }}>{incidents.length} Active Incidents</p>
      </div>
    </div>
  );
}
