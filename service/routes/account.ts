import type { FastifyInstance } from 'fastify';
import { FxPrivateRestClient } from '../../src/rest.js';
import { gmoGetGate } from '../lib/rateLimiter.js';
import { getCreds, tenantFromReq } from '../lib/tenants.js';

export function registerAccountRoutes(app: FastifyInstance) {
  app.get('/v1/account/assets', { preHandler: [gmoGetGate] }, async (_req, reply) => {
    const tenant = tenantFromReq(_req.headers, _req.query);
    const { apiKey, secret } = getCreds(tenant);
    const fx = new FxPrivateRestClient(apiKey, secret);
    const res = await fx.getAssets();
    return reply.send(res);
  });
}
