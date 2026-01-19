import type { FastifyInstance } from 'fastify';
import { FxPrivateRestClient, CryptoPrivateRestClient } from '../../src/rest.js';
import { gmoGetGate } from '../lib/rateLimiter.js';
import { getCreds, tenantFromReq, type TenantQuery } from '../lib/tenants.js';
import { determineClientType } from '../lib/clientRouter.js';

interface AssetsQuery extends TenantQuery {
  symbol?: string;
}

export function registerAccountRoutes(app: FastifyInstance) {
  app.get<{ Querystring: AssetsQuery }>(
    '/v1/account/assets',
    { preHandler: [gmoGetGate] },
    async (_req, reply) => {
      try {
        const tenant = tenantFromReq(_req.headers, _req.query);
        const { apiKey, secret } = getCreds(tenant);
        const query = _req.query as AssetsQuery;

        // If symbol is provided, use it to determine client type
        // Otherwise, return FX assets (for backward compatibility)
        let res;
        if (query.symbol) {
          const clientType = determineClientType(query.symbol);
          if (clientType === 'fx') {
            const fx = new FxPrivateRestClient(apiKey, secret);
            res = await fx.getAssets();
          } else {
            const crypto = new CryptoPrivateRestClient(apiKey, secret);
            res = await crypto.getAssets();
          }
        } else {
          // Default to FX for backward compatibility
          const fx = new FxPrivateRestClient(apiKey, secret);
          res = await fx.getAssets();
        }

        return reply.send(res);
      } catch (e) {
        const err = String(e);
        return reply.status(400).send({ error: 'assets_fetch_failed', detail: err });
      }
    },
  );
}
