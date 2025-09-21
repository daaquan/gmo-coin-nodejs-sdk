import type { FastifyInstance } from 'fastify';
import { FxPrivateRestClient } from '../../src/rest.js';
import { gmoGetGate } from '../lib/rateLimiter.js';
import { getCreds, tenantFromReq, type TenantQuery } from '../lib/tenants.js';

export function registerPositionRoutes(app: FastifyInstance) {
  app.get<{ Querystring: (TenantQuery & { symbol?: string; prevId?: string; count?: string }) }>(
    '/v1/positions/open',
    { preHandler: [gmoGetGate] },
    async (req, reply) => {
      const tenant = tenantFromReq(req.headers, req.query);
      const { apiKey, secret } = getCreds(tenant);
      const fx = new FxPrivateRestClient(apiKey, secret);
      const q = req.query;
      const res = await fx.getOpenPositions({ symbol: q?.symbol, prevId: q?.prevId, count: q?.count });
      return reply.send(res);
    }
  );

  app.get<{ Querystring: (TenantQuery & { symbol?: string }) }>(
    '/v1/positions/summary',
    { preHandler: [gmoGetGate] },
    async (req, reply) => {
      const tenant = tenantFromReq(req.headers, req.query);
      const { apiKey, secret } = getCreds(tenant);
      const fx = new FxPrivateRestClient(apiKey, secret);
      const q = req.query;
      const res = await fx.getPositionSummary({ symbol: q?.symbol });
      return reply.send(res);
    }
  );
}
