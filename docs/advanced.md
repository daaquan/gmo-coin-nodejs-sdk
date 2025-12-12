# Advanced Features

This section covers advanced production-ready features including caching, metrics, audit logging, validation, retry strategies, and microservice deployment.

## Production-Ready Features

### Request Caching

TTL-based in-memory cache with automatic LRU eviction for public APIs.

```typescript
import { FxPublicRestClient } from 'gmo-coin-sdk';

// Create client with 5-second TTL cache
const fxPublic = new FxPublicRestClient(undefined, 5000);

// First call fetches from API
const ticker1 = await fxPublic.getTicker('USD_JPY');

// Second call within 5s returns cached result
const ticker2 = await fxPublic.getTicker('USD_JPY');

// After 5s, next call fetches fresh data
setTimeout(async () => {
  const ticker3 = await fxPublic.getTicker('USD_JPY'); // Fresh
}, 6000);
```

**Cached methods**: `getTicker()`, `getOrderBook()`, `getTrades()`, `getKlines()`

**Default TTL**: 1 second, customizable per client instance

### Metrics Collection

Comprehensive metrics tracking for monitoring, performance analysis, and debugging.

```typescript
import { metricsCollector, exportPrometheus } from 'gmo-coin-sdk';

// Get aggregated metrics
const metrics = metricsCollector.getMetrics();

console.log('Metrics Summary:');
console.log(`Orders placed: ${metrics.orders.placed}`);
console.log(`Orders completed: ${metrics.orders.completed}`);
console.log(`Orders failed: ${metrics.orders.failed}`);
console.log(`Total executions: ${metrics.executions.total}`);
console.log(`Error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);

// Get metrics for specific endpoint
const getAssetsMetrics = metricsCollector.getEndpointMetrics('GET', '/v1/assets');
console.log(`GET /v1/assets:`);
console.log(`  Requests: ${getAssetsMetrics.requestCount}`);
console.log(`  Avg latency: ${getAssetsMetrics.latency.avg}ms`);
console.log(`  Error rate: ${(getAssetsMetrics.errorRate * 100).toFixed(2)}%`);

// Export to Prometheus format
const prometheusMetrics = exportPrometheus(metrics);
console.log(prometheusMetrics); // Can be exposed to Prometheus scraper
```

**Tracked metrics**:
- Per-endpoint: request count, error count, latency stats (min/max/avg)
- Orders: placed, completed, failed, pending counts
- Executions: total count by symbol
- Errors: categorized by HTTP status and API error codes

### Audit Logging

Comprehensive request/response logging with automatic PII masking for security and compliance.

```typescript
import { AuditLogger } from 'gmo-coin-sdk';

const logger = new AuditLogger({
  logHeaders: true,
  logRequestBody: true,
  logResponseData: true,
  includeStackTrace: true,
  piiPatterns: [
    /api[_-]?key/gi,
    /api[_-]?secret/gi,
    /password/gi
  ]
});

// Log request
logger.logRequest('POST', '/v1/order', {
  'API-KEY': 'hidden***',
  'Content-Type': 'application/json'
}, {
  symbol: 'USD_JPY',
  apiKey: 'my-secret-key' // Will be masked
});

// Log response (with PII masking)
logger.logResponse(
  Date.now() - 150,
  200,
  { status: 0, data: { orderId: 123 } }
);

// Log error
logger.logRequest(
  'POST', '/v1/order', {}, {},
  new Error('API Error: ERR-201'),
  'user-123'
);
```

**Automatically masked**: API keys, secrets, tokens, passwords

### Input Validation

Zod-based runtime validation for all API requests.

```typescript
import {
  validateFxOrder,
  validateFxOrderSafe,
  validateCryptoOrder,
  validateCryptoOrderSafe,
  validateFxSymbol,
  getCryptoSymbols
} from 'gmo-coin-sdk';

