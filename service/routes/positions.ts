import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FxPrivateRestClient } from '../../src/rest.js';
import { gmoGetGate } from '../lib/rateLimiter.js';

const Env = z.object({ FX_API_KEY: z.string(), FX_API_SECRET: z.string() });

export function registerPositionRoutes(app: FastifyInstance) {
  app.get('/v1/positions/open', { preHandler: [gmoGetGate] }, async (req, reply) => {
    const env = Env.parse(process.env);
    const fx = new FxPrivateRestClient(env.FX_API_KEY, env.FX_API_SECRET);
    const q = req.query as any;
    const res = await fx.getOpenPositions({ symbol: q?.symbol, prevId: q?.prevId, count: q?.count });
    return reply.send(res);
  });

  app.get('/v1/positions/summary', { preHandler: [gmoGetGate] }, async (req, reply) => {
    const env = Env.parse(process.env);
    const fx = new FxPrivateRestClient(env.FX_API_KEY, env.FX_API_SECRET);
    const q = req.query as any;
    const res = await fx.getPositionSummary({ symbol: q?.symbol });
    return reply.send(res);
  });
}

