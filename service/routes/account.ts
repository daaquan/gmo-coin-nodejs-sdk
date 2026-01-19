import type { FastifyInstance } from 'fastify';
import { FxPrivateRestClient, CryptoPrivateRestClient } from '../../src/rest.js';
import { gmoGetGate } from '../lib/rateLimiter.js';
import { getCreds, tenantFromReq, type TenantQuery } from '../lib/tenants.js';
import { determineClientType } from '../lib/clientRouter.js';
import { handleResult } from '../lib/errorHandler.js';

interface AssetsQuery extends TenantQuery {
  symbol?: string;
}

export function registerAccountRoutes(app: FastifyInstance) {
  app.get<{ Querystring: AssetsQuery }>(
    '/v1/account/assets',
    { preHandler: [gmoGetGate] },
    async (_req, reply) => {
      const tenant = tenantFromReq(_req.headers, _req.query as any);
      const { apiKey, secret } = getCreds(tenant);
      const query = _req.query;

      let result: any;
      if (query.symbol) {
        const clientType = determineClientType(query.symbol);
        if (clientType === 'fx') {
          const fx = new FxPrivateRestClient(apiKey, secret);
          result = await fx.getAssets();
        } else {
          const crypto = new CryptoPrivateRestClient(apiKey, secret);
          result = await crypto.getAssets();
        }
      } else {
        const fx = new FxPrivateRestClient(apiKey, secret);
        result = await fx.getAssets();
      }

      return handleResult(reply, result);
    },
  );
}
