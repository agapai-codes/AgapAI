// server/index.ts

import express from 'express';
import cors from 'cors';
import incidentRoutes from './routes/incidents';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api/incidents', incidentRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 AgapAI Backend running on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api/incidents`);
});