// Validate FX order (throws on invalid)
try {
  const validOrder = validateFxOrder({
    symbol: 'USD_JPY',
    side: 'BUY',
    size: '10000',
    executionType: 'LIMIT',
    limitPrice: '130'
  });
  await fxClient.placeOrder(validOrder);
} catch (error) {
  console.error('Order validation failed:', error.message);
}

// Safe validation (returns error result)
const result = validateFxOrderSafe({
  symbol: 'INVALID',
  side: 'BUY',
  size: '10000'
});

if (result.valid) {
  await fxClient.placeOrder(result.data);
} else {
  console.error('Validation errors:', result.errors);
}

// Validate symbol
if (validateFxSymbol('USD_JPY')) {
  console.log('Valid FX symbol');
}

// List supported symbols
const cryptoSymbols = getCryptoSymbols();
console.log('Supported crypto:', cryptoSymbols); // [BTC, ETH, ...]
```

### Retry Strategy with Exponential Backoff

Automatic retry with exponential backoff and jitter for resilience.

```typescript
import { retryWithBackoff } from 'gmo-coin-sdk';

// Basic usage with defaults
const assets = await retryWithBackoff(async () => {
  return fxClient.getAssets();
});

// Custom configuration
const order = await retryWithBackoff(
  async () => {
    return fxClient.placeOrder({
      symbol: 'USD_JPY',
      side: 'BUY',
      size: '10000',
      executionType: 'LIMIT',
      limitPrice: '130'
    });
  },
  {
    maxRetries: 5,
    initialDelay: 100,       // 100ms
    maxDelay: 30000,         // 30s
    backoffMultiplier: 2,
    jitterFactor: 0.1,
    shouldRetry: (error) => {
      // Custom retry logic
      if (error.message.includes('ERR-5003')) return true; // Rate limit
      if (error.message.includes('ECONNRESET')) return true; // Network
      return false;
    }
  }
);
```

**Automatically retries**: Network timeouts, rate limits (ERR-5003), 5xx errors

### Circuit Breaker Pattern

Prevent cascading failures and rapid retry storms.

```typescript
import { CircuitBreaker } from 'gmo-coin-sdk';

const breaker = new CircuitBreaker(
  async () => fxClient.getAssets(),
  {
    failureThreshold: 5,     // Open after 5 failures
    successThreshold: 2,     // Close after 2 successes
    timeout: 60000          // 1 minute timeout
  }
);

try {
  const assets = await breaker.execute();
  console.log(assets);
} catch (error) {
  if (error.message.includes('CircuitBreakerOpen')) {
    console.error('Circuit breaker is open - service temporarily unavailable');
  }
}

// Check circuit breaker state
const state = breaker.getState();
console.log(`State: ${state.state}`);        // CLOSED, OPEN, or HALF_OPEN
console.log(`Failures: ${state.failureCount}`);
console.log(`Successes: ${state.successCount}`);
```

**States**:
- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Failures exceeded threshold, requests rejected immediately
- **HALF_OPEN**: Testing if service recovered, limited requests allowed

### Unified Pagination

Seamless pagination between FX (cursor-based) and Crypto (offset-based) APIs.

```typescript
// FX API (cursor-based)
const fxOrders1 = await fx.getActiveOrders({
  symbol: 'USD_JPY',
  count: '10'
});

// Get next page using cursor
const fxOrders2 = await fx.getActiveOrders({
  symbol: 'USD_JPY',
  prevId: fxOrders1.data[fxOrders1.data.length - 1].orderId,
  count: '10'
});

// Crypto API (offset-based)
const cryptoOrders1 = await crypto.getActiveOrders({
  symbol: 'BTC',
  limit: '10'
});

