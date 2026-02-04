import type { FastifyInstance } from 'fastify';
import { FxPrivateRestClient, CryptoPrivateRestClient } from '../../src/rest.js';
import { validateFxOrder, validateFxIfoOrder } from '../../src/validation.js';
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

  // POST /v1/ifoOrder (FX only)
  // Supports idempotency via x-idempotency-key.
  // Wrapper schema: { symbol, side, executionType(LIMIT|STOP), price, size, takeProfitPrice, stopLossPrice, expireDate?, timeInForce?, clientOrderId? }
  app.post('/v1/ifoOrder', { preHandler: [gmoPostGate] }, async (req, reply) => {
    const tenant = tenantFromReq(req.headers, req.body as any);
    const body = req.body as any;

    const clientType = determineClientType(body.symbol);
    if (clientType !== 'fx') return reply.status(400).send({ error: 'ifoOrder is FX-only' });

    const idemKey = idemKeyFromReq(req.headers);
    if (idemKey) {
      const cached = await getIdempotent(idemKey);
      if (cached) return reply.status(cached.status).send(cached.body);
    }

    const { apiKey, secret } = getFxCreds(tenant);
    const fx = new FxPrivateRestClient(apiKey, secret);

    const validated = validateFxIfoOrder(body);

    // Translate wrapper -> GMO ifoOrder body.
    // This mapping is kept explicit to stay fail-closed.
    const gmoBody: any = {
      symbol: validated.symbol,
      side: validated.side,
      executionType: validated.executionType,
      price: validated.price,
      size: validated.size,
      takeProfitPrice: validated.takeProfitPrice,
      stopLossPrice: validated.stopLossPrice,
    };
    if (validated.clientOrderId) gmoBody.clientOrderId = validated.clientOrderId;
    if (validated.expireDate) gmoBody.expireDate = validated.expireDate;
    if (validated.timeInForce) gmoBody.timeInForce = validated.timeInForce;

    const result = await fx.placeIfdocoOrder(gmoBody);

    const sent = (result && result.success)
      ? { status: 0, data: result.data, responsetime: new Date().toISOString() }
      : null;
    if (idemKey && sent) await setIdempotent(idemKey, 200, sent);

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
