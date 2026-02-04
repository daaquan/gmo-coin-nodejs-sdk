import type { FastifyInstance } from 'fastify';
import { FxPrivateRestClient, CryptoPrivateRestClient } from '../../src/rest.js';
import { validateFxOrder } from '../../src/validation.js';
import { gmoPostGate, gmoGetGate } from '../lib/rateLimiter.js';
import { getFxCreds, getCryptoCreds, tenantFromReq } from '../lib/tenants.js';
import { determineClientType } from '../lib/clientRouter.js';
import { handleResult } from '../lib/errorHandler.js';
import { getIdempotent, setIdempotent } from '../lib/idempotency.js';

function idemKeyFromReq(headers: Record<string, string | string[] | undefined>): string | undefined {
  const v = headers['x-idempotency-key'];
  if (Array.isArray(v)) return v[0];
  return v as string | undefined;
}

export function registerOrderRoutes(app: FastifyInstance) {
  // GET /v1/activeOrders
  app.get('/v1/activeOrders', { preHandler: [gmoGetGate] }, async (req, reply) => {
    const tenant = tenantFromReq(req.headers, req.query as any);
    const query = req.query as any;
    const clientType = determineClientType(query.symbol || 'USD_JPY');

    let result: any;
    if (clientType === 'fx') {
      const { apiKey, secret } = getFxCreds(tenant);
      const fx = new FxPrivateRestClient(apiKey, secret);
      result = await fx.getActiveOrders(query);
    } else {
      const { apiKey, secret } = getCryptoCreds(tenant);
      const crypto = new CryptoPrivateRestClient(apiKey, secret);
      result = await crypto.getActiveOrders(query);
    }

    return handleResult(reply, result);
  });

  // POST /v1/order
  // Supports idempotency via x-idempotency-key.
  app.post('/v1/order', { preHandler: [gmoPostGate] }, async (req, reply) => {
    const tenant = tenantFromReq(req.headers, req.body as any);
    const body = req.body as any;
    const clientType = determineClientType(body.symbol);

    const idemKey = idemKeyFromReq(req.headers);
    if (idemKey) {
      const cached = await getIdempotent(idemKey);
      if (cached) return reply.status(cached.status).send(cached.body);
    }

    let result: any;
    if (clientType === 'fx') {
      const { apiKey, secret } = getFxCreds(tenant);
      const fx = new FxPrivateRestClient(apiKey, secret);

      // Validate FX orders strictly to reduce execution noise.
      const validated = validateFxOrder(body);
      result = await fx.placeOrder(validated);
    } else {
      // Crypto order validation is not yet strict in this repo; keep pass-through.
      const { apiKey, secret } = getCryptoCreds(tenant);
      const crypto = new CryptoPrivateRestClient(apiKey, secret);
      result = await crypto.placeOrder(body);
    }

    // handleResult sends. We also mirror the envelope to the idempotency cache.
    const sent = (result && result.success)
      ? { status: 0, data: result.data, responsetime: new Date().toISOString() }
      : null;

    if (idemKey && sent) {
      await setIdempotent(idemKey, 200, sent);
    }

    return handleResult(reply, result);
  });

  // POST /v1/cancelOrders
  // FX: body { rootOrderIds: number[] }
  // Crypto: body { rootOrderIds: string[] }
  app.post('/v1/cancelOrders', { preHandler: [gmoPostGate] }, async (req, reply) => {
    const tenant = tenantFromReq(req.headers, req.body as any);
    const body = req.body as any;
    const symbol = body?.symbol as string | undefined;
    const clientType = determineClientType(symbol || 'USD_JPY');

    let result: any;
    if (clientType === 'fx') {
      const { apiKey, secret } = getFxCreds(tenant);
      const fx = new FxPrivateRestClient(apiKey, secret);
      result = await fx.cancelOrders(body);
    } else {
      const { apiKey, secret } = getCryptoCreds(tenant);
      const crypto = new CryptoPrivateRestClient(apiKey, secret);
      result = await crypto.cancelOrders(body);
    }

    return handleResult(reply, result);
  });

  // POST /v1/closeOrder (FX only)
  app.post('/v1/closeOrder', { preHandler: [gmoPostGate] }, async (req, reply) => {
    const tenant = tenantFromReq(req.headers, req.body as any);
    const body = req.body as any;

    const { apiKey, secret } = getFxCreds(tenant);
    const fx = new FxPrivateRestClient(apiKey, secret);
    const result = await fx.closeOrder(body);
    return handleResult(reply, result);
  });
}
