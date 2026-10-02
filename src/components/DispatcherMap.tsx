'use client';

import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { IncidentReport } from '../types/incident';

// ── Dark basemap (OSM raster with dark CSS filter) ─────────────────────────
// CartoDB dark tiles now require API key; using free OSM tiles with filter
const DARK_STYLE = {
  version: 8 as const,
  sources: {
    'osm': {
      type: 'raster' as const,
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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

// ── Spiderification ─────────────────────────────────────────────────────────

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
    const angle = count * (Math.PI / 4);
    const radius = 0.00035 * Math.ceil((count + 1) / 8);

    return {
      ...inc,
      displayCoords: [
        rawLng + radius * Math.cos(angle),
        rawLat + radius * Math.sin(angle),
      ] as [number, number],
    };
  });
}

// ── Urgency colors — exactly the four design-system accents ────────────────
// Same rule as every other surface: red = act, amber = wait, emerald = done.
// CRITICAL and HIGH are both red; CRITICAL is told apart by its pulse.

const URGENCY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
};

const ACCURACY_COLOR = (accuracy: number): string =>
  accuracy >= 90 ? '#10b981' : accuracy >= 70 ? '#f59e0b' : '#ef4444';

const TYPE_ICONS: Record<string, string> = {
  MEDICAL: '🏥',
  ACCIDENT: '🚗',
  FIRE: '🔥',
  VIOLENCE: '⚠️',
  NATURAL_DISASTER: '🌪️',
};

// Shared popup chrome: solid near-black card, hairline border, 12px radius.
// No backdrop blur — legibility over the map matters more than glass.
const POPUP_STYLE = [
  'background:#0b0b0f',
  'border:1px solid rgba(255,255,255,0.14)',
  'border-radius:12px',
  'box-shadow:0 12px 32px rgba(0,0,0,0.55)',
  'color:#f4f4f5',
  'max-width:300px',
  'font-family:Inter,ui-sans-serif,system-ui,sans-serif',
  'font-size:12px',
  'line-height:1.45',
  'overflow:hidden',
].join(';');