const cryptoOrders2 = await crypto.getActiveOrders({
  symbol: 'BTC',
  limit: '10',
  pageSize: '20'
});
```

## Operational Notes

- **Rate limits**: GET ≤ 6/s, POST ≤ 1/s; WS subscribe/unsubscribe ≤ 1/s
- **Time sync**: API validates `API-TIMESTAMP` header against server time; keep clock synchronized
- **Errors**: API throws errors on non-`status:0` responses with HTTP status and GMO API error codes
- **Real trading risk**: This SDK can submit live orders. Thoroughly test in sandbox before production use
- **Token expiry**: WebSocket tokens expire; use `auth.extend(token)` to refresh periodically
- **IP allowlist**: Verify your client IP is allowlisted in GMO Coin API settings for authentication success

## Microservice Deployment

The SDK includes a production-ready Fastify-based microservice that wraps the SDK APIs with enterprise features.

### Quick Start

```bash
# Create environment file
cp .env.example .env

# Edit .env with your credentials
# FX_API_KEY=...
# FX_API_SECRET=...
# CRYPTO_API_KEY=...
# CRYPTO_API_SECRET=...

# Build and start service
npm run build
npm run start:service
```

Default port: `3000` (configurable via `PORT` env var)

### Core Endpoints

#### Health & Metrics
```bash
GET /health                    # Service health check
GET /metrics                   # Prometheus-format metrics
```

#### Account Management
```bash
GET /v1/account/assets         # Get account balance and assets
```

#### Order Management
```bash
GET /v1/orders/active?symbol=USD_JPY&count=50    # Get active orders
POST /v1/orders/limit                             # Place LIMIT order
POST /v1/orders/speed                             # Place SPEED order (market-like)
POST /v1/orders/market                            # Place MARKET order
POST /v1/orders/stop                              # Place STOP order
POST /v1/orders/oco                               # Place OCO order
POST /v1/orders/ifd                               # Place IFD order
POST /v1/orders/ifdoco                            # Place IFDOCO order
POST /v1/orders/cancel                            # Cancel orders
POST /v1/orders/modify                            # Modify order price
```

#### Position Management
```bash
GET /v1/positions/open                # Get open positions
GET /v1/positions/summary             # Get position summary
POST /v1/positions/close              # Close position
```

#### Real-Time Streaming
```bash
GET /v1/stream?topics=execution,order&symbol=USD_JPY    # Server-Sent Events stream
```

### Request/Response Examples

#### Place a LIMIT Order
```bash
curl -X POST http://localhost:3000/v1/orders/limit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "symbol": "USD_JPY",
    "side": "BUY",
    "size": "10000",
    "limitPrice": "130.00"
  }'
```

#### Place a SPEED Order
```bash
curl -X POST http://localhost:3000/v1/orders/speed \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "USD_JPY",
    "side": "BUY",
    "size": "5000"
  }'
```

#### Get Active Orders
```bash
curl http://localhost:3000/v1/orders/active?symbol=USD_JPY&count=10
```

#### Get Metrics
```bash
curl http://localhost:3000/metrics
```

### Authentication Methods

#### Bearer Token (Simple)
```bash
export SERVICE_AUTH_TOKEN="my-secret-token"
npm run start:service

# Include token in requests
curl -H "Authorization: Bearer my-secret-token" http://localhost:3000/v1/account/assets
```

#### JWT with JWKS (Production)
```bash
export SERVICE_AUTH_MODE=jwt
export JWKS_URL=https://your-auth-provider/.well-known/jwks.json
export JWT_ISSUER=https://your-auth-provider
export JWT_AUDIENCE=your-api
npm run start:service
```

### Multi-Tenant Support

Support multiple trading accounts in a single service instance.

```bash
# Configure credentials for each tenant
export FX_API_KEY=base-fx-key
export FX_API_SECRET=base-fx-secret
export FX_API_KEY__tenant1=tenant1-fx-key
export FX_API_SECRET__tenant1=tenant1-fx-secret
export FX_API_KEY__tenant2=tenant2-fx-key
export FX_API_SECRET__tenant2=tenant2-fx-secret

npm run start:service

