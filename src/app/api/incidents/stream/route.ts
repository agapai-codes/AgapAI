// src/app/api/incidents/stream/route.ts
// Server-Sent Events endpoint for real-time incident updates

import { NextRequest } from 'next/server';
import { getAllIncidents } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial data
      const send = async () => {
        try {
          const incidents = await getAllIncidents();
          const data = JSON.stringify({ type: 'update', data: incidents });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (err) {
          const error = JSON.stringify({ type: 'error', message: 'Failed to fetch incidents' });
          controller.enqueue(encoder.encode(`data: ${error}\n\n`));
        }
      };

      // Send initial data immediately
      send();

      // Poll database every 3 seconds and send changes
      const interval = setInterval(send, 3000);

      // Heartbeat every 15 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          // Connection closed
        }
      }, 15000);

      // Cleanup on disconnect
      const cleanup = () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      // Listen for client disconnect
      _request.signal.addEventListener('abort', cleanup);

      // Also cleanup after 5 minutes (Vercel serverless timeout safety)
      const timeout = setTimeout(cleanup, 300_000);
      _request.signal.addEventListener('abort', () => clearTimeout(timeout));
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
