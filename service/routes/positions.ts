import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FxPrivateRestClient } from '../../src/rest.js';
import { gmoGetGate } from '../lib/rateLimiter.js';
import { getCreds, tenantFromReq } from '../lib/tenants.js';

const Env = z.object({ FX_API_KEY: z.string().optional(), FX_API_SECRET: z.string().optional() });

export function registerPositionRoutes(app: FastifyInstance) {
  app.get('/v1/positions/open', { preHandler: [gmoGetGate] }, async (req, reply) => {
    const env = Env.parse(process.env);
    const tenant = tenantFromReq((req as any).headers, (req as any).query);
    const { apiKey, secret } = getCreds(tenant);
    const fx = new FxPrivateRestClient(apiKey, secret);
    const q = req.query as any;
    const res = await fx.getOpenPositions({ symbol: q?.symbol, prevId: q?.prevId, count: q?.count });
    return reply.send(res);
  });

  app.get('/v1/positions/summary', { preHandler: [gmoGetGate] }, async (req, reply) => {
    const env = Env.parse(process.env);
    const tenant = tenantFromReq((req as any).headers, (req as any).query);
    const { apiKey, secret } = getCreds(tenant);
    const fx = new FxPrivateRestClient(apiKey, secret);
    const q = req.query as any;
    const res = await fx.getPositionSummary({ symbol: q?.symbol });
    return reply.send(res);
  });
}