# Route requests to specific tenant
curl -H "X-Tenant-Id: tenant1" http://localhost:3000/v1/account/assets
curl http://localhost:3000/v1/account/assets?tenant=tenant2
```

### Rate Limiting

#### In-Memory (Default)
Automatic rate limiting (6 GET/s, 1 POST/s, 1 WS/s) with in-memory token bucket.

#### Redis (Distributed)
For multi-instance deployments, use Redis for shared rate limiting:

```bash
export REDIS_URL=redis://localhost:6379
npm run start:service
```

### Idempotency

Prevent duplicate order processing with idempotent keys (10-minute TTL):

```bash
curl -X POST http://localhost:3000/v1/orders/limit \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-123" \
  -d '{
    "symbol": "USD_JPY",
    "side": "BUY",
    "size": "10000",
    "limitPrice": "130.00"
  }'

# Retry with same key returns cached result (10 minutes)
curl -X POST http://localhost:3000/v1/orders/limit \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-123" \
  -d '{
    "symbol": "USD_JPY",
    "side": "BUY",
    "size": "10000",
    "limitPrice": "130.00"
  }'
# Returns same response without re-submitting order
```

### Server-Sent Events Streaming

Real-time updates via Server-Sent Events (WebSocket bridge):

```bash
# Subscribe to execution and order updates
curl "http://localhost:3000/v1/stream?topics=execution,order&symbol=USD_JPY"

# Response (streaming):
# data: {"type":"execution","data":{...}}
# data: {"type":"order","data":{...}}
```

JavaScript client:
```typescript
const eventSource = new EventSource(
  'http://localhost:3000/v1/stream?topics=execution,order&symbol=USD_JPY'
);

eventSource.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Update:', message);
};

eventSource.onerror = (error) => {
  console.error('Stream error:', error);
  eventSource.close();
};
```

### Configuration

#### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `HOST` | 0.0.0.0 | Listen address |
| `LOG_LEVEL` | info | Pino log level |
| `TRUST_PROXY` | false | Trust X-Forwarded-* headers |
| `SERVICE_AUTH_MODE` | optional | Auth method: `none`, `bearer`, `jwt` |
| `SERVICE_AUTH_TOKEN` | - | Bearer token for simple auth |
| `JWKS_URL` | - | JWKS endpoint for JWT validation |
| `JWT_ISSUER` | - | JWT issuer to validate |
| `JWT_AUDIENCE` | - | JWT audience to validate |
| `REDIS_URL` | - | Redis URL for distributed deployments |
| `FX_API_KEY` | - | Base FX API key |
| `FX_API_SECRET` | - | Base FX API secret |
| `CRYPTO_API_KEY` | - | Base Crypto API key |
| `CRYPTO_API_SECRET` | - | Base Crypto API secret |
| `FX_API_KEY__<TENANT>` | - | Tenant-specific FX key |
| `FX_API_SECRET__<TENANT>` | - | Tenant-specific FX secret |

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:service"]
```

```bash
docker build -t gmo-coin-service .

docker run -e FX_API_KEY=... -e FX_API_SECRET=... \
  -e CRYPTO_API_KEY=... -e CRYPTO_API_SECRET=... \
  -p 3000:3000 gmo-coin-service
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gmo-coin-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gmo-coin-service
  template:
    metadata:
      labels:
        app: gmo-coin-service
    spec:
      containers:
      - name: service
        image: gmo-coin-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: PORT
          value: "3000"
        - name: REDIS_URL
          value: redis://redis-service:6379
        envFrom:
        - secretRef:
            name: gmo-coin-credentials
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
```

### Production Checklist

- [ ] Use strong, random `SERVICE_AUTH_TOKEN` or JWT with JWKS
- [ ] Enable HTTPS/TLS in production (use reverse proxy like nginx)
- [ ] Set up Redis for rate limiting and idempotency in multi-instance setup
- [ ] Configure appropriate log levels for debugging
- [ ] Monitor `/metrics` endpoint with Prometheus/Grafana
- [ ] Set up alerts for error rates and latency
- [ ] Test with sandbox credentials before using production keys
- [ ] Implement request rate limiting at load balancer level
- [ ] Use VPC/private networking to restrict access
- [ ] Regularly rotate API keys and tokens
- [ ] Enable audit logging for compliance
- [ ] Set up backup and disaster recovery procedures