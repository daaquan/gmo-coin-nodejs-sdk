import type { FastifyInstance } from 'fastify';
import { FxPrivateRestClient, CryptoPrivateRestClient } from '../../src/rest.js';
import { gmoGetGate } from '../lib/rateLimiter.js';
import { getCreds, tenantFromReq, type TenantQuery } from '../lib/tenants.js';
import { determineClientType } from '../lib/clientRouter.js';

export function registerPositionRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: TenantQuery & {
      symbol?: string;
      prevId?: string;
      count?: string;
      pageSize?: string;
    };
  }>('/v1/positions/open', { preHandler: [gmoGetGate] }, async (req, reply) => {
    try {
      const tenant = tenantFromReq(req.headers, req.query);
      const { apiKey, secret } = getCreds(tenant);
      const q = req.query;

      // If symbol is provided, use it to determine client type
      if (!q.symbol) {
        return reply.status(400).send({ error: 'missing_symbol', detail: 'symbol is required' });
      }

      const clientType = determineClientType(q.symbol);
      let res;

      if (clientType === 'fx') {
        const fx = new FxPrivateRestClient(apiKey, secret);
        res = await fx.getOpenPositions({ symbol: q.symbol, prevId: q.prevId, count: q.count });
      } else {
        const crypto = new CryptoPrivateRestClient(apiKey, secret);
        res = await crypto.getOpenPositions({ symbol: q.symbol, pageSize: q.pageSize });
      }

      return reply.send(res);
    } catch (e) {
      const err = String(e);
      return reply.status(400).send({ error: 'positions_fetch_failed', detail: err });
    }
  });

  app.get<{ Querystring: TenantQuery & { symbol?: string } }>(
    '/v1/positions/summary',
    { preHandler: [gmoGetGate] },
    async (req, reply) => {
      try {
        const tenant = tenantFromReq(req.headers, req.query);
        const { apiKey, secret } = getCreds(tenant);
        const q = req.query;

        // Only FX supports position summary
        if (!q.symbol) {
          return reply.status(400).send({ error: 'missing_symbol', detail: 'symbol is required' });
        }

        const clientType = determineClientType(q.symbol);
        if (clientType !== 'fx') {
          return reply
            .status(400)
            .send({
              error: 'unsupported',
              detail: 'Position summary is only available for FX symbols',
            });
        }

        const fx = new FxPrivateRestClient(apiKey, secret);
        const res = await fx.getPositionSummary({ symbol: q.symbol });
        return reply.send(res);
      } catch (e) {
        const err = String(e);
        return reply.status(400).send({ error: 'summary_fetch_failed', detail: err });
      }
    },
  );
}
