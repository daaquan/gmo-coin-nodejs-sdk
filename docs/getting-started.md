# Getting Started

## Overview

This SDK provides a typed, production-ready client for GMO Coin's Forex (FX) and Cryptocurrency (Crypto) Private REST and WebSocket APIs, as well as public market data APIs. Supports both FX and Crypto trading with advanced features like rate limiting, caching, metrics, and audit logging.

**Requirements:**
- **Node.js**: 18+ (uses built-in `fetch`)
- **Runtime dependency**: `ws` (WebSocket client)
- **Optional**: Redis for distributed deployments

## Installation

### Option 1: Install as Package
```bash
npm install gmo-coin-sdk
```

### Option 2: Use From Repository
```bash
git clone https://github.com/yourusername/gmo-coin-nodejs-sdk.git
cd gmo-coin-nodejs-sdk
npm install
npm run build
```

## Environment Setup

You need to set environment variables for API authentication. Get your API keys from the GMO Coin dashboard under API settings.

### macOS/Linux (One-time setup)
```bash
FX_API_KEY=yourFxKey FX_API_SECRET=yourFxSecret CRYPTO_API_KEY=yourCryptoKey CRYPTO_API_SECRET=yourCryptoSecret npm run examples:rest
```

### macOS/Linux (Export and run)
```bash
export FX_API_KEY=yourFxKey
export FX_API_SECRET=yourFxSecret
export CRYPTO_API_KEY=yourCryptoKey
export CRYPTO_API_SECRET=yourCryptoSecret
npm run examples:rest
```

### Windows PowerShell
```powershell
$env:FX_API_KEY="yourFxKey"; $env:FX_API_SECRET="yourFxSecret"; $env:CRYPTO_API_KEY="yourCryptoKey"; $env:CRYPTO_API_SECRET="yourCryptoSecret"; npm run examples:rest
```

### Windows Command Prompt
```cmd
set FX_API_KEY=yourFxKey && set FX_API_SECRET=yourFxSecret && set CRYPTO_API_KEY=yourCryptoKey && set CRYPTO_API_SECRET=yourCryptoSecret && npm run examples:rest
```

### Using .env File
Create a `.env` file in the project root:
```
FX_API_KEY=yourFxKey
FX_API_SECRET=yourFxSecret
CRYPTO_API_KEY=yourCryptoKey
CRYPTO_API_SECRET=yourCryptoSecret
```

Then run examples:
```bash
npm run examples:rest
```

## Building the Project

```bash
npm run build
```

This compiles TypeScript source files to JavaScript in the `dist/` directory.

## Quick Start Examples

### Run REST API Examples
```bash
npm run examples:rest
```

Shows account assets, active orders, and order placement/cancellation for both FX and Crypto.

### Run WebSocket Examples
```bash
npm run examples:ws
```

Demonstrates real-time WebSocket streaming for execution and order updates.

## Basic Usage Examples

### FX (Forex) REST API

```typescript
import { FxPrivateRestClient } from 'gmo-coin-sdk';

const fx = new FxPrivateRestClient(process.env.FX_API_KEY!, process.env.FX_API_SECRET!);

// Get account assets
const assets = await fx.getAssets();
console.log('Assets:', assets.data);

// Place a LIMIT order
const placed = await fx.placeOrder({
  symbol: 'USD_JPY',
  side: 'BUY',
  size: '10000',
  executionType: 'LIMIT',
  limitPrice: '130'
});
console.log('Order placed:', placed.data);

// Get active orders
const activeOrders = await fx.getActiveOrders({ symbol: 'USD_JPY' });
console.log('Active orders:', activeOrders.data);

// Cancel orders
const orderIds = placed.data.map(o => o.rootOrderId);
if (orderIds.length) {
  await fx.cancelOrders({ rootOrderIds: orderIds });
}
```

### Cryptocurrency REST API

```typescript
import { CryptoPrivateRestClient } from 'gmo-coin-sdk';

const crypto = new CryptoPrivateRestClient(process.env.CRYPTO_API_KEY!, process.env.CRYPTO_API_SECRET!);

// Get account assets
const assets = await crypto.getAssets();
console.log('Assets:', assets.data);

// Place a MARKET order
const order = await crypto.placeOrder({
  symbol: 'BTC',
  side: 'BUY',
  executionType: 'MARKET',
  size: '0.01'
});
console.log('Order placed:', order.data);

// Get active orders
const activeOrders = await crypto.getActiveOrders({ symbol: 'BTC' });
console.log('Active orders:', activeOrders.data);

// Cancel an order
if (order.data.orderId) {
  await crypto.cancelOrder({ orderId: order.data.orderId });
}
```

