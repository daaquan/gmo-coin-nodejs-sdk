import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FxPrivateWsAuth, FxPrivateWsClient } from '../../src/ws-private.js';
import { gmoWsGate } from '../lib/rateLimiter.js';
import { getCreds, tenantFromReq } from '../lib/tenants.js';

const Env = z.object({ FX_API_KEY: z.string().optional(), FX_API_SECRET: z.string().optional() });

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

    const tenant = tenantFromReq((req as any).headers, (req as any).query);
    const { apiKey, secret } = getCreds(tenant);
    const auth = new FxPrivateWsAuth(apiKey, secret);
    let closed = false;
    let extendTimer: NodeJS.Timeout | undefined;
    const send = (event: string, data: any) => {
      if (closed) return;
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const tokenResp = await auth.create();
      let token = tokenResp.data.token;
      const ws = new FxPrivateWsClient(token);

      // Arrange auto-extend before expiry if expireAt present
      const expireAt = tokenResp?.data?.expireAt ? Date.parse(tokenResp.data.expireAt) : undefined;
      if (expireAt && !Number.isNaN(expireAt)) {
        const earlyMs = 30_000; // extend 30s early
        const delay = Math.max(1_000, expireAt - Date.now() - earlyMs);
        extendTimer = setTimeout(async () => {
          try {
            await auth.extend(token);
            send('event', { type: 'token_extended' });
          } catch (e) {
            send('error', { error: 'extend_failed', detail: String(e) });
          }
        }, delay);
      }

      await ws.connect();
      ws.onMessage((msg) => send('message', msg));

      // Subscribe to topics via query, default to execution+order
      const q = req.query as any;
      const topics: string[] = (q?.topics ? String(q.topics).split(',') : ['execution', 'order']).map((s) => s.trim());
      const symbol = q?.symbol ? String(q.symbol) : undefined;
      for (const t of topics) await ws.subscribe(t as any, symbol);

      // Reconnect on close with simple backoff
      let reconnecting = false;
      const onClose = async () => {
        if (closed || reconnecting) return;
        reconnecting = true;
        for (const ms of [500, 1000, 2000, 5000]) {
          if (closed) return;
          try {
            const ws2 = new FxPrivateWsClient(token);
            await ws2.connect();
            ws2.onMessage((msg) => send('message', msg));
            for (const t of topics) await ws2.subscribe(t as any, symbol);
            reconnecting = false;
            return; // reconnected
          } catch {
            await new Promise((r) => setTimeout(r, ms));
          }
        }
        send('error', { error: 'ws_reconnect_failed' });
      };
      (ws as any).on?.('close', onClose);

      // Cleanup on client disconnect
      req.raw.on('close', async () => {
        closed = true;
        if (extendTimer) clearTimeout(extendTimer);
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
