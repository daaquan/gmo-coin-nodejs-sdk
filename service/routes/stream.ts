import type { FastifyInstance } from 'fastify';
import { EventEmitter } from 'events';
import { FxPrivateWsAuth, FxPrivateWsClient } from '../../src/ws-private.js';
import { gmoWsGate } from '../lib/rateLimiter.js';
import { getCreds, tenantFromReq } from '../lib/tenants.js';

type Topic = 'execution' | 'order' | 'position' | 'positionSummary';

export function registerStreamRoutes(app: FastifyInstance) {
  // Simple SSE bridge from Private WS to clients
  app.get('/v1/stream', async (req, reply) => {
    console.log('Stream: route called');
    await gmoWsGate();
    console.log('Stream: after gmoWsGate');

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const tenant = tenantFromReq(req.headers, req.query);
    console.log('Stream: tenant =', tenant);
    const { apiKey, secret } = getCreds(tenant);
    console.log('Stream: apiKey =', apiKey ? '***' : 'undefined', 'secret =', secret ? '***' : 'undefined');
    const auth = new FxPrivateWsAuth(apiKey, secret);
    let closed = false;
    let extendTimer: ReturnType<typeof setTimeout> | undefined;
    const send = (event: string, data: unknown) => {
      if (closed) return;
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      console.log('Stream: attempting to create token...');
      const tokenResp = await auth.create();
      console.log('Stream: tokenResp =', tokenResp);
      // APIレスポンスでは data が直接トークン文字列
      let token = tokenResp.data;
      console.log('Stream: token =', token ? '***' : 'undefined');
      console.log('Stream: creating WebSocket client...');
      const ws = new FxPrivateWsClient(token);

      // Arrange auto-extend before expiry if expireAt present
      // Note: 現在のAPIレスポンスでは expireAt が含まれていないため、この機能は無効
      const expireAt = undefined; // tokenResp?.data?.expireAt ? Date.parse(tokenResp.data.expireAt) : undefined;
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
      const q = req.query as { topics?: string; symbol?: string };
      const topics: string[] = (q?.topics ? String(q.topics).split(',') : ['execution', 'order']).map((s) => s.trim());
      const symbol = q?.symbol ? String(q.symbol) : undefined;
      for (const t of topics) await ws.subscribe(t, symbol);

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
            for (const t of topics) await ws2.subscribe(t as Topic, symbol);
            reconnecting = false;
            return; // reconnected
          } catch {
            await new Promise((r) => setTimeout(r, ms));
          }
        }
        send('error', { error: 'ws_reconnect_failed' });
      };
      (ws as EventEmitter).on?.('close', onClose);

      // Cleanup on client disconnect
      req.raw.on('close', async () => {
        closed = true;
        if (extendTimer) clearTimeout(extendTimer);
        await ws.close();
        try { await auth.revoke(token); } catch { /* ignore */ }
      });
    } catch (e: unknown) {
      console.error('Stream: error occurred:', e);
      send('error', { error: 'stream_failed', detail: e instanceof Error ? e.message : String(e) });
      reply.raw.end();
    }

    return reply.sent = true;
  });
}
