import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FxPrivateRestClient } from '../../src/rest.js';
import { gmoGetGate } from '../lib/rateLimiter.js';
import { getCreds, tenantFromReq } from '../lib/tenants.js';

const Env = z.object({ FX_API_KEY: z.string().optional(), FX_API_SECRET: z.string().optional() });

export function registerAccountRoutes(app: FastifyInstance) {
  app.get('/v1/account/assets', { preHandler: [gmoGetGate] }, async (_req, reply) => {
    const env = Env.parse(process.env);
    const tenant = tenantFromReq((_req as any).headers, (_req as any).query);
    const { apiKey, secret } = getCreds(tenant);
    const fx = new FxPrivateRestClient(apiKey, secret);
    const res = await fx.getAssets();
    return reply.send(res);
  });
}
