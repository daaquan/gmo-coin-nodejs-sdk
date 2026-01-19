# GMO Coin Private API SDK for Forex and Cryptocurrency (Node.js/TypeScript)

A typed, production-ready Node.js/TypeScript SDK for GMO Coin's Forex (FX) and Cryptocurrency trading APIs. Provides seamless integration with both REST and WebSocket APIs for automated trading, account management, and real-time data streaming.

## Features

### Core Capabilities

- **REST & WebSocket APIs** - Both Forex and Cryptocurrency private and public APIs
- **Multiple Client Types** - Separate clients for FX and Crypto with auto-detection
- **Forex (FX)** - 18 supported currency pairs (USD/JPY, EUR/JPY, etc.)
- **Cryptocurrency** - 25 supported tokens (BTC, ETH, etc.)
- **Advanced Order Types** - LIMIT, MARKET, STOP, OCO, IFD, IFDOCO orders

### Production-Ready Features

- **Rate Limiting** - Automatic management (6 GET/s, 1 POST/s, 1 WS/s)
- **Request Caching** - TTL-based in-memory cache for public APIs
- **Retry & Circuit Breaker** - Exponential backoff and failure prevention
- **Metrics Collection** - Per-endpoint and operation tracking with Prometheus export
- **Audit Logging** - Comprehensive logging with automatic PII masking
- **Input Validation** - Zod-based schema validation for all requests
- **Error Handling** - Detailed error categorization and recovery strategies

### Enterprise Features

- **Microservice** - Fastify-based REST wrapper with rate limiting, idempotency, and multi-tenancy
- **Redis Support** - Optional distributed caching and rate limiting
- **Multi-Tenant** - Support for multiple credential sets
- **Idempotency** - Prevent duplicate order processing
- **JWT Authentication** - Token-based service authentication
- **Server-Sent Events** - WebSocket-to-SSE bridge for streaming

## Requirements

- **Node.js**: 18+ (uses built-in `fetch`)
- **Runtime Dependency**: `ws` (WebSocket client)
- **Optional**: Redis for distributed deployments

## Quick Installation

```bash
npm install gmo-coin-sdk
```

## Quick Example

```typescript
import { FxPrivateRestClient } from 'gmo-coin-sdk';

const fx = new FxPrivateRestClient(process.env.FX_API_KEY!, process.env.FX_API_SECRET!);

// Get account assets
const assets = await fx.getAssets();
console.log('Balance:', assets.data);

// Place a LIMIT order
const order = await fx.placeOrder({
  symbol: 'USD_JPY',
  side: 'BUY',
  size: '10000',
  executionType: 'LIMIT',
  limitPrice: '130',
});

// Cancel orders
if (order.data[0]) {
  await fx.cancelOrders({ rootOrderIds: [order.data[0].rootOrderId] });
}
```

## API Clients

### REST Clients

| Client                    | API            | Purpose                              |
| ------------------------- | -------------- | ------------------------------------ |
| `FxPrivateRestClient`     | Forex Private  | Trading, order management, positions |
| `FxPublicRestClient`      | Forex Public   | Market data, tickers, orderbook      |
| `CryptoPrivateRestClient` | Crypto Private | Trading, order management, positions |
| `CryptoPublicRestClient`  | Crypto Public  | Market data, tickers, orderbook      |

### WebSocket Clients

| Client                  | API            | Purpose                                      |
| ----------------------- | -------------- | -------------------------------------------- |
| `FxPrivateWsClient`     | Forex Private  | Real-time execution, order, position updates |
| `FxPrivateWsAuth`       | Forex Auth     | WebSocket token creation and revocation      |
| `CryptoPrivateWsClient` | Crypto Private | Real-time crypto updates                     |
| `CryptoPrivateWsAuth`   | Crypto Auth    | WebSocket token management                   |
| `FxPublicWsClient`      | Forex Public   | Real-time ticker data (no auth required)     |
| `CryptoPublicWsClient`  | Crypto Public  | Real-time ticker data (no auth required)     |

## Documentation

- **[Getting Started](docs/getting-started.md)** - Installation, setup, and basic usage
- **[API Usage](docs/api-usage.md)** - Detailed REST and WebSocket examples
- **[Advanced Features](docs/advanced.md)** - Production features, metrics, audit logging, service deployment

## Examples

The SDK includes comprehensive examples demonstrating:

- REST API operations for FX and Crypto
- WebSocket streaming and real-time updates
- Error handling and retry patterns
- Order placement and cancellation

Run examples:

```bash
npm run examples:rest
npm run examples:ws
```

## Key API Methods

### FxPrivateRestClient

```typescript
getAssets();
getActiveOrders(options);
getOpenPositions(options);
getLatestExecutions(options);
placeOrder(order);
speedOrder(order);
cancelOrders(ids);
```

### CryptoPrivateRestClient

```typescript
getAssets();
getActiveOrders(options);
getOpenPositions(options);
placeOrder(order);
placeOcoOrder(order);
cancelOrder(orderId);
cancelOrders(ids);
```

### WebSocket

**Private WebSocket (requires authentication):**

```typescript
const auth = new FxPrivateWsAuth(apiKey, secret);
const token = (await auth.create()).data.token;
const ws = new FxPrivateWsClient(token);
await ws.connect();
ws.onMessage((msg) => console.log(msg));
await ws.subscribe('execution');
```

**Public WebSocket (no authentication):**

```typescript
const ws = new FxPublicWsClient();
await ws.connect();
ws.onMessage((msg) => console.log(msg));
await ws.subscribe('USD_JPY');
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm run test
npm run test:coverage

# Lint
npm run lint

# Run service
npm run start:service
```

## License

MIT
