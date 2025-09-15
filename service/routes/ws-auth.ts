import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FxPrivateWsAuth } from '../../src/ws-private.js';
import { gmoPostGate } from '../lib/rateLimiter.js';
import { getCreds, tenantFromReq } from '../lib/tenants.js';

const Env = z.object({ FX_API_KEY: z.string().optional(), FX_API_SECRET: z.string().optional() });

export function registerWsAuthRoutes(app: FastifyInstance) {
  app.post('/v1/ws-auth', { preHandler: [gmoPostGate] }, async (_req, reply) => {
    const env = Env.parse(process.env);
    const tenant = tenantFromReq((_req as any).headers, (_req as any).query);
    const { apiKey, secret } = getCreds(tenant);
    const auth = new FxPrivateWsAuth(apiKey, secret);
    const res = await auth.create();
    return reply.send(res);
  });
}