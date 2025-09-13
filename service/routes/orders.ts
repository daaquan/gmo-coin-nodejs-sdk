import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FxPrivateRestClient } from '../../src/rest.js';
import { gmoGetGate, gmoPostGate } from '../lib/rateLimiter.js';
import { getIdempotent, setIdempotent } from '../lib/idempotency.js';

const Env = z.object({ FX_API_KEY: z.string(), FX_API_SECRET: z.string() });

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
    const fx = new FxPrivateRestClient(env.FX_API_KEY, env.FX_API_SECRET);
    const query = req.query as any;
    const res = await fx.getActiveOrders({ symbol: query?.symbol, count: query?.count, prevId: query?.prevId });
    return reply.send(res);
  });

  app.post('/v1/orders/limit', { preHandler: [gmoPostGate] }, async (req, reply) => {
    const env = Env.parse(process.env);
    const fx = new FxPrivateRestClient(env.FX_API_KEY, env.FX_API_SECRET);
    const body = LimitOrderBody.parse(req.body);

    // Idempotency support (optional header)
    const idem = (req.headers['idempotency-key'] as string) || undefined;
    const cached = getIdempotent(idem);
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
    if (idem) setIdempotent(idem, 200, placed);
    return reply.send(placed);
  });

  app.post('/v1/orders/speed', { preHandler: [gmoPostGate] }, async (req, reply) => {
    const env = Env.parse(process.env);
    const fx = new FxPrivateRestClient(env.FX_API_KEY, env.FX_API_SECRET);
    const body = SpeedOrderBody.parse(req.body);

    const idem = (req.headers['idempotency-key'] as string) || undefined;
    const cached = getIdempotent(idem);
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
    if (idem) setIdempotent(idem, 200, placed);
    return reply.send(placed);
  });

  app.post('/v1/orders/cancel', { preHandler: [gmoPostGate] }, async (req, reply) => {
    const env = Env.parse(process.env);
    const fx = new FxPrivateRestClient(env.FX_API_KEY, env.FX_API_SECRET);
    const body = CancelOrdersBody.parse(req.body);
    const res = await fx.cancelOrders({ rootOrderIds: body.rootOrderIds });
    return reply.send(res);
  });
}

