# API Usage

This guide covers the basic usage of the GMO Coin SDK for both REST and WebSocket APIs, supporting both Forex (FX) and Cryptocurrency (Crypto) trading.

## REST API Usage

### Forex (FX)

#### Import
```typescript
import { FxPrivateRestClient } from 'gmo-coin-sdk'; // when used as a package
// or
import { FxPrivateRestClient } from './src/rest.js'; // when using in this repo directly
```

#### Basic Example
```typescript
const fx = new FxPrivateRestClient(process.env.FX_API_KEY!, process.env.FX_API_SECRET!);

// Get account assets
const assets = await fx.getAssets();
console.log(assets.data);

// Place a LIMIT order
const placed = await fx.placeOrder({
  symbol: 'USD_JPY',
  side: 'BUY',
  size: '10000',
  executionType: 'LIMIT',
  limitPrice: '130'
});

// Cancel by rootOrderIds
const ids = placed.data.map(o => o.rootOrderId);
if (ids.length) await fx.cancelOrders({ rootOrderIds: ids });
```

#### Additional Operations
```typescript
// Get active orders
const activeOrders = await fx.getActiveOrders({ symbol: 'USD_JPY', count: '10' });

// Get open positions
const positions = await fx.getOpenPositions({ symbol: 'USD_JPY' });

// Get latest executions
const executions = await fx.getLatestExecutions({ symbol: 'USD_JPY', count: '20' });

// Place SPEED order (market-like)
const speedOrder = await fx.speedOrder({
  symbol: 'USD_JPY',
  side: 'SELL',
  size: '1000'
});

// Place IFD order
const ifdOrder = await fx.placeIfdOrder({
  symbol: 'USD_JPY',
  side: 'BUY',
  size: '1000',
  firstExecutionType: 'LIMIT',
  firstPrice: '150.00',
  secondExecutionType: 'LIMIT',
  secondPrice: '151.00'
});
```

### Cryptocurrency (Crypto)

#### Import
```typescript
import { CryptoPrivateRestClient } from 'gmo-coin-sdk'; // when used as a package
// or
import { CryptoPrivateRestClient } from './src/rest.js'; // when using in this repo directly
```

#### Basic Example
```typescript
const crypto = new CryptoPrivateRestClient(process.env.CRYPTO_API_KEY!, process.env.CRYPTO_API_SECRET!);

// Get account assets
const assets = await crypto.getAssets();
console.log(assets.data);

// Place an order
const placed = await crypto.placeOrder({
  symbol: 'BTC',
  side: 'BUY',
  executionType: 'MARKET',
  size: '0.01'
});

// Cancel by orderId
if (placed.data.orderId) {
  await crypto.cancelOrder({ orderId: placed.data.orderId });
}
```

#### Additional Operations
Similar to FX, Crypto supports getting active orders, positions, executions, etc. with symbol-specific parameters.

## WebSocket Usage

### Forex (FX)

#### Token Lifecycle and Connection
```typescript
import { FxPrivateWsAuth, FxPrivateWsClient } from './src/ws-private.js';

const auth = new FxPrivateWsAuth(process.env.FX_API_KEY!, process.env.FX_API_SECRET!);
const token = (await auth.create()).data.token;

const ws = new FxPrivateWsClient(token);
await ws.connect();
ws.onMessage(msg => console.log('WS:', msg));

await ws.subscribe('execution');
await ws.subscribe('order');

// ...later
await ws.close();
// await auth.revoke(token);
```

#### Subscribable Channels
- `execution`: Execution information
- `order`: Order status changes
- `position`: Position changes
- `positionSummary`: Position summary

### Cryptocurrency (Crypto)

#### Token Lifecycle and Connection
```typescript
import { CryptoPrivateWsAuth, CryptoPrivateWsClient } from './src/ws-private.js';

const auth = new CryptoPrivateWsAuth(process.env.CRYPTO_API_KEY!, process.env.CRYPTO_API_SECRET!);
const token = (await auth.create()).data.token;

const ws = new CryptoPrivateWsClient(token);
await ws.connect();
ws.onMessage(msg => console.log('WS:', msg));

await ws.subscribe('execution');
await ws.subscribe('order');

// ...later
await ws.close();
// await auth.revoke(token);
```

#### Subscribable Channels
Similar to FX: `execution`, `order`, etc.

