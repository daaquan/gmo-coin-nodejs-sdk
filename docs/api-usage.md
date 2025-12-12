# API Usage

This guide covers detailed usage of the GMO Coin SDK for REST, WebSocket, and public market data APIs. Covers both Forex (FX) and Cryptocurrency (Crypto) trading with examples for all major operations.

## REST API - FX (Forex)

### Initialization

```typescript
import { FxPrivateRestClient } from 'gmo-coin-sdk';

const fx = new FxPrivateRestClient(process.env.FX_API_KEY!, process.env.FX_API_SECRET!);
```

### Account Operations

```typescript
// Get account assets and balance information
const assets = await fx.getAssets();
console.log('Balance:', assets.data.balance);
console.log('Available:', assets.data.available);
```

### Order Management

#### Place a LIMIT Order
```typescript
const limitOrder = await fx.placeOrder({
  symbol: 'USD_JPY',
  side: 'BUY',
  size: '10000',
  executionType: 'LIMIT',
  limitPrice: '130.00'
});
console.log('Order placed:', limitOrder.data[0]);
```

#### Place a STOP Order
```typescript
const stopOrder = await fx.placeOrder({
  symbol: 'USD_JPY',
  side: 'SELL',
  size: '10000',
  executionType: 'STOP',
  triggerPrice: '131.00'
});
```

#### Place an OCO (One-Cancels-Other) Order
```typescript
const ocoOrder = await fx.placeOrder({
  symbol: 'USD_JPY',
  side: 'BUY',
  size: '10000',
  executionType: 'OCO',
  limitPrice: '130.00',
  triggerPrice: '132.00'
});
```

#### Place a SPEED Order (Market-Like)
```typescript
const speedOrder = await fx.speedOrder({
  symbol: 'USD_JPY',
  side: 'BUY',
  size: '5000'
});
console.log('Speed order executed:', speedOrder.data);
```

#### Place an IFD (If-Done) Order
Two-leg conditional order: entry order triggers a secondary order upon execution.

```typescript
const ifdOrder = await fx.placeIfdOrder({
  symbol: 'USD_JPY',
  side: 'BUY',
  size: '10000',
  firstExecutionType: 'LIMIT',
  firstPrice: '130.00',
  secondExecutionType: 'LIMIT',
  secondPrice: '131.00'
});
```

#### Place an IFDOCO (If-Done-OCO) Order
Three-leg order: entry order triggers OCO order (take-profit and stop-loss).

```typescript
const ifdocoOrder = await fx.placeIfdocoOrder({
  symbol: 'USD_JPY',
  side: 'BUY',
  size: '10000',
  firstExecutionType: 'LIMIT',
  firstPrice: '130.00',
  secondExecutionType: 'LIMIT',
  secondPrice: '131.00',
  thirdExecutionType: 'STOP',
  thirdPrice: '129.00'
});
```

### Query Orders

```typescript
// Get active orders for a symbol
const activeOrders = await fx.getActiveOrders({
  symbol: 'USD_JPY',
  count: '10'
});
console.log('Pending orders:', activeOrders.data);

// Get all active orders across symbols
const allOrders = await fx.getActiveOrders({ count: '50' });

// Pagination with cursor
const nextPage = await fx.getActiveOrders({
  symbol: 'USD_JPY',
  prevId: '12345',  // Previous order ID
  count: '10'
});
```

### Cancel Orders

```typescript
// Cancel specific orders by rootOrderIds
const result = await fx.cancelOrders({
  rootOrderIds: [123, 456, 789]
});
console.log('Cancelled:', result.data);

// Cancel all orders for a symbol
const bulkCancel = await fx.cancelBulk({
  symbol: 'USD_JPY'
});
```

### Modify Orders

```typescript
// Change an order's price
const changeOrder = await fx.changeOrder({
  rootOrderId: 12345,
  price: '131.00'
});

// Change an IFD order
const changeIfd = await fx.changeIfdOrder({
  rootOrderId: 12345,
  firstPrice: '130.50',
  secondPrice: '131.50'
});
```

### Positions

```typescript
// Get open positions for a symbol
const positions = await fx.getOpenPositions({ symbol: 'USD_JPY' });
console.log('Positions:', positions.data);

// Get all positions
const allPositions = await fx.getOpenPositions({});

// Get position summary
const summary = await fx.getPositionSummary({ symbol: 'USD_JPY' });
console.log('Average price:', summary.data.avgPrice);

// Close a position
const closeResult = await fx.closeOrder({
  symbol: 'USD_JPY',
  side: 'SELL',
  size: '10000',
  executionType: 'MARKET'
});
```

### Executions

```typescript
// Get specific execution details
const execution = await fx.getExecutions({ executionId: '123456' });

// Get latest executions for a symbol
const latestExec = await fx.getLatestExecutions({
  symbol: 'USD_JPY',
  count: '20'
});
console.log('Recent fills:', latestExec.data);
```

## REST API - Cryptocurrency