// ── Component ───────────────────────────────────────────────────────────────

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

  // ── Initialize Map ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: DARK_STYLE as any,
      center: [121.7740, 12.8797],
      zoom: 6,
      pitch: 0,
      bearing: 0,
      maxZoom: 20,
      attributionControl: false,
    });

    // Attribution bottom-right
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    );

    // Navigation top-right
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.resize();
      // Dark filter for OSM tiles — creates command-center aesthetic
      const canvas = mapContainer.current?.querySelector('canvas');
      if (canvas) {
        canvas.style.filter = 'brightness(0.5) contrast(1.15) saturate(0.55)';
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

  // ── ResizeObserver ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current) return;
    const observer = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    observer.observe(mapContainer.current);
    return () => observer.disconnect();
  }, []);

  // ── Panel toggle resize ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    const timer = setTimeout(() => mapRef.current?.resize(), 350);
    return () => clearTimeout(timer);
  }, [isRightPanelOpen]);

  // ── Fly to selected incident ───────────────────────────────────────────
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

  // ── Render markers ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;

    // Clear existing
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];

    if (incidents.length === 0) return;

    const spiderified = applySpiderifyJitter(incidents);

    spiderified.forEach((inc, idx) => {
      const color = URGENCY_COLORS[inc.urgency] || '#8e8e99';
      const isSelected = selectedIncident?.id === inc.id;
      const isCritical = inc.urgency === 'CRITICAL';
      const size = isSelected ? 36 : 28;
      const accuracy = inc.location?.confidenceScore ?? 85;
      const accColor = ACCURACY_COLOR(accuracy);

      // ── Beacon pin element ──
      const el = document.createElement('div');
      el.style.cssText = `
        position: relative;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${size}px;
        height: ${size}px;
        transition: transform 0.2s ease;
        animation: pin-drop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 30}ms both;
        ${isSelected ? 'transform: scale(1.3); z-index: 10;' : ''}
      `;

      // Outer beacon ring
      const ring = document.createElement('div');
      ring.style.cssText = `
        position: absolute;
        inset: 0;
        border-radius: 50%;
        border: 2px solid ${color};
        background: rgba(9, 9, 11, 0.55);
        opacity: ${isCritical ? '0.75' : '0.4'};
        ${isCritical ? 'animation: pulse-ring 1.5s ease-in-out infinite;' : ''}
      `;
      el.appendChild(ring);

      // Inner filled circle
      const circle = document.createElement('div');
      circle.style.cssText = `
        position: relative;
        width: ${size * 0.62}px;
        height: ${size * 0.62}px;
        border-radius: 50%;
        background: ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.55);
        z-index: 1;
      `;
      circle.style.fontSize = `${isSelected ? 14 : 12}px`;
      circle.innerHTML = TYPE_ICONS[inc.type] || '📋';
      el.appendChild(circle);

      // Critical pulse indicator
      if (isCritical && !isSelected) {
        const pulse = document.createElement('div');
        pulse.style.cssText = `
          position: absolute;
          top: -2px; right: -2px;
          width: 10px; height: 10px;
          border-radius: 50%;
          background: #ef4444;
          border: 2px solid #09090b;
          z-index: 2;
          animation: pulse-ring 1s ease-in-out infinite;
        `;
        el.appendChild(pulse);
      }

      // GPS accuracy indicator (small dot)
      const accDot = document.createElement('div');
      accDot.style.cssText = `
        position: absolute;
        bottom: -2px; left: 50%;
        transform: translateX(-50%);
        width: 6px; height: 6px;
        border-radius: 50%;
        background: ${accColor};
        border: 1.5px solid #09090b;
        z-index: 2;
      `;
      accDot.title = `GPS Accuracy: ${accuracy}%`;
      el.appendChild(accDot);

      // ── Marker ──
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(inc.displayCoords)
        .addTo(map);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectRef.current(inc);
        map.flyTo({ center: inc.displayCoords, zoom: 16, essential: true, duration: 800 });
      });

      // ── Popup ──
      const chipStyle = isCritical
        ? 'background:#ef4444; color:#ffffff; border:1px solid #ef4444;'
        : `background:${color}24; color:${color}; border:1px solid ${color}59;`;
      const popupHtml = `
        <div style="${POPUP_STYLE}">
          <div style="display:flex; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.08);">
            <span style="font-size:16px; line-height:1;">${TYPE_ICONS[inc.type] || '📋'}</span>
            <div style="flex:1; min-width:0;">
              <div style="font-weight:700; font-size:13px; color:#f4f4f5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(inc.type.replace('_', ' '))}</div>
              <div style="font-size:11px; color:#8e8e99; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(inc.location.landmarkText)}</div>
            </div>
            <span style="
              flex:none;
              font-size:11px;
              font-weight:700;
              letter-spacing:0.07em;
              padding:2px 8px;
              border-radius:999px;
              white-space:nowrap;
              ${chipStyle}
            ">${escapeHtml(inc.urgency)}</span>
          </div>
          <p style="margin:0; padding:10px 12px 0; color:#c8c8d1; font-size:12px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
            ${escapeHtml(inc.condition)}
          </p>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:10px 12px; margin-top:8px; border-top:1px solid rgba(255,255,255,0.08);">
            <span style="font-size:11px; color:#8e8e99;">👥 ${inc.peopleCount}</span>
            <span style="font-size:11px; color:#8e8e99; font-family:'JetBrains Mono',ui-monospace,monospace; font-variant-numeric:tabular-nums;">${inc.location.coordinates[1].toFixed(5)}, ${inc.location.coordinates[0].toFixed(5)}</span>
            <span style="font-size:11px; font-weight:700; letter-spacing:0.05em; margin-left:auto; color:${accColor};">GPS ${accuracy}%</span>
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 20, closeButton: false, maxWidth: '300px' })
        .setHTML(popupHtml);

      marker.setPopup(popup);
      markersRef.current.push(marker);
      popupsRef.current.push(popup);
    });
  }, [incidents, selectedIncident]); // eslint-disable-line react-hooks/exhaustive-deps

  const criticalCount = incidents.filter((i) => i.urgency === 'CRITICAL').length;

  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-0">
      <div ref={mapContainer} className="h-full w-full" />

      {/* Floating tally — bottom-left, clear of the filter bar (top-left)
          and the attribution cluster (bottom-right). */}
      <div className="pointer-events-none absolute bottom-12 left-3 z-10 rounded-xl border border-white/15 bg-surface-1/90 px-3 py-2 shadow-[0_6px_24px_rgba(0,0,0,0.5)] backdrop-blur-sm">
        <p className="data-label data-label-tight m-0">Incidents</p>
        <p className="readout mt-0.5 text-lg leading-none">
          {String(incidents.length).padStart(2, '0')}
        </p>
        {criticalCount > 0 && (
          <p className="mono mt-1.5 flex items-center gap-1.5 border-t border-white/10 pt-1.5 text-[11px] font-semibold text-critical">
            <span className="status-dot status-dot-off live-dot" aria-hidden="true" />
            {criticalCount} CRITICAL
          </p>
        )}
      </div>
    </div>
  );
};

export default DispatcherMap;
