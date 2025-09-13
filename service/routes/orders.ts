import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FxPrivateRestClient } from '../../src/rest.js';
import { gmoGetGate, gmoPostGate } from '../lib/rateLimiter.js';
import { getIdempotent, setIdempotent } from '../lib/idempotency.js';
import { getCreds, tenantFromReq } from '../lib/tenants.js';
import { mapGmoError } from '../lib/errors.js';

const Env = z.object({ FX_API_KEY: z.string().optional(), FX_API_SECRET: z.string().optional() });

const LimitOrderBody = z.object({
  symbol: z.string(),
  side: z.enum(['BUY', 'SELL']),
  size: z.string(),
  limitPrice: z.string(),
  clientOrderId: z.string().optional(),
  expireDate: z.string().optional(),
  settleType: z.enum(['OPEN', 'CLOSE']).optional(),
});

const SpeedOrderBody = z.object({
  symbol: z.string(),
  side: z.enum(['BUY', 'SELL']),
  size: z.string(),
  clientOrderId: z.string().optional(),
  upperBound: z.string().optional(),
  lowerBound: z.string().optional(),
  isHedgeable: z.boolean().optional(),
});

const CancelOrdersBody = z.object({ rootOrderIds: z.array(z.number().int()).min(1) });

export function registerOrderRoutes(app: FastifyInstance) {
  app.get('/v1/orders/active', { preHandler: [gmoGetGate] }, async (req, reply) => {
    const env = Env.parse(process.env);
    const tenant = tenantFromReq(req.headers as any, req.query as any);
    const { apiKey, secret } = getCreds(tenant);
    const fx = new FxPrivateRestClient(apiKey, secret);
    const query = req.query as any;
    const res = await fx.getActiveOrders({ symbol: query?.symbol, count: query?.count, prevId: query?.prevId });
    return reply.send(res);
  });

  app.post('/v1/orders/limit', { preHandler: [gmoPostGate] }, async (req, reply) => {
    try {
      const env = Env.parse(process.env);
      const tenant = tenantFromReq(req.headers as any, (req as any).query);
      const { apiKey, secret } = getCreds(tenant);
      const fx = new FxPrivateRestClient(apiKey, secret);
      const body = LimitOrderBody.parse(req.body);

      const idem = (req.headers['idempotency-key'] as string) || undefined;
      const cached = await getIdempotent(idem);
      if (cached) return reply.status(cached.status).send(cached.body);

      const placed = await fx.placeOrder({
        symbol: body.symbol,
        side: body.side,
        size: body.size,
        executionType: 'LIMIT',
        limitPrice: body.limitPrice,
        clientOrderId: body.clientOrderId,
        expireDate: body.expireDate,
        settleType: body.settleType,
      });
      if (idem) await setIdempotent(idem, 200, placed);
      return reply.send(placed);
    } catch (e) {
      const err = mapGmoError(e);
      return reply.status(400).send({ error: 'order_limit_failed', detail: String(err) });
    }
  });

  app.post('/v1/orders/speed', { preHandler: [gmoPostGate] }, async (req, reply) => {
    try {
      const env = Env.parse(process.env);
      const tenant = tenantFromReq(req.headers as any, (req as any).query);
      const { apiKey, secret } = getCreds(tenant);
      const fx = new FxPrivateRestClient(apiKey, secret);
      const body = SpeedOrderBody.parse(req.body);

      const idem = (req.headers['idempotency-key'] as string) || undefined;
      const cached = await getIdempotent(idem);
      if (cached) return reply.status(cached.status).send(cached.body);

      const placed = await fx.speedOrder({
        symbol: body.symbol,
        side: body.side,
        size: body.size,
        clientOrderId: body.clientOrderId,
        upperBound: body.upperBound,
        lowerBound: body.lowerBound,
        isHedgeable: body.isHedgeable,
      });
      if (idem) await setIdempotent(idem, 200, placed);
      return reply.send(placed);
    } catch (e) {
      const err = mapGmoError(e);
      return reply.status(400).send({ error: 'order_speed_failed', detail: String(err) });
    }
  });

  app.post('/v1/orders/cancel', { preHandler: [gmoPostGate] }, async (req, reply) => {
    try {
      const env = Env.parse(process.env);
      const tenant = tenantFromReq(req.headers as any, (req as any).query);
      const { apiKey, secret } = getCreds(tenant);
      const fx = new FxPrivateRestClient(apiKey, secret);
      const body = CancelOrdersBody.parse(req.body);
      const res = await fx.cancelOrders({ rootOrderIds: body.rootOrderIds });
      return reply.send(res);
    } catch (e) {
      const err = mapGmoError(e);
      return reply.status(400).send({ error: 'order_cancel_failed', detail: String(err) });
    }
  });
}
