'use client';

import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });

      // CartoDB Dark Matter tiles for 911 dispatch look
      const map = L.map(mapRef.current!, {
        center: [8.2280, 124.2452],
        zoom: 13,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // Add zoom control to top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      mapInstanceRef.current = map;
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const loadMarkers = async () => {
      const L = (await import('leaflet')).default;
      const map = mapInstanceRef.current;

      markersRef.current.forEach((marker: any) => marker.remove());
      markersRef.current = [];

      const urgencyColors: Record<string, string> = {
        critical: '#EF4444',
        high: '#F97316',
        medium: '#EAB308',
        low: '#22C55E',
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
          const size = isSelected ? 32 : 24;
          const pulseClass = report.urgency === 'critical' ? 'marker-pulse' : '';

          const icon = L.divIcon({
            html: `
              <div class="${pulseClass}" style="
                width: ${size}px; 
                height: ${size}px; 
                background: ${color}; 
                border-radius: 50%; 
                border: 3px solid ${isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.3)'};
                box-shadow: 0 0 ${isSelected ? '20px' : '10px'} ${color}66;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: ${isSelected ? '14px' : '10px'};
                transition: all 0.2s ease;
              ">
                ${statusIcons[report.status] || ''}
              </div>
            `,
            className: 'custom-marker',
            iconSize: [size, size],
            iconAnchor: [size/2, size/2],
          });

          const marker = L.marker([report.latitude, report.longitude], { icon })
            .addTo(map)
            .bindPopup(`
              <div style="min-width: 180px; font-family: Inter, sans-serif;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <span style="font-size: 16px;">
                    ${report.incident_type === 'medical' ? '🏥' :
                     report.incident_type === 'fire' ? '🔥' :
                     report.incident_type === 'accident' ? '🚗' :
                     report.incident_type === 'disaster' ? '🌪️' : '📋'}
                  </span>
                  <div>
                    <div style="font-weight: 600; text-transform: capitalize;">${report.incident_type.replace('_', ' ')}</div>
                    <div style="font-size: 11px; color: #9CA3AF;">${report.location_description}</div>
                  </div>
                </div>
                <div style="display: flex; gap: 6px; margin-bottom: 8px;">
                  <span style="
                    padding: 2px 8px; 
                    border-radius: 4px; 
                    font-size: 10px; 
                    font-weight: 600;
                    background: ${color}22;
                    color: ${color};
                    border: 1px solid ${color}44;
                  ">
                    ${report.urgency.toUpperCase()}
                  </span>
                  <span style="
                    padding: 2px 8px; 
                    border-radius: 4px; 
                    font-size: 10px; 
                    background: #1F2937;
                    color: #9CA3AF;
                    border: 1px solid #374151;
                  ">
                    ${report.status}
                  </span>
                </div>
                <div style="font-size: 11px; color: #6B7280;">
                  👥 ${report.people_affected} affected • ${new Date(report.timestamp).toLocaleTimeString()}
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
  }, [reports, selectedReportId, onReportSelect]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-[#374151]">
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{ background: '#0A0E17' }}
      />
      {/* Map overlay info */}
      <div className="absolute top-2 left-2 bg-[#111827]/90 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-[#374151] z-[1000]">
        <p className="text-[10px] text-[#6B7280]">Iligan City, Philippines</p>
        <p className="text-xs font-medium">{reports.length} incidents</p>
      </div>
    </div>
  );
}
