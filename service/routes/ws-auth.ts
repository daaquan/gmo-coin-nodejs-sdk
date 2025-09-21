import type { FastifyInstance } from 'fastify';
import { FxPrivateWsAuth } from '../../src/ws-private.js';
import { gmoPostGate } from '../lib/rateLimiter.js';
import { getCreds, tenantFromReq } from '../lib/tenants.js';

export function registerWsAuthRoutes(app: FastifyInstance) {
  app.post('/v1/ws-auth', { preHandler: [gmoPostGate] }, async (_req, reply) => {
    const tenant = tenantFromReq(_req.headers, _req.query);
    const { apiKey, secret } = getCreds(tenant);
    const auth = new FxPrivateWsAuth(apiKey, secret);
    const res = await auth.create();
    return reply.send(res);
  });
}