'use client';

import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { IncidentReport } from '@/types/incident';

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

  // Keep callback ref fresh
  onSelectRef.current = onSelectIncident;

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    // Calculate center from incidents or use Philippines default
    let center: [number, number] = [121.7740, 12.8797];
    let zoom = 6;

    if (incidents.length > 0) {
      const avgLng = incidents.reduce((s, i) => s + i.location.coordinates[0], 0) / incidents.length;
      const avgLat = incidents.reduce((s, i) => s + i.location.coordinates[1], 0) / incidents.length;
      center = [avgLng, avgLat];
      zoom = incidents.length === 1 ? 15 : 13;
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: FREE_OSM_STYLE as any,
      center,
      zoom,
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

  // ResizeObserver for reliable container resize
  useEffect(() => {
    if (!mapContainer.current) return;
    const container = mapContainer.current;
    const observer = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Recalculate canvas viewport whenever the right drawer opens/closes
  useEffect(() => {
    if (mapRef.current) {
      const timer = setTimeout(() => {
        mapRef.current?.resize();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isRightPanelOpen]);

  // Fly to selected incident
  useEffect(() => {
    if (!mapRef.current || !selectedIncident) return;

    // Close all popups
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];

    mapRef.current.flyTo({
      center: selectedIncident.location.coordinates,
      zoom: 16,
      essential: true,
      duration: 1500,
    });
  }, [selectedIncident]);

  // Render Markers & Cluster Popups
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];

    if (incidents.length === 0) return;

    // Group incidents sharing exact or near coordinates (within ~50m / 0.00045°)
    const CLUSTER_RADIUS = 0.00045;
    const groups: IncidentReport[][] = [];
    const assigned = new Set<string>();

    for (const inc of incidents) {
      if (assigned.has(inc.id)) continue;
      const group: IncidentReport[] = [inc];
      assigned.add(inc.id);

      for (const other of incidents) {
        if (assigned.has(other.id)) continue;
        if (
          Math.abs(inc.location.coordinates[0] - other.location.coordinates[0]) < CLUSTER_RADIUS &&
          Math.abs(inc.location.coordinates[1] - other.location.coordinates[1]) < CLUSTER_RADIUS
        ) {
          group.push(other);
          assigned.add(other.id);
        }
      }
      groups.push(group);
    }

    for (const group of groups) {
      const isCluster = group.length > 1;
      const primary = group[0];
      const hasCritical = group.some((i) => i.urgency === 'CRITICAL');

      const el = document.createElement('div');
      el.style.cssText = `
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        color: white;
        font-weight: 900;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        border: 2px solid rgba(255,255,255,0.3);
        transition: transform 0.2s;
      `;
      el.style.backgroundColor = hasCritical ? '#EF4444' : isCluster ? '#F97316' : '#3b82f6';
      el.style.width = isCluster ? '40px' : '30px';
      el.style.height = isCluster ? '40px' : '30px';
      el.style.fontSize = isCluster ? '15px' : '13px';
      el.innerText = isCluster ? `${group.length}` : '!';

      // Highlight if selected
      if (selectedIncident?.id === primary.id) {
        el.style.transform = 'scale(1.3)';
        el.style.zIndex = '10';
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(primary.location.coordinates)
        .addTo(map);

      // Create Popup
      const popupContainer = document.createElement('div');
      popupContainer.style.cssText = `
        font-family: system-ui, sans-serif;
        background: rgba(24,24,27,0.95);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(39,39,42,0.4);
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        color: white;
        padding: 12px;
        max-width: 320px;
        font-size: 12px;
        overflow: hidden;
      `;

      const title = document.createElement('div');
      title.style.cssText = 'font-weight: 700; padding-bottom: 8px; border-bottom: 1px solid #27272a; font-size: 13px;';
      title.innerText = isCluster ? `${group.length} incidents at this location` : primary.type;
      popupContainer.appendChild(title);

      if (isCluster) {
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size: 10px; color: #71717a; margin-top: 4px; text-align: right;';
        hint.innerText = 'Click item to open';
        popupContainer.appendChild(hint);
      }

      const listContainer = document.createElement('div');
      listContainer.style.cssText = isCluster ? 'max-height: 250px; overflow-y: auto;' : '';

      group.forEach((item) => {
        const itemRow = document.createElement('div');
        itemRow.style.cssText = `
          padding: 8px;
          border-bottom: 1px solid #27272a;
          cursor: pointer;
          transition: background 0.15s;
          border-radius: 6px;
          margin-top: 4px;
        `;
        itemRow.onmouseover = () => { itemRow.style.background = 'rgba(63,63,70,0.3)'; };
        itemRow.onmouseout = () => { itemRow.style.background = 'transparent'; };

        const urgencyColor = item.urgency === 'CRITICAL' ? '#ef4444'
          : item.urgency === 'HIGH' ? '#f97316'
          : item.urgency === 'MEDIUM' ? '#eab308'
          : '#22c55e';

        itemRow.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-weight: 600; color: #fafafa;">${escapeHtml(item.type)}</span>
            <span style="font-size: 10px; color: ${urgencyColor}; font-weight: 700; text-transform: uppercase;">${escapeHtml(item.urgency)}</span>
          </div>
          <p style="color: #a1a1aa; margin: 4px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; font-size: 11px;">
            ${escapeHtml(item.condition || item.location.landmarkText)}
          </p>
        `;

        // Stop propagation to prevent MapLibre from closing popup before state update
        itemRow.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectRef.current(item);
          map.flyTo({
            center: item.location.coordinates,
            zoom: 16,
            essential: true,
          });
        });

        listContainer.appendChild(itemRow);
      });

      popupContainer.appendChild(listContainer);

      const popup = new maplibregl.Popup({ offset: 25, closeButton: true, closeOnClick: false })
        .setDOMContent(popupContainer);

      marker.setPopup(popup);
      markersRef.current.push(marker);
      popupsRef.current.push(popup);
    }
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
