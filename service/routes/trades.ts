import type { FastifyInstance } from 'fastify';
import { FxPrivateRestClient, CryptoPrivateRestClient } from '../../src/rest.js';
import { gmoGetGate } from '../lib/rateLimiter.js';
import { getFxCreds, getCryptoCreds, tenantFromReq } from '../lib/tenants.js';
import { determineClientType } from '../lib/clientRouter.js';
import { handleResult } from '../lib/errorHandler.js';

export function registerTradeRoutes(app: FastifyInstance) {
  // GET /v1/executions
  // FX requires executionId. Crypto supports broader filters.
  app.get('/v1/executions', { preHandler: [gmoGetGate] }, async (req, reply) => {
    const tenant = tenantFromReq(req.headers, req.query as any);
    const query = req.query as any;
    const clientType = determineClientType(query.symbol || 'USD_JPY');

    let result: any;
    if (clientType === 'fx') {
      const { apiKey, secret } = getFxCreds(tenant);
      const fx = new FxPrivateRestClient(apiKey, secret);
      result = await fx.getExecutions({ executionId: String(query.executionId) });
    } else {
      const { apiKey, secret } = getCryptoCreds(tenant);
      const crypto = new CryptoPrivateRestClient(apiKey, secret);
      result = await crypto.getExecutions(query);
    }

    return handleResult(reply, result);
  });

  // GET /v1/latestExecutions
  app.get('/v1/latestExecutions', { preHandler: [gmoGetGate] }, async (req, reply) => {
    const tenant = tenantFromReq(req.headers, req.query as any);
    const query = req.query as any;
    const clientType = determineClientType(query.symbol || 'USD_JPY');

    let result: any;
    if (clientType === 'fx') {
      const { apiKey, secret } = getFxCreds(tenant);
      const fx = new FxPrivateRestClient(apiKey, secret);
      result = await fx.getLatestExecutions({ symbol: String(query.symbol), count: query.count });
    } else {
      const { apiKey, secret } = getCryptoCreds(tenant);
      const crypto = new CryptoPrivateRestClient(apiKey, secret);
      result = await crypto.getLatestExecutions(query);
    }

    return handleResult(reply, result);
  });
}
