// server/src/routes/incidents.ts

import { Router, Request, Response } from 'express';
import {
  getAllIncidents,
  getIncidentById,
  createIncident,
  updateIncidentStatus,
  findNearbyIncidents
} from '../db/pool';
import { Server } from 'socket.io';

// ==========================================
// EXPRESS ROUTER WITH SOCKET.IO REFERENCE
// ==========================================

export function createIncidentRoutes(io: Server): Router {
  const router = Router();

  // ==========================================
  // GET /api/incidents
  // Fetch all incidents with coordinate extraction
  // ==========================================
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const incidents = await getAllIncidents();
      res.json({ success: true, data: incidents });
    } catch (error) {
      console.error('[API] GET /incidents error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch incidents' });
    }
  });

  // ==========================================
  // GET /api/incidents/:id
  // Fetch single incident by ID
  // ==========================================
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const incident = await getIncidentById(id);
      if (!incident) {
        res.status(404).json({ success: false, error: 'Incident not found' });
        return;
      }
      res.json({ success: true, data: incident });
    } catch (error) {
      console.error('[API] GET /incidents/:id error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch incident' });
    }
  });

  // ==========================================
  // GET /api/incidents/nearby
  // Find incidents within radius
  // ==========================================
  router.get('/nearby/:lng/:lat', async (req: Request, res: Response) => {
    try {
      const lng = parseFloat(req.params.lng as string);
      const lat = parseFloat(req.params.lat as string);
      const radius = parseInt(req.query.radius as string) || 1000;

      if (isNaN(lng) || isNaN(lat)) {
        res.status(400).json({ success: false, error: 'Invalid coordinates' });
        return;
      }

      const incidents = await findNearbyIncidents(lng, lat, radius);
      res.json({ success: true, data: incidents });
    } catch (error) {
      console.error('[API] GET /incidents/nearby error:', error);
      res.status(500).json({ success: false, error: 'Failed to find nearby incidents' });
    }
  });

  // ==========================================
  // POST /api/incidents
  // Create new incident
  // ==========================================
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { type, location, description, reporter, coordinates } = req.body;

      if (!type || !location || !coordinates?.lng || !coordinates?.lat) {
        res.status(400).json({ success: false, error: 'Missing required fields' });
        return;
      }

      const incident = await createIncident(
        type,
        location,
        description || '',
        reporter || 'Anonymous',
        coordinates.lng,
        coordinates.lat
      );

      // Broadcast to all connected clients
      io.emit('new_incident_received', incident);

      res.status(201).json({ success: true, data: incident });
    } catch (error) {
      console.error('[API] POST /incidents error:', error);
      res.status(500).json({ success: false, error: 'Failed to create incident' });
    }
  });

  // ==========================================
  // PATCH /api/incidents/:id/status
  // Update incident status with WebSocket broadcast
  // ==========================================
  router.patch('/:id/status', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const { status } = req.body;

      if (!status || !['PENDING', 'DISPATCHED', 'RESOLVED'].includes(status)) {
        res.status(400).json({ success: false, error: 'Invalid status. Must be PENDING, DISPATCHED, or RESOLVED' });
        return;
      }

      const updated = await updateIncidentStatus(id, status);

      if (!updated) {
        res.status(404).json({ success: false, error: 'Incident not found' });
        return;
      }

      // Broadcast update to all connected clients
      io.emit('incident_updated', updated);

      console.log(`[API] Incident ${updated.id} status updated to ${status}`);

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('[API] PATCH /incidents/:id/status error:', error);
      res.status(500).json({ success: false, error: 'Failed to update incident status' });
    }
  });

  return router;
}