### WebSocket Notes
- Requires a token from `POST /v1/ws-auth`. If token creation fails, verify API key/secret and that your client IP is allowlisted in GMO Coin settings.
- You can pass a pre-created token via `WS_TOKEN` env var to the example.

## Error Handling

The SDK throws errors on non-`status:0` responses with HTTP status and API code/message when available. Implement proper error handling for both FX and Crypto operations.

### General Error Patterns
```typescript
import { FxPrivateRestClient, CryptoPrivateRestClient } from 'gmo-coin-sdk';

const fxClient = new FxPrivateRestClient(process.env.FX_API_KEY!, process.env.FX_API_SECRET!);
const cryptoClient = new CryptoPrivateRestClient(process.env.CRYPTO_API_KEY!, process.env.CRYPTO_API_SECRET!);

async function safeApiCall(client: FxPrivateRestClient | CryptoPrivateRestClient) {
  try {
    const result = await client.getAssets();
    return result.data;
  } catch (error) {
    // Handle errors based on type
    if (error.message.includes('ERR-201')) {
      console.error('Insufficient balance');
    } else if (error.message.includes('ERR-5003')) {
      console.error('Rate limit exceeded. Please wait');
    } else if (error.message.includes('ERR-5008') || error.message.includes('ERR-5009')) {
      console.error('Timestamp mismatch. Check system time');
    } else {
      console.error('Unexpected error:', error.message);
    }
    throw error; // Re-throw if needed
  }
}
```

### Common Error Codes
- `ERR-201`: Insufficient balance
- `ERR-5003`: Rate limit exceeded
- `ERR-5008/5009`: Timestamp mismatch (system time sync required)
- `ERR-760`: No price change
- `ERR-761`: Order rate exceeds price limit range

### WebSocket Error Handling
```typescript
import { FxPrivateWsClient, CryptoPrivateWsClient } from 'gmo-coin-sdk';

async function handleWebSocketErrors(ws: FxPrivateWsClient | CryptoPrivateWsClient) {
  try {
    await ws.connect();

    ws.onMessage((msg) => {
      if (msg.type === 'error') {
        console.error('WebSocket error:', msg.data);
        // Implement reconnection logic if needed
      } else {
        console.log('Data:', msg);
      }
    });

  } catch (error) {
    console.error('WebSocket connection error:', error);
    // Implement exponential backoff for retries
  }
}
```

## Rate Limiting

The SDK automatically manages API rate limits. Be aware of the following specifications:

### Rate Limit Specifications
- **GET requests**: 6 per second
- **POST requests**: 1 per second
- **WebSocket messages**: 1 per second

### Automatic Rate Limiting Behavior
```typescript
const fxClient = new FxPrivateRestClient(apiKey, secret);
const cryptoClient = new CryptoPrivateRestClient(cryptoApiKey, cryptoSecret);

// SDK automatically manages intervals
await fxClient.getAssets();      // GET: executes immediately
await fxClient.placeOrder(...);  // POST: waits 1 second
await cryptoClient.getAssets();  // GET: executes immediately (up to 6/s OK)
```

### Rate Limit Exceeded Behavior
If rate limits are exceeded, the SDK automatically delays requests. However, sending many requests in a short time may cause slower responses.

### Optimization Tips
```typescript
async function efficientTrading(client: FxPrivateRestClient | CryptoPrivateRestClient) {
  // 1. Check current state first
  const [assets, positions, activeOrders] = await Promise.all([
    client.getAssets(),
    client.getOpenPositions(),
    client.getActiveOrders()
  ]);

  // 2. Execute only necessary orders
  if (positions.data.length < 5) {
    await client.placeOrder({
      symbol: 'USD_JPY', // or 'BTC' for crypto
      side: 'BUY',
      size: '1000',
      executionType: 'LIMIT',
      limitPrice: '150.00'
    });
  }

  // 3. Monitor periodically with intervals
  setInterval(async () => {
    const latest = await client.getLatestExecutions({ symbol: 'USD_JPY', count: '5' });
    console.log('Latest executions:', latest.data);
  }, 10000); // 10-second intervals
}
```

### Custom Rate Limiter Usage
If needed, implement custom rate limiting:
```typescript
import { FixedGate } from 'gmo-coin-sdk';

// Custom rate gate (2 requests/second)
const customGate = new FixedGate(2);

async function customRateLimitedCall() {
  await customGate.wait(); // Wait for rate limit
  // API call
}