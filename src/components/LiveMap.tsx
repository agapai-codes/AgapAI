'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Incident } from '../types/incident';

interface LiveMapProps {
  incidents: Incident[];
  activeIncident: Incident | null;
  onIncidentClick: (incident: Incident) => void;
}

const FREE_OSM_STYLE = {
  version: 8 as const,
  sources: {
    'osm': {
      type: 'raster' as const,
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 18,
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  },
  layers: [
    {
      id: 'osm-layer',
      type: 'raster' as const,
      source: 'osm',
      minzoom: 0,
      maxzoom: 24
    }
  ]
};

const INCIDENT_COLORS: Record<string, string> = {
  FIRE: '#ef4444',
  ACCIDENT: '#f97316',
  MEDICAL: '#3b82f6',
  DISASTER: '#a855f7',
};

const STATUS_ICONS: Record<string, string> = {
  PENDING: '⏳',
  DISPATCHED: '🚑',
  RESOLVED: '✅',
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}

export default function LiveMap({ incidents, activeIncident, onIncidentClick }: { incidents: Incident[]; activeIncident: Incident | null; onIncidentClick: (incident: Incident) => void }) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const createMarkerElement = useCallback((incident: Incident) => {
    const color = INCIDENT_COLORS[incident.type] || '#71717a';
    const icon = STATUS_ICONS[incident.status] || '📋';
    const isPending = incident.status === 'PENDING';

    const el = document.createElement('div');
    el.style.cssText = 'position: relative; cursor: pointer; width: 28px; height: 28px;';

    if (isPending) {
      const ping = document.createElement('div');
      ping.style.cssText = `position: absolute; width: 28px; height: 28px; border-radius: 50%; background: ${color}; opacity: 0.4; top: 0; left: 0;`;
      ping.className = 'sonar-ping';
      el.appendChild(ping);
    }

    const marker = document.createElement('div');
    marker.style.cssText = `width: 28px; height: 28px; border-radius: 6px; background: ${color}; border: 2px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); position: relative; z-index: 1;`;
    marker.innerHTML = icon;
    el.appendChild(marker);

    return el;
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: FREE_OSM_STYLE as any,
      center: [124.2452, 8.2280],
      zoom: 13,
      pitch: 30,
      bearing: 0,
      maxZoom: 20,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      setTimeout(() => map.resize(), 100);

      // Apply dark filter to map canvas
      const canvas = mapContainer.current?.querySelector('canvas');
      if (canvas) {
        canvas.style.filter = 'brightness(0.5) contrast(1.3) saturate(0.7) sepia(0.3)';
      }

      incidents.forEach(incident => {
        const el = createMarkerElement(incident);

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false, maxWidth: '280px' }).setHTML(`
          <div style="padding: 12px; font-family: system-ui, sans-serif; background: rgba(24,24,27,0.95); backdrop-filter: blur(12px); border: 1px solid rgba(39,39,42,0.4); border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <span style="font-size: 18px;">${STATUS_ICONS[incident.status]}</span>
                <div>
                  <div style="font-weight: 600; font-size: 14px; color: #fafafa;">${escapeHtml(incident.type)}</div>
                  <div style="font-size: 12px; color: #a1a1aa;">${escapeHtml(incident.location)}</div>
                </div>
              </div>
            <div style="display: flex; gap: 6px; margin-bottom: 10px;">
              <span style="padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: ${INCIDENT_COLORS[incident.type]}22; color: ${INCIDENT_COLORS[incident.type]}; border: 1px solid ${INCIDENT_COLORS[incident.type]}44;">${incident.type}</span>
              <span style="padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: #27272a; color: #a1a1aa; border: 1px solid #3f3f46;">${incident.status}</span>
            </div>
            <div style="font-size: 12px; color: #71717a;">${new Date(incident.timestamp).toLocaleTimeString()}</div>
          </div>
        `);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([incident.coordinates.lng, incident.coordinates.lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener('click', () => onIncidentClick(incident));
        markersRef.current.push(marker);
      });

      if (incidents.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        incidents.forEach(inc => bounds.extend([inc.coordinates.lng, inc.coordinates.lat]));
        map.fitBounds(bounds, { padding: 50, duration: 1500 });
      }
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

  useEffect(() => {
    if (!mapRef.current || !activeIncident) return;
    mapRef.current.flyTo({ center: [activeIncident.coordinates.lng, activeIncident.coordinates.lat], zoom: 15, pitch: 30, duration: 1500 });
    markersRef.current.forEach(marker => {
      const lngLat = marker.getLngLat();
      if (lngLat.lng === activeIncident.coordinates.lng && lngLat.lat === activeIncident.coordinates.lat) {
        marker.togglePopup();
      }
    });
  }, [activeIncident]);

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