### Initialization

```typescript
import { CryptoPrivateRestClient } from 'gmo-coin-sdk';

const crypto = new CryptoPrivateRestClient(
  process.env.CRYPTO_API_KEY!,
  process.env.CRYPTO_API_SECRET!
);
```

### Account Operations

```typescript
// Get account assets
const assets = await crypto.getAssets();
console.log('Holdings:', assets.data);
```

### Order Management

#### Place a MARKET Order
```typescript
const marketOrder = await crypto.placeOrder({
  symbol: 'BTC',
  side: 'BUY',
  executionType: 'MARKET',
  size: '0.01'
});
```

#### Place a LIMIT Order
```typescript
const limitOrder = await crypto.placeOrder({
  symbol: 'ETH',
  side: 'BUY',
  executionType: 'LIMIT',
  size: '0.5',
  price: '2000.00'
});
```

#### Place a STOP Order
```typescript
const stopOrder = await crypto.placeOrder({
  symbol: 'BTC',
  side: 'SELL',
  executionType: 'STOP',
  size: '0.1',
  triggerPrice: '35000'
});
```

#### Place an OCO Order
```typescript
const ocoOrder = await crypto.placeOcoOrder({
  symbol: 'BTC',
  side: 'BUY',
  size: '0.05',
  limitPrice: '30000',
  triggerPrice: '31000'
});
```

#### Place an IFD Order
```typescript
const ifdOrder = await crypto.placeIfdOrder({
  symbol: 'ETH',
  side: 'BUY',
  size: '1',
  firstExecutionType: 'LIMIT',
  firstPrice: '2000',
  secondExecutionType: 'LIMIT',
  secondPrice: '2100'
});
```

### Query Orders

```typescript
// Get active orders
const activeOrders = await crypto.getActiveOrders({
  symbol: 'BTC',
  pageSize: '10'
});

// Get all active orders
const allOrders = await crypto.getActiveOrders({});

// With pagination (offset-based)
const page2 = await crypto.getActiveOrders({
  symbol: 'ETH',
  limit: '20',
  pageSize: '20'
});
```

### Cancel Orders

```typescript
// Cancel a single order by orderId
if (marketOrder.data.orderId) {
  await crypto.cancelOrder({ orderId: marketOrder.data.orderId });
}

// Cancel multiple orders
const bulkCancel = await crypto.cancelOrders({
  rootOrderIds: [123, 456, 789]
});

// Cancel all orders for a symbol
const allCancel = await crypto.cancelBulk({
  symbol: 'BTC'
});
```

### Modify Orders

```typescript
// Modify an order
const modified = await crypto.changeOrder({
  rootOrderId: 12345,
  price: '2050'
});

// Modify OCO order
const modOco = await crypto.changeOcoOrder({
  rootOrderId: 12345,
  limitPrice: '2100',
  triggerPrice: '2200'
});
```

### Positions

```typescript
// Get open positions
const positions = await crypto.getOpenPositions({ symbol: 'BTC' });

// Get position summary
const summary = await crypto.getPositionSummary({ symbol: 'BTC' });

// Close a position
const close = await crypto.closePosition({
  symbol: 'BTC',
  size: '0.1'
});
```

### Executions

```typescript
// Get execution history
const executions = await crypto.getExecutions({
  symbol: 'BTC'
});

// Get latest executions
const latest = await crypto.getLatestExecutions({
  symbol: 'ETH',
  pageSize: '20'
});
```

## Public Market Data APIs

### FX Market Data

```typescript
import { FxPublicRestClient } from 'gmo-coin-sdk';

const fxPublic = new FxPublicRestClient();

// Get current ticker
const ticker = await fxPublic.getTicker('USD_JPY');
console.log(`Bid: ${ticker.data.bid}, Ask: ${ticker.data.ask}`);

// Get all tickers
const allTickers = await fxPublic.getAllTickers();

// Get order book (depth)
const orderBook = await fxPublic.getOrderBook('USD_JPY', { depth: '20' });
console.log(`Bids: ${orderBook.data.bids.length}, Asks: ${orderBook.data.asks.length}`);

// Get recent trades
const trades = await fxPublic.getTrades('USD_JPY', { count: '100' });
console.log('Latest trades:', trades.data);

// Get candlestick data (OHLCV)
const klines = await fxPublic.getKlines('USD_JPY', '1m', {
  count: '100'
});
console.log('Latest candle:', klines.data[0]);

// Get supported symbols
const symbols = await fxPublic.getSupportedSymbols();
console.log('Available pairs:', symbols.data);
```

### Crypto Market Data

```typescript
import { CryptoPublicRestClient } from 'gmo-coin-sdk';

const cryptoPublic = new CryptoPublicRestClient();

// Get ticker
const ticker = await cryptoPublic.getTicker('BTC');

// Get order book
const book = await cryptoPublic.getOrderBook('ETH');

// Get klines with custom interval
const candles = await cryptoPublic.getKlines('BTC', '1h', {
  count: '24',
  before: '1640000000'
});

// Get supported symbols
const symbols = await cryptoPublic.getSupportedSymbols();
```

