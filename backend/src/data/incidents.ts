// backend/src/data/incidents.ts

import { Incident } from '../types/Incident';

export const incidents: Incident[] = [
  {
    id: 'INC-001',
    type: 'FIRE',
    location: 'V. Carral St, Poblacion, Iligan City',
    coordinates: { lng: 124.2478, lat: 8.2312 },
    status: 'PENDING',
    timestamp: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'INC-002',
    type: 'MEDICAL',
    location: 'Buru-un, Iligan City',
    coordinates: { lng: 124.2389, lat: 8.2156 },
    status: 'PENDING',
    timestamp: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: 'INC-003',
    type: 'ACCIDENT',
    location: 'MSU-IIT Engineering, Tibanga, Iligan City',
    coordinates: { lng: 124.2452, lat: 8.2280 },
    status: 'DISPATCHED',
    timestamp: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 'INC-004',
    type: 'DISASTER',
    location: 'Brgy. Pala-o, Iligan City',
    coordinates: { lng: 124.2398, lat: 8.2345 },
    status: 'PENDING',
    timestamp: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: 'INC-005',
    type: 'FIRE',
    location: 'Sabayle St, Tibanga Highway, Iligan City',
    coordinates: { lng: 124.2534, lat: 8.2267 },
    status: 'DISPATCHED',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
  },
  {
    id: 'INC-006',
    type: 'MEDICAL',
    location: 'Saduc Road, Tubod, Iligan City',
    coordinates: { lng: 124.2512, lat: 8.2198 },
    status: 'RESOLVED',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'INC-007',
    type: 'ACCIDENT',
    location: 'Maria Cristina Bridge, Iligan City',
    coordinates: { lng: 124.2298, lat: 8.2134 },
    status: 'PENDING',
    timestamp: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: 'INC-008',
    type: 'DISASTER',
    location: 'Tibanga Public Market, Iligan City',
    coordinates: { lng: 124.2501, lat: 8.2245 },
    status: 'DISPATCHED',
    timestamp: new Date(Date.now() - 450000).toISOString(),
  },
];