### WebSocket Real-Time Updates

```typescript
import { FxPrivateWsAuth, FxPrivateWsClient } from 'gmo-coin-sdk';

// Create authentication token
const auth = new FxPrivateWsAuth(process.env.FX_API_KEY!, process.env.FX_API_SECRET!);
const tokenResponse = await auth.create();
const token = tokenResponse.data.token;

// Connect WebSocket
const ws = new FxPrivateWsClient(token);
await ws.connect();

// Listen to messages
ws.onMessage(msg => {
  console.log('Received:', msg);
});

// Subscribe to streams
await ws.subscribe('execution');  // Execution updates
await ws.subscribe('order');      // Order status changes
await ws.subscribe('position');   // Position changes

// Keep connection alive or add your logic here
setTimeout(async () => {
  await ws.close();
}, 60000);

// Don't forget to revoke token when done (optional)
// await auth.revoke(token);
```

### Crypto WebSocket

```typescript
import { CryptoPrivateWsAuth, CryptoPrivateWsClient } from 'gmo-coin-sdk';

const auth = new CryptoPrivateWsAuth(process.env.CRYPTO_API_KEY!, process.env.CRYPTO_API_SECRET!);
const token = (await auth.create()).data.token;

const ws = new CryptoPrivateWsClient(token);
await ws.connect();

ws.onMessage(msg => console.log('Crypto update:', msg));
await ws.subscribe('execution');

// ... your logic ...

await ws.close();
```

### Public Market Data

```typescript
import { FxPublicRestClient } from 'gmo-coin-sdk';

const public = new FxPublicRestClient();

// Get current ticker
const ticker = await public.getTicker('USD_JPY');
console.log('Bid:', ticker.data.bid, 'Ask:', ticker.data.ask);

// Get order book
const orderBook = await public.getOrderBook('USD_JPY');
console.log('Bids:', orderBook.data.bids.length, 'Asks:', orderBook.data.asks.length);

// Get candlestick data
const klines = await public.getKlines('USD_JPY', '1m', { count: 100 });
console.log('Latest candle:', klines.data[klines.data.length - 1]);

// Get supported symbols
const symbols = await public.getSupportedSymbols();
console.log('Available FX pairs:', symbols.data);
```

## Error Handling

```typescript
import { FxPrivateRestClient } from 'gmo-coin-sdk';

const fx = new FxPrivateRestClient(apiKey, secret);

try {
  const assets = await fx.getAssets();
  console.log(assets.data);
} catch (error) {
  if (error.message.includes('ERR-201')) {
    console.error('Insufficient balance');
  } else if (error.message.includes('ERR-5003')) {
    console.error('Rate limit exceeded - please wait');
  } else if (error.message.includes('ERR-5008')) {
    console.error('Timestamp mismatch - check system time');
  } else {
    console.error('API error:', error.message);
  }
}
```

## Development Commands

```bash
# Build the project
npm run build

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch

# Lint TypeScript code
npm run lint

# Run REST API examples
npm run examples:rest

# Run WebSocket examples
npm run examples:ws

# Start microservice
npm run start:service
```

## Supported Symbols

### Forex (FX) - 18 Pairs
USD/JPY, EUR/JPY, GBP/JPY, AUD/JPY, NZD/JPY, CAD/JPY, CHF/JPY, ZAR/JPY, and more

### Cryptocurrency - 25 Tokens
BTC, ETH, BCH, LTC, XRP, XEM, MONA, LSK, FCT, XLM, QTUM, BAT, OMG, XTZ, DOT, ENJ, ATOM, ADA, MKR, DAI, LINK, DOGE, SHIB, MATIC, AVAX

## Next Steps

- See [API Usage](api-usage.md) for detailed examples of all API methods
- See [Advanced Features](advanced.md) for production-ready patterns, metrics, audit logging, and service deployment
- Check [examples/](../examples/) directory for working code samples