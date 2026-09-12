// server/src/index.ts

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { checkDatabaseHealth } from './db/pool';
import { createIncidentRoutes } from './routes/incidents';
import { setupIncidentSocket } from './sockets/incidentSocket';

// ==========================================
// SERVER INITIALIZATION
// ==========================================

const app = express();
const httpServer = createServer(app);

// ==========================================
// SOCKET.IO CONFIGURATION
// ==========================================

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ==========================================
// EXPRESS MIDDLEWARE
// ==========================================

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ==========================================
// ROUTES
// ==========================================

app.use('/api/incidents', createIncidentRoutes(io));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ==========================================
// DATABASE INITIALIZATION
// ==========================================

async function initializeServer(): Promise<void> {
  console.log('[SYSTEM_CORE] Initializing AgapAI Backend...');

  // Check database connectivity
  const dbHealthy = await checkDatabaseHealth();

  if (dbHealthy) {
    console.log('[SYSTEM_CORE] ✅ Postgres + PostGIS telemetry database container locked and ready');
  } else {
    console.log('[SYSTEM_CORE] ⚠️ Database not available - running in mock mode');
  }

  // Setup Socket.io
  setupIncidentSocket(io);
  console.log('[SYSTEM_CORE] ✅ Socket.io WebSocket server initialized');

  // Start HTTP server
  const PORT = parseInt(process.env.PORT || '4000', 10);
  httpServer.listen(PORT, () => {
    console.log(`[SYSTEM_CORE] ✅ AgapAI Backend running on port ${PORT}`);
    console.log(`[SYSTEM_CORE] 📡 REST API: http://localhost:${PORT}/api/incidents`);
    console.log(`[SYSTEM_CORE] 🔌 WebSocket: ws://localhost:${PORT}`);
  });
}

// ==========================================
// START SERVER
// ==========================================

initializeServer().catch((error) => {
  console.error('[SYSTEM_CORE] ❌ Failed to initialize server:', error);
  process.exit(1);
});
