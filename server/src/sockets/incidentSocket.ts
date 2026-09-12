// server/src/sockets/incidentSocket.ts

import { Server, Socket } from 'socket.io';
import { createIncident, getAllIncidents } from '../db/pool';

// ==========================================
// SOCKET.IO EVENT HANDLERS
// ==========================================

export function setupIncidentSocket(io: Server): void {
  console.log('[SOCKET] WebSocket server initialized');

  io.on('connection', (socket: Socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);

    // Send current incidents on connection
    getAllIncidents()
      .then(incidents => {
        socket.emit('initial_incidents', incidents);
      })
      .catch(err => {
        console.error('[SOCKET] Failed to load initial incidents:', err);
      });

    // ==========================================
    // REPORT_EMERGENCY - Citizen submits new incident
    // ==========================================
    socket.on('report_emergency', async (payload: {
      type: string;
      location: string;
      description: string;
      reporter: string;
      coordinates: { lng: number; lat: number };
    }) => {
      try {
        const { type, location, description, reporter, coordinates } = payload;

        // Validate required fields
        if (!type || !location || !coordinates?.lng || !coordinates?.lat) {
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }

        // Create incident in database
        const created = await createIncident(
          type,
          location,
          description || 'No description provided',
          reporter || 'Anonymous',
          coordinates.lng,
          coordinates.lat
        );

        console.log(`[SOCKET] New incident created: ${created.id} - ${created.type}`);

        // Broadcast to all connected clients
        io.emit('new_incident_received', created);

        // Send confirmation to sender
        socket.emit('incident_created', created);

      } catch (error) {
        console.error('[SOCKET] Error creating incident:', error);
        socket.emit('error', { message: 'Failed to create incident' });
      }
    });

    // ==========================================
    // DISCONNECT
    // ==========================================
    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET] Client disconnected: ${socket.id} (${reason})`);
    });
  });
}
