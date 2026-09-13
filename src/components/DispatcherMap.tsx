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

// ── Urgency colors ──────────────────────────────────────────────────────────

const URGENCY_COLORS: Record<string, string> = {
  CRITICAL: '#b91c1c',
  HIGH: '#ef4444',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
};

const TYPE_ICONS: Record<string, string> = {
  MEDICAL: '🏥',
  ACCIDENT: '🚗',
  FIRE: '🔥',
  VIOLENCE: '⚠️',
  NATURAL_DISASTER: '🌪️',
};

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
        canvas.style.filter = 'brightness(0.55) contrast(1.15) saturate(0.6)';
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
      const color = URGENCY_COLORS[inc.urgency] || '#71717a';
      const isSelected = selectedIncident?.id === inc.id;
      const isHigh = inc.urgency === 'HIGH';
      const size = isSelected ? 40 : 32;

      // ── Pin element (rounded square) ──
      const el = document.createElement('div');
      el.style.cssText = `
        position: relative;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 2px solid rgba(255,255,255,0.3);
        box-shadow: 0 4px 20px rgba(0,0,0,0.6), 0 0 ${isHigh ? '24px' : '0px'} ${color}40;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        animation: pin-drop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${idx * 30}ms both;
        ${isSelected ? 'transform: scale(1.2); z-index: 10; box-shadow: 0 4px 24px rgba(0,0,0,0.7), 0 0 32px ' + color + '60;' : ''}
      `;
      el.style.fontSize = `${isSelected ? 18 : 14}px`;
      el.style.lineHeight = '1';
      el.innerHTML = TYPE_ICONS[inc.type] || '📋';

      // HIGH urgency glow ring
      if (isHigh && !isSelected) {
        const glow = document.createElement('div');
        glow.style.cssText = `
          position: absolute;
          inset: -4px;
          border-radius: 12px;
          border: 2px solid ${color}60;
          animation: pulse-ring 2s ease-in-out infinite;
          pointer-events: none;
        `;
        el.appendChild(glow);
      }

      // ── Marker ──
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(inc.displayCoords)
        .addTo(map);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectRef.current(inc);
        map.flyTo({ center: inc.displayCoords, zoom: 16, essential: true, duration: 800 });
      });

      // ── Popup (glass morphism) ──
      const urgColor = URGENCY_COLORS[inc.urgency] || '#71717a';
      const popupHtml = `
        <div style="
          padding: 12px;
          font-family: system-ui, -apple-system, sans-serif;
          background: rgba(9,9,11,0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(63,63,70,0.4);
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.6);
          color: #fafafa;
          max-width: 280px;
          font-size: 12px;
        ">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 18px;">${TYPE_ICONS[inc.type] || '📋'}</span>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 700; font-size: 13px; color: #fafafa;">${escapeHtml(inc.type.replace('_', ' '))}</div>
              <div style="font-size: 10px; color: #71717a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(inc.location.landmarkText)}</div>
            </div>
            <span style="
              font-size: 10px;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 9999px;
              background: ${urgColor}18;
              color: ${urgColor};
              border: 1px solid ${urgColor}30;
              white-space: nowrap;
            ">${escapeHtml(inc.urgency)}</span>
          </div>
          <p style="color: #d4d4d8; margin: 0; font-size: 12px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${escapeHtml(inc.condition)}
          </p>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(63,63,70,0.3);">
            <span style="font-size: 10px; color: #71717a;">👥 ${inc.peopleCount}</span>
            <span style="font-size: 10px; color: #71717a;">📍 ${inc.location.coordinates[1].toFixed(4)}, ${inc.location.coordinates[0].toFixed(4)}</span>
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

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#09090b' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Floating status indicator */}
      <div style={{
        position: 'absolute', top: '12px', left: '12px',
        background: 'rgba(9,9,11,0.8)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '10px 14px',
        borderRadius: '10px',
        border: '1px solid rgba(63,63,70,0.3)',
        zIndex: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}>
        <p style={{ fontSize: '9px', color: '#71717a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
          INCIDENTS
        </p>
        <p style={{ fontSize: '14px', color: '#fafafa', fontWeight: 800, margin: '2px 0 0', fontVariantNumeric: 'tabular-nums' }}>
          {incidents.length}
        </p>
      </div>
    </div>
  );
};

export default DispatcherMap;
