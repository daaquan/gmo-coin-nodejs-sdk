# Advanced Features

This section covers advanced production-ready features, operational considerations, and microservice usage for the GMO Coin SDK.

## Production Features

### Unified Pagination
Seamless FX/Crypto API pagination with unified interface.
- FX: cursor-based (prevId + count)
- Crypto: offset-based (limit/pageSize)

Example:
```typescript
// Works for both FX and Crypto
const orders = await client.getActiveOrders({
  symbol: 'USD_JPY',
  prevId: '123',
  count: '50'
});
```

### Request Caching
TTL-based in-memory cache (1s default), automatic LRU eviction. Applied to: `getTicker()`, `getOrderBook()`.

Example:
```typescript
const fxClient = new FxPublicRestClient(undefined, 5000); // 5s TTL
const ticker = await fxClient.getTicker('USD_JPY'); // Cached
```

### Audit Logging
Comprehensive request/response logging with automatic PII masking (API keys, secrets, tokens, passwords), error tracking with optional stack traces, and user identification support.

Example logs:
```
[AUDIT:INFO] GET /v1/assets - 200 (45ms)
[AUDIT:ERROR] POST /v1/order - 400 (120ms)
```

### Metrics Collection
Request metrics per endpoint (count, latency, error rate), order lifecycle tracking (placed, completed, failed, pending), execution tracking by symbol, error categorization by type, Prometheus-compatible export.

Example:
```typescript
const metrics = metricsCollector.getMetrics();
console.log(metrics.orders.placed); // Total orders placed
console.log(metrics.errorRate); // Overall error rate

const prometheus = exportPrometheus(metrics);
// Export to Prometheus/Grafana
```

### Retry & Circuit Breaker
Automatic retry with exponential backoff, circuit breaker pattern for cascading failure prevention, configurable thresholds and timeouts.

Example:
```typescript
const breaker = new CircuitBreaker(fn, {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000
});
```

### Input Validation
Zod-based schema validation, safe validation mode (returns errors instead of throwing), supported symbols list validation.

Example:
```typescript
const result = validateFxOrderSafe(orderData);
if (result.valid) {
  await client.placeOrder(result.data);
}
```

## Operational Notes

- **Rate limits**: GET ≤ 6/s, POST ≤ 1/s; WS subscribe/unsubscribe ≤ 1/s.
- **Time sync**: API compares `API-TIMESTAMP` with server; keep clock accurate.
- **Errors**: Throws on non-`status:0` with HTTP status and API code/message when available.
- **Real trading risk**: This SDK can submit live orders. Test carefully before production.

## Microservice Usage

### Starting the Service
```bash
cp .env.example .env
# Fill FX_API_KEY, FX_API_SECRET, CRYPTO_API_KEY, CRYPTO_API_SECRET (and optional SERVICE_AUTH_TOKEN)
npm run start:service
```

### Endpoints
- `GET /health`
- `GET /v1/account/assets`
- `GET /v1/orders/active?symbol=USD_JPY&count=50`
- `POST /v1/orders/limit` body `{ symbol, side, size, limitPrice, clientOrderId?, expireDate?, settleType? }`
- `POST /v1/orders/speed` body `{ symbol, side, size, clientOrderId?, upperBound?, lowerBound?, isHedgeable? }`
- `POST /v1/orders/cancel` body `{ rootOrderIds: number[] }`
- `GET /v1/positions/open`
- `GET /v1/positions/summary`
- `GET /v1/stream?topics=execution,order&symbol=USD_JPY` (SSE)
- `GET /metrics` (Prometheus exposition)

### Authentication
- If `SERVICE_AUTH_TOKEN` is set, include `Authorization: Bearer <token>` in requests. TODO: Replace with JWT/mTLS in production.
- Auth via JWT (JWKS): set `SERVICE_AUTH_MODE=jwt`, `JWKS_URL`, and optional `JWT_ISSUER`/`JWT_AUDIENCE`.

### Rate Limiting
- If `REDIS_URL` is set, uses Redis fixed-window limiter (GET 6/s, POST 1/s, WS 1/s). Falls back to in-process.

### Idempotency
- If `REDIS_URL` is set, uses Redis for `Idempotency-Key` storage; otherwise in-memory.
- Multi-tenant: Supply `X-Tenant-Id` header or `?tenant=...` to pick creds from `FX_API_KEY__<TENANT>` / `FX_API_SECRET__<TENANT>`; falls back to base.

### OpenAPI
- See `openapi.yaml` for a high-level spec of the service API.

### Placing Orders in Examples
- The example skips order placement by default to avoid unintended trades.
- To place and then cancel a LIMIT order: `FX_API_KEY=... FX_API_SECRET=... PLACE_LIMIT=1 ORDER_SYMBOL=USD_JPY ORDER_SIDE=BUY ORDER_SIZE=1000 ORDER_LIMIT_PRICE=yourPrice npm run examples:rest`
- To place and then cancel a SPEED order: `FX_API_KEY=... FX_API_SECRET=... PLACE_SPEED=1 ORDER_SYMBOL=USD_JPY ORDER_SIDE=BUY ORDER_SIZE=1000 npm run examples:rest`
- Ensure `ORDER_LIMIT_PRICE` is within the allowed price range and tick size per GMO Coin specs.