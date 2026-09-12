// backend/src/index.ts

import express from 'express';
import cors from 'cors';
import { incidents } from './data/incidents';
import { Incident, ApiResponse } from './types/Incident';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// GET /api/incidents - Fetch all incidents
app.get('/api/incidents', (_req, res) => {
  const response: ApiResponse<Incident[]> = {
    success: true,
    data: incidents,
  };
  res.json(response);
});

// GET /api/incidents/:id - Fetch single incident
app.get('/api/incidents/:id', (req, res) => {
  const incident = incidents.find(i => i.id === req.params.id);
  if (!incident) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Incident not found',
    };
    return res.status(404).json(response);
  }
  const response: ApiResponse<Incident> = {
    success: true,
    data: incident,
  };
  res.json(response);
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 AgapAI Backend running on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api/incidents`);
});
