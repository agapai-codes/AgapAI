// src/hooks/useEmergencySocket.ts

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Incident } from '../types/incident';

// ==========================================
// SOCKET HOOK CONFIGURATION
// ==========================================

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

// ==========================================
// CUSTOM REACT HOOK
// ==========================================

export function useEmergencySocket() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [newIncidentFlash, setNewIncidentFlash] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // ==========================================
    // CONNECTION EVENTS
    // ==========================================
    socket.on('connect', () => {
      console.log('[SOCKET] Connected to AgapAI backend');
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[SOCKET] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[SOCKET] Connection error:', error.message);
      setIsConnected(false);
    });

    // ==========================================
    // DATA EVENTS
    // ==========================================

    // Initial incident load on connection
    socket.on('initial_incidents', (data: Incident[]) => {
      console.log('[SOCKET] Received initial incidents:', data.length);
      setIncidents(data);
    });

    // New incident from citizen app
    socket.on('new_incident_received', (incident: Incident) => {
      console.log('[SOCKET] New incident received:', incident.id);
      setIncidents(prev => [incident, ...prev]);
      setNewIncidentFlash(incident.id);
      setTimeout(() => setNewIncidentFlash(null), 3000);
    });

    // Incident status updated
    socket.on('incident_updated', (updated: Incident) => {
      console.log('[SOCKET] Incident updated:', updated.id, updated.status);
      setIncidents(prev =>
        prev.map(inc => inc.id === updated.id ? updated : inc)
      );
    });

    // Error handling
    socket.on('error', (data: { message: string }) => {
      console.error('[SOCKET] Server error:', data.message);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  // ==========================================
  // EMIT FUNCTIONS
  // ==========================================

  const reportEmergency = useCallback((data: {
    type: string;
    location: string;
    description: string;
    reporter: string;
    coordinates: { lng: number; lat: number };
  }) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('report_emergency', data);
    }
  }, []);

  const updateStatus = useCallback((id: string, status: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('update_status', { id, status });
    }
  }, []);

  return {
    incidents,
    isConnected,
    newIncidentFlash,
    reportEmergency,
    updateStatus,
    socket: socketRef.current,
  };
}
