import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FxPrivateWsAuth, FxPrivateWsClient } from '../../src/ws-private.js';
import { gmoWsGate } from '../lib/rateLimiter.js';

const Env = z.object({ FX_API_KEY: z.string(), FX_API_SECRET: z.string() });

export function registerStreamRoutes(app: FastifyInstance) {
  // Simple SSE bridge from Private WS to clients
  app.get('/v1/stream', async (req, reply) => {
    const env = Env.parse(process.env);
    await gmoWsGate();

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const auth = new FxPrivateWsAuth(env.FX_API_KEY, env.FX_API_SECRET);
    let closed = false;
    const send = (event: string, data: any) => {
      if (closed) return;
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const tokenResp = await auth.create();
      const token = tokenResp.data.token;
      const ws = new FxPrivateWsClient(token);
      await ws.connect();
      ws.onMessage((msg) => send('message', msg));

      // Subscribe to topics via query, default to execution+order
      const q = req.query as any;
      const topics: string[] = (q?.topics ? String(q.topics).split(',') : ['execution', 'order']).map((s) => s.trim());
      const symbol = q?.symbol ? String(q.symbol) : undefined;
      for (const t of topics) await ws.subscribe(t as any, symbol);

      // Cleanup on client disconnect
      req.raw.on('close', async () => {
        closed = true;
        await ws.close();
        try { await auth.revoke(token); } catch {}
      });
    } catch (e: any) {
      send('error', { error: 'stream_failed', detail: e?.message || String(e) });
      reply.raw.end();
    }

    return reply.sent = true;
  });
}

