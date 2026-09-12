'use client';

import { useEffect, useRef, useState } from 'react';
import { EmergencyReport } from '@/lib/types';

interface MapViewProps {
  reports: EmergencyReport[];
  selectedReportId?: string;
  onReportSelect?: (id: string) => void;
}

export default function MapView({ reports, selectedReportId, onReportSelect }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      if (!mapRef.current || cancelled) return;
      
      // Check if container already has a Leaflet map (StrictMode double-mount)
      if ((mapRef.current as any)._leaflet_id) return;

      const L = (await import('leaflet')).default;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [8.2280, 124.2452],
        zoom: 13,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      if (!cancelled) {
        mapInstanceRef.current = map;
        setIsMapReady(true);
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current) return;

    const loadMarkers = async () => {
      const L = (await import('leaflet')).default;
      const map = mapInstanceRef.current;
      if (!map) return;

      markersRef.current.forEach((marker: any) => marker.remove());
      markersRef.current = [];

      const urgencyColors: Record<string, string> = {
        critical: '#DC2626',
        high: '#F59E0B',
        medium: '#3B82F6',
        low: '#10B981',
      };

      const statusIcons: Record<string, string> = {
        pending: '⏳',
        dispatched: '🚑',
        resolved: '✅',
      };

      reports.forEach(report => {
        if (report.latitude && report.longitude) {
          const color = urgencyColors[report.urgency] || '#6B7280';
          const isSelected = report.id === selectedReportId;
          const size = isSelected ? 28 : 20;
          const pulseClass = report.urgency === 'critical' ? 'marker-pulse' : '';

          const icon = L.divIcon({
            html: `
              <div class="${pulseClass}" style="
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                border-radius: 2px;
                border: 2px solid ${isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.3)'};
                box-shadow: 0 0 ${isSelected ? '15px' : '8px'} ${color}88;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${isSelected ? '12px' : '9px'};
              ">
                ${statusIcons[report.status] || ''}
              </div>
            `,
            className: 'custom-marker',
            iconSize: [size, size],
            iconAnchor: [size/2, size/2],
          });

          const escapeHtml = (str: string) => str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));

          const marker = L.marker([report.latitude, report.longitude], { icon })
            .addTo(map)
            .bindPopup(`
              <div style="min-width: 160px; font-family: monospace; font-size: 11px;">
                <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">
                  ${escapeHtml(report.incident_type.replace('_', ' '))}
                </div>
                <div style="color: #9CA3AF; margin-bottom: 4px;">
                  ${escapeHtml(report.location_description)}
                </div>
                <div style="display: flex; gap: 4px; margin-bottom: 4px;">
                  <span style="padding: 1px 4px; background: ${color}22; color: ${color}; border: 1px solid ${color}44; font-size: 9px; font-weight: bold;">
                    ${escapeHtml(report.urgency.toUpperCase())}
                  </span>
                </div>
                <div style="color: #6B7280; font-size: 10px;">
                  ${report.people_affected} affected
                </div>
              </div>
            `);

          marker.on('click', () => onReportSelect?.(report.id));
          markersRef.current.push(marker);
        }
      });

      if (markersRef.current.length > 0) {
        const group = L.featureGroup(markersRef.current);
        map.fitBounds(group.getBounds().pad(0.15));
      }
    };

    loadMarkers();
  }, [isMapReady, reports, selectedReportId, onReportSelect]);

  return (
    <div className="relative w-full h-full border border-[#1E3A5F]">
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{ background: '#080C14' }}
      />
      <div className="absolute top-2 left-2 bg-[#0F1520]/90 backdrop-blur-sm px-3 py-1.5 border border-[#1E3A5F] z-[1000]">
        <p className="text-[10px] text-[#6B7280] mono">ILIGAN CITY, PHILIPPINES</p>
        <p className="text-xs font-medium mono">{reports.length} INCIDENTS</p>
      </div>
    </div>
  );
}