### Caching

Public APIs automatically cache responses with a 1-second TTL:

```typescript
const public = new FxPublicRestClient(undefined, 5000); // 5s TTL

const ticker1 = await public.getTicker('USD_JPY'); // Fetches from API
const ticker2 = await public.getTicker('USD_JPY'); // Returns cached (within 5s)
```

## WebSocket Usage

### Forex (FX) WebSocket

#### Token Lifecycle and Connection

```typescript
import { FxPrivateWsAuth, FxPrivateWsClient } from 'gmo-coin-sdk';

// Step 1: Create authentication token
const auth = new FxPrivateWsAuth(process.env.FX_API_KEY!, process.env.FX_API_SECRET!);
const tokenResponse = await auth.create();
const token = tokenResponse.data.token;

// Step 2: Connect WebSocket
const ws = new FxPrivateWsClient(token);
await ws.connect();

// Step 3: Register message listener
ws.onMessage(msg => {
  console.log('WebSocket message:', msg);
});

// Step 4: Subscribe to streams
await ws.subscribe('execution');  // Real-time execution updates
await ws.subscribe('order');      // Order status changes
await ws.subscribe('position');   // Position updates

// Step 5: Handle connection close
ws.onClose(() => {
  console.log('WebSocket closed');
});

// Step 6: Handle errors
ws.onError((error) => {
  console.error('WebSocket error:', error);
});

// Step 7: Close connection when done
await ws.close();

// Optional: Revoke token when completely done
// await auth.revoke(token);
```

#### Available Subscription Channels

| Channel | Description |
|---------|-------------|
| `execution` | Real-time execution fills and details |
| `order` | Order status changes (placed, updated, cancelled) |
| `position` | Position changes and updates |
| `positionSummary` | Summary information about positions |

#### Token Management

```typescript
// Create a new token
const created = await auth.create();
const token = created.data.token;

// Extend token expiry
const extended = await auth.extend(token);

// Revoke token (good practice when done)
await auth.revoke(token);
```

#### Symbol-Based Subscriptions

```typescript
// Subscribe to specific symbol
await ws.subscribe('execution', { symbol: 'USD_JPY' });

// Unsubscribe from symbol
await ws.unsubscribe('execution', { symbol: 'USD_JPY' });
```

### Cryptocurrency (Crypto) WebSocket

```typescript
import { CryptoPrivateWsAuth, CryptoPrivateWsClient } from 'gmo-coin-sdk';

// Create auth token for Crypto
const auth = new CryptoPrivateWsAuth(
  process.env.CRYPTO_API_KEY!,
  process.env.CRYPTO_API_SECRET!
);
const token = (await auth.create()).data.token;

// Connect Crypto WebSocket
const ws = new CryptoPrivateWsClient(token);
await ws.connect();

ws.onMessage(msg => {
  console.log('Crypto update:', msg);
});

// Subscribe to crypto streams
await ws.subscribe('execution');
await ws.subscribe('order');
await ws.subscribe('position');

// When done
await ws.close();
```

### WebSocket Best Practices

#### Error Handling and Reconnection

```typescript
async function connectWithRetry() {
  const auth = new FxPrivateWsAuth(apiKey, secret);

  let retries = 0;
  const maxRetries = 5;

  while (retries < maxRetries) {
    try {
      const token = (await auth.create()).data.token;
      const ws = new FxPrivateWsClient(token);

      await ws.connect();

      ws.onMessage(msg => {
        console.log('Message:', msg);
      });

      ws.onClose(async () => {
        console.log('Connection closed, reconnecting...');
        // Implement reconnection logic
      });

      await ws.subscribe('execution');
      return ws;

    } catch (error) {
      retries++;
      console.error(`Connection attempt ${retries} failed:`, error);

      if (retries < maxRetries) {
        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, retries) * 1000)
        );
      }
    }
  }

  throw new Error('Failed to connect after max retries');
}
```

#### Token Reuse

```typescript
// Pre-created token from environment
const preCreatedToken = process.env.WS_TOKEN;

if (preCreatedToken) {
  const ws = new FxPrivateWsClient(preCreatedToken);
  await ws.connect();
} else {
  // Create new token
  const auth = new FxPrivateWsAuth(apiKey, secret);
  const token = (await auth.create()).data.token;
  const ws = new FxPrivateWsClient(token);
  await ws.connect();
}
```

### WebSocket Notes

- Requires a token from `POST /v1/ws-auth`. If token creation fails, verify:
  - API key and secret are correct
  - Your client IP is allowlisted in GMO Coin settings
  - Server time is synchronized (API uses timestamp validation)
- Auto-reconnect: SDK sends ping every 55 seconds to keep connection alive
- You can pass a pre-created token via `WS_TOKEN` environment variable to examples
- Token expiry: Extend tokens periodically with `auth.extend(token)`

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