import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FxPrivateRestClient, CryptoPrivateRestClient } from '../../src/rest.js';
import { gmoGetGate, gmoPostGate } from '../lib/rateLimiter.js';
import { getIdempotent, setIdempotent } from '../lib/idempotency.js';
import { getCreds, tenantFromReq, type TenantQuery } from '../lib/tenants.js';
import { mapGmoError } from '../lib/errors.js';
import { determineClientType, isValidExecutionType } from '../lib/clientRouter.js';

const LimitOrderBody = z.object({
  symbol: z.string(),
  side: z.enum(['BUY', 'SELL']),
  size: z.string(),
  limitPrice: z.string().optional(), // for FX
  price: z.string().optional(), // for Crypto
  clientOrderId: z.string().optional(),
  expireDate: z.string().optional(), // FX only
  settleType: z.enum(['OPEN', 'CLOSE']).optional(), // FX only
  timeInForce: z.enum(['FAK', 'GTC']).optional(), // Crypto only
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

const CancelOrdersBody = z
  .object({
    symbol: z.string(),
    rootOrderIds: z.array(z.number().int()).optional(), // for FX
    orderId: z.string().optional(), // for Crypto
  })
  .refine(
    (data) => data.rootOrderIds?.length || data.orderId,
    'Either rootOrderIds (for FX) or orderId (for Crypto) is required',
  );

const OrderBody = z.object({
  symbol: z.string(),
  side: z.enum(['BUY', 'SELL']),
  size: z.string(),
  clientOrderId: z.string().optional(),
  executionType: z.enum(['LIMIT', 'STOP', 'OCO']),
  limitPrice: z.string().optional(),
  stopPrice: z.string().optional(),
  oco: z.object({ limitPrice: z.string(), stopPrice: z.string() }).optional(),
  expireDate: z.string().optional(),
  settleType: z.enum(['OPEN', 'CLOSE']).optional(),
});

const IfdOrderBody = z.object({
  symbol: z.string(),
  clientOrderId: z.string().optional(),
  firstSide: z.enum(['BUY', 'SELL']),
  firstExecutionType: z.enum(['LIMIT', 'STOP']),
  firstSize: z.string(),
  firstPrice: z.string().optional(),
  firstStopPrice: z.string().optional(),
  secondExecutionType: z.enum(['LIMIT', 'STOP']),
  secondSize: z.string(),
  secondPrice: z.string().optional(),
  secondStopPrice: z.string().optional(),
});

const IfdocoOrderBody = z.object({
  symbol: z.string(),
  clientOrderId: z.string().optional(),
  firstSide: z.enum(['BUY', 'SELL']),
  firstExecutionType: z.enum(['LIMIT', 'STOP']),
  firstSize: z.string(),
  firstPrice: z.string().optional(),
  firstStopPrice: z.string().optional(),
  secondExecutionType: z.literal('LIMIT'),
  secondLimitPrice: z.string(),
  secondStopPrice: z.string(),
  secondSize: z.string(),
});

type OrdersActiveQuery = TenantQuery & { symbol?: string; count?: string; prevId?: string };

export function registerOrderRoutes(app: FastifyInstance) {
  app.get<{ Querystring: OrdersActiveQuery }>(
    '/v1/orders/active',
    { preHandler: [gmoGetGate] },
    async (req, reply) => {
      const tenant = tenantFromReq(req.headers, req.query);
      const { apiKey, secret } = getCreds(tenant);
      const fx = new FxPrivateRestClient(apiKey, secret);
      const query = req.query;
      req.log.info({ msg: 'getActiveOrders called', tenant, query });
      const res = await fx.getActiveOrders({
        symbol: query?.symbol,
        count: query?.count,
        prevId: query?.prevId,
      });
      req.log.info({ msg: 'getActiveOrders response', data: res });
      return reply.send(res);
    },
  );

  app.post<{ Querystring: TenantQuery }>(
    '/v1/orders/limit',
    { preHandler: [gmoPostGate] },
    async (req, reply) => {
      try {
        const tenant = tenantFromReq(req.headers, req.query);
        const { apiKey, secret } = getCreds(tenant);
        const body = LimitOrderBody.parse(req.body);

        const clientType = determineClientType(body.symbol);

        const idem = (req.headers['idempotency-key'] as string) || undefined;
        const cached = await getIdempotent(idem);
        if (cached) return reply.status(cached.status).send(cached.body);

        let placed;
        if (clientType === 'fx') {
          if (!body.limitPrice) throw new Error('FX LIMIT orders require limitPrice');
          const fx = new FxPrivateRestClient(apiKey, secret);
          placed = await fx.placeOrder({
            symbol: body.symbol,
            side: body.side,
            size: body.size,
            executionType: 'LIMIT',
            limitPrice: body.limitPrice,
            clientOrderId: body.clientOrderId,
            expireDate: body.expireDate,
            settleType: body.settleType,
          });
        } else {
          if (!body.price) throw new Error('Crypto LIMIT orders require price');
          const crypto = new CryptoPrivateRestClient(apiKey, secret);
          placed = await crypto.placeOrder({
            symbol: body.symbol,
            side: body.side,
            executionType: 'LIMIT',
            size: body.size,
            price: body.price,
            timeInForce: body.timeInForce,
          });
        }

        if (idem) await setIdempotent(idem, 200, placed);
        return reply.send(placed);
      } catch (e) {
        const err = mapGmoError(e);
        return reply.status(400).send({ error: 'order_limit_failed', detail: String(err) });
      }
    },
  );

  app.post<{ Querystring: TenantQuery }>(
    '/v1/orders/speed',
    { preHandler: [gmoPostGate] },
    async (req, reply) => {
      try {
        const tenant = tenantFromReq(req.headers, req.query);
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
    },
  );

  app.post<{ Querystring: TenantQuery }>(
    '/v1/orders/cancel',
    { preHandler: [gmoPostGate] },
    async (req, reply) => {
      try {
        const tenant = tenantFromReq(req.headers, req.query);
        const { apiKey, secret } = getCreds(tenant);
        const body = CancelOrdersBody.parse(req.body);

        const clientType = determineClientType(body.symbol);

        let res;
        if (clientType === 'fx') {
          if (!body.rootOrderIds) throw new Error('FX orders require rootOrderIds');
          const fx = new FxPrivateRestClient(apiKey, secret);
          res = await fx.cancelOrders({ rootOrderIds: body.rootOrderIds });
        } else {
          if (!body.orderId) throw new Error('Crypto orders require orderId');
          const crypto = new CryptoPrivateRestClient(apiKey, secret);
          res = await crypto.cancelOrder(body.orderId);
        }

        return reply.send(res);
      } catch (e) {
        const err = mapGmoError(e);
        return reply.status(400).send({ error: 'order_cancel_failed', detail: String(err) });
      }
    },
  );

  app.post<{ Querystring: TenantQuery }>(
    '/private/v1/order',
    { preHandler: [gmoPostGate] },
    async (req, reply) => {
      try {
        const tenant = tenantFromReq(req.headers, req.query);
        const { apiKey, secret } = getCreds(tenant);
        const fx = new FxPrivateRestClient(apiKey, secret);
        const body = OrderBody.parse(req.body);

        const idem = (req.headers['idempotency-key'] as string) || undefined;
        const cached = await getIdempotent(idem);
        if (cached) return reply.status(cached.status).send(cached.body);

        const placed = await fx.placeOrder({
          symbol: body.symbol,
          side: body.side,
          size: body.size,
          executionType: body.executionType,
          limitPrice: body.limitPrice,
          stopPrice: body.stopPrice,
          oco: body.oco,
          clientOrderId: body.clientOrderId,
          expireDate: body.expireDate,
          settleType: body.settleType,
        });
        if (idem) await setIdempotent(idem, 200, placed);
        return reply.send(placed);
      } catch (e) {
        const err = mapGmoError(e);
        return reply.status(400).send({ error: 'order_failed', detail: String(err) });
      }
    },
  );

  app.post<{ Querystring: TenantQuery }>(
    '/private/v1/ifdOrder',
    { preHandler: [gmoPostGate] },
    async (req, reply) => {
      try {
        const tenant = tenantFromReq(req.headers, req.query);
        const { apiKey, secret } = getCreds(tenant);
        const fx = new FxPrivateRestClient(apiKey, secret);
        const body = IfdOrderBody.parse(req.body);

        const idem = (req.headers['idempotency-key'] as string) || undefined;
        const cached = await getIdempotent(idem);
        if (cached) return reply.status(cached.status).send(cached.body);

        const placed = await fx.placeIfdOrder({
          symbol: body.symbol,
          clientOrderId: body.clientOrderId,
          firstSide: body.firstSide,
          firstExecutionType: body.firstExecutionType,
          firstSize: body.firstSize,
          firstPrice: body.firstPrice,
          firstStopPrice: body.firstStopPrice,
          secondExecutionType: body.secondExecutionType,
          secondSize: body.secondSize,
          secondPrice: body.secondPrice,
          secondStopPrice: body.secondStopPrice,
        });
        if (idem) await setIdempotent(idem, 200, placed);
        return reply.send(placed);
      } catch (e) {
        const err = mapGmoError(e);
        return reply.status(400).send({ error: 'ifd_order_failed', detail: String(err) });
      }
    },
  );

  app.post<{ Querystring: TenantQuery }>(
    '/private/v1/ifoOrder',
    { preHandler: [gmoPostGate] },
    async (req, reply) => {
      try {
        const tenant = tenantFromReq(req.headers, req.query);
        const { apiKey, secret } = getCreds(tenant);
        const fx = new FxPrivateRestClient(apiKey, secret);
        const body = IfdocoOrderBody.parse(req.body);

        const idem = (req.headers['idempotency-key'] as string) || undefined;
        const cached = await getIdempotent(idem);
        if (cached) return reply.status(cached.status).send(cached.body);

        const placed = await fx.placeIfdocoOrder({
          symbol: body.symbol,
          clientOrderId: body.clientOrderId,
          firstSide: body.firstSide,
          firstExecutionType: body.firstExecutionType,
          firstSize: body.firstSize,
          firstPrice: body.firstPrice,
          firstStopPrice: body.firstStopPrice,
          secondExecutionType: body.secondExecutionType,
          secondLimitPrice: body.secondLimitPrice,
          secondStopPrice: body.secondStopPrice,
          secondSize: body.secondSize,
        });
        if (idem) await setIdempotent(idem, 200, placed);
        return reply.send(placed);
      } catch (e) {
        const err = mapGmoError(e);
        return reply.status(400).send({ error: 'ifo_order_failed', detail: String(err) });
      }
    },
  );
}
