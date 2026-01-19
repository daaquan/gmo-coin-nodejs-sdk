import type { FastifyInstance } from 'fastify';
import { FxPrivateRestClient, CryptoPrivateRestClient } from '../../src/rest.js';
import { gmoPostGate, gmoGetGate } from '../lib/rateLimiter.js';
import { getCreds, tenantFromReq } from '../lib/tenants.js';
import { determineClientType } from '../lib/clientRouter.js';
import { handleResult } from '../lib/errorHandler.js';

export function registerOrderRoutes(app: FastifyInstance) {
  // GET /v1/activeOrders
  app.get('/v1/activeOrders', { preHandler: [gmoGetGate] }, async (req, reply) => {
    const tenant = tenantFromReq(req.headers, req.query as any);
    const { apiKey, secret } = getCreds(tenant);
    const query = req.query as any;
    const clientType = determineClientType(query.symbol || 'USD_JPY');

    let result: any;
    if (clientType === 'fx') {
      const fx = new FxPrivateRestClient(apiKey, secret);
      result = await fx.getActiveOrders(query);
    } else {
      const crypto = new CryptoPrivateRestClient(apiKey, secret);
      result = await crypto.getActiveOrders(query);
    }
    return handleResult(reply, result);
  });

  // POST /v1/order
  app.post('/v1/order', { preHandler: [gmoPostGate] }, async (req, reply) => {
    const tenant = tenantFromReq(req.headers, req.body as any);
    const { apiKey, secret } = getCreds(tenant);
    const body = req.body as any;
    const clientType = determineClientType(body.symbol);

    let result: any;
    if (clientType === 'fx') {
      const fx = new FxPrivateRestClient(apiKey, secret);
      result = await fx.placeOrder(body);
    } else {
      const crypto = new CryptoPrivateRestClient(apiKey, secret);
      result = await crypto.placeOrder(body);
    }
    return handleResult(reply, result);
  });
}
