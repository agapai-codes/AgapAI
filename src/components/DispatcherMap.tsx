'use client';

import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { IncidentReport } from '../types/incident';

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

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)
  );
}

interface DispatcherMapProps {
  incidents: IncidentReport[];
  selectedIncident: IncidentReport | null;
  onSelectIncident: (incident: IncidentReport) => void;
  isRightPanelOpen: boolean;
}

/**
 * Disperses incidents sharing identical/near-identical coordinates into a radial
 * spiral so pins never stack into a single unclickable dot.
 * Returns each incident with a `displayCoords` field for MapLibre rendering.
 */
function applySpiderifyJitter(
  incidents: IncidentReport[]
): (IncidentReport & { displayCoords: [number, number] })[] {
  const coordMap: { [key: string]: number } = {};

  return incidents.map((inc) => {
    const rawLng = inc.location?.coordinates?.[0] ?? 121.774;
    const rawLat = inc.location?.coordinates?.[1] ?? 12.879;
    const key = `${rawLng.toFixed(5)},${rawLat.toFixed(5)}`;

    if (!(key in coordMap)) {
      coordMap[key] = 0;
      return { ...inc, displayCoords: [rawLng, rawLat] as [number, number] };
    }

    const count = coordMap[key]++;
    const angle = count * (Math.PI / 4); // 45-degree spread
    const radius = 0.00035 * Math.ceil((count + 1) / 8); // ~35-40m rings

    const offsetLng = rawLng + radius * Math.cos(angle);
    const offsetLat = rawLat + radius * Math.sin(angle);

    return { ...inc, displayCoords: [offsetLng, offsetLat] as [number, number] };
  });
}

const URGENCY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
};

export const DispatcherMap: React.FC<DispatcherMapProps> = ({
  incidents,
  selectedIncident,
  onSelectIncident,
  isRightPanelOpen,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupsRef = useRef<maplibregl.Popup[]>([]);
  const onSelectRef = useRef(onSelectIncident);

  onSelectRef.current = onSelectIncident;

  // ── Initialize Map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: FREE_OSM_STYLE as any,
      center: [121.7740, 12.8797], // Philippines center
      zoom: 6,
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ResizeObserver ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current) return;
    const container = mapContainer.current;
    const observer = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Panel toggle resize ──────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) {
      const timer = setTimeout(() => mapRef.current?.resize(), 350);
      return () => clearTimeout(timer);
    }
  }, [isRightPanelOpen]);

  // ── Fly to selected incident ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !selectedIncident) return;
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];
    mapRef.current.flyTo({
      center: selectedIncident.location.coordinates,
      zoom: 16,
      essential: true,
      duration: 1500,
    });
  }, [selectedIncident]);

  // ── Render spiderified markers ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];

    if (incidents.length === 0) return;

    const spiderified = applySpiderifyJitter(incidents);

    spiderified.forEach((inc) => {
      const color = URGENCY_COLORS[inc.urgency] || '#71717a';
      const isSelected = selectedIncident?.id === inc.id;
      const size = isSelected ? 36 : 28;

      const el = document.createElement('div');
      el.style.cssText = `
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        color: white;
        font-weight: 900;
        font-size: ${isSelected ? 14 : 11}px;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 2px solid rgba(255,255,255,0.4);
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        transition: transform 0.2s;
        ${isSelected ? 'transform: scale(1.25); z-index: 10;' : ''}
      `;
      el.innerText = inc.type[0] || '!';

      // Urgency pulse for critical
      if (inc.urgency === 'CRITICAL') {
        const ping = document.createElement('div');
        ping.style.cssText = `position: absolute; width: ${size}px; height: ${size}px; border-radius: 50%; background: ${color}; opacity: 0.4; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;`;
        el.style.position = 'relative';
        el.appendChild(ping);
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(inc.displayCoords)
        .addTo(map);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectRef.current(inc);
        map.flyTo({ center: inc.displayCoords, zoom: 16, essential: true });
      });

      // Popup
      const urgencyColor = URGENCY_COLORS[inc.urgency] || '#71717a';
      const popupHtml = `
        <div style="padding: 10px; font-family: system-ui, sans-serif; background: rgba(24,24,27,0.95); backdrop-filter: blur(12px); border: 1px solid rgba(39,39,42,0.4); border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); color: white; max-width: 260px; font-size: 12px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <span style="font-weight: 700;">${escapeHtml(inc.type)}</span>
            <span style="font-size: 10px; padding: 2px 6px; border-radius: 9999px; font-weight: 700; background: ${urgencyColor}22; color: ${urgencyColor}; border: 1px solid ${urgencyColor}44;">${escapeHtml(inc.urgency)}</span>
          </div>
          <p style="color: #a1a1aa; margin: 0; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(inc.condition)}</p>
          <p style="color: #71717a; margin: 4px 0 0; font-size: 10px;">${escapeHtml(inc.location.landmarkText)}</p>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 20, closeButton: false, maxWidth: '280px' })
        .setHTML(popupHtml);

      marker.setPopup(popup);
      markersRef.current.push(marker);
      popupsRef.current.push(popup);
    });
  }, [incidents, selectedIncident]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <p style={{ fontSize: '12px', color: '#d4d4d8', fontWeight: 500, margin: 0 }}>
          {incidents.length} Active Incident{incidents.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
};

export default DispatcherMap;
