import type { FastifyInstance } from 'fastify';
import { FxPrivateRestClient, CryptoPrivateRestClient } from '../../src/rest.js';
import { gmoGetGate } from '../lib/rateLimiter.js';
import { getCreds, tenantFromReq } from '../lib/tenants.js';
import { determineClientType } from '../lib/clientRouter.js';
import { handleResult } from '../lib/errorHandler.js';

export function registerPositionRoutes(app: FastifyInstance) {
  app.get('/v1/openPositions', { preHandler: [gmoGetGate] }, async (req, reply) => {
    const tenant = tenantFromReq(req.headers, req.query as any);
    const { apiKey, secret } = getCreds(tenant);
    const q = req.query as any;

    let result: any;
    const clientType = determineClientType(q.symbol || 'USD_JPY');
    if (clientType === 'fx') {
      const fx = new FxPrivateRestClient(apiKey, secret);
      result = await fx.getOpenPositions(q);
    } else {
      const crypto = new CryptoPrivateRestClient(apiKey, secret);
      result = await crypto.getOpenPositions(q);
    }
    return handleResult(reply, result);
  });

  app.get('/v1/positionSummary', { preHandler: [gmoGetGate] }, async (req, reply) => {
    const tenant = tenantFromReq(req.headers, req.query as any);
    const { apiKey, secret } = getCreds(tenant);
    const q = req.query as any;

    let result: any;
    const clientType = determineClientType(q.symbol || 'USD_JPY');
    if (clientType === 'fx') {
      const fx = new FxPrivateRestClient(apiKey, secret);
      result = await fx.getPositionSummary(q);
    } else {
      const crypto = new CryptoPrivateRestClient(apiKey, secret);
      result = await crypto.getPositionSummary(q);
    }
    return handleResult(reply, result);
  });
}