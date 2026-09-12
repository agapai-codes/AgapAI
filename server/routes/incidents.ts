// server/routes/incidents.ts

import { Router, Request, Response } from 'express';

export interface Incident {
  id: string;
  type: 'FIRE' | 'ACCIDENT' | 'MEDICAL' | 'DISASTER';
  location: string;
  coordinates: { lng: number; lat: number };
  status: 'PENDING' | 'DISPATCHED' | 'RESOLVED';
  timestamp: string;
}

const incidents: Incident[] = [
  { id: 'INC-001', type: 'FIRE', location: 'V. Carral St, Poblacion, Iligan City', coordinates: { lng: 124.2478, lat: 8.2312 }, status: 'PENDING', timestamp: new Date(Date.now() - 120000).toISOString() },
  { id: 'INC-002', type: 'MEDICAL', location: 'Buru-un, Iligan City', coordinates: { lng: 124.2389, lat: 8.2156 }, status: 'PENDING', timestamp: new Date(Date.now() - 300000).toISOString() },
  { id: 'INC-003', type: 'ACCIDENT', location: 'MSU-IIT Engineering, Iligan City', coordinates: { lng: 124.2452, lat: 8.2280 }, status: 'DISPATCHED', timestamp: new Date(Date.now() - 600000).toISOString() },
  { id: 'INC-004', type: 'DISASTER', location: 'Brgy. Pala-o, Iligan City', coordinates: { lng: 124.2398, lat: 8.2345 }, status: 'PENDING', timestamp: new Date(Date.now() - 900000).toISOString() },
  { id: 'INC-005', type: 'FIRE', location: 'Sabayle St, Tibanga, Iligan City', coordinates: { lng: 124.2534, lat: 8.2267 }, status: 'DISPATCHED', timestamp: new Date(Date.now() - 1200000).toISOString() },
  { id: 'INC-006', type: 'MEDICAL', location: 'Saduc Road, Tubod, Iligan City', coordinates: { lng: 124.2512, lat: 8.2198 }, status: 'RESOLVED', timestamp: new Date(Date.now() - 1800000).toISOString() },
  { id: 'INC-007', type: 'ACCIDENT', location: 'Maria Cristina Bridge, Iligan City', coordinates: { lng: 124.2298, lat: 8.2134 }, status: 'PENDING', timestamp: new Date(Date.now() - 60000).toISOString() },
  { id: 'INC-008', type: 'DISASTER', location: 'Tibanga Public Market, Iligan City', coordinates: { lng: 124.2501, lat: 8.2245 }, status: 'DISPATCHED', timestamp: new Date(Date.now() - 450000).toISOString() },
];

const VALID_STATUSES = ['PENDING', 'DISPATCHED', 'RESOLVED'] as const;

const router = Router();

// GET /api/incidents - Fetch all incidents
router.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, data: incidents });
});

// GET /api/incidents/:id - Fetch single incident
router.get('/:id', (req: Request, res: Response) => {
  const incident = incidents.find(i => i.id === req.params.id);
  if (!incident) {
    res.status(404).json({ success: false, error: 'Incident not found' });
    return;
  }
  res.json({ success: true, data: incident });
});

// PATCH /api/incidents/:id/status - Update incident status
router.patch('/:id/status', (req: Request, res: Response) => {
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    res.status(400).json({
      success: false,
      error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
    });
    return;
  }

  const incidentIndex = incidents.findIndex(i => i.id === req.params.id);
  if (incidentIndex === -1) {
    res.status(404).json({ success: false, error: 'Incident not found' });
    return;
  }

  incidents[incidentIndex].status = status;
  incidents[incidentIndex].timestamp = new Date().toISOString();

  res.json({ success: true, data: incidents[incidentIndex] });
});

export default router;
