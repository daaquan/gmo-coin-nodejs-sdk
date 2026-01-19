# GMO Coin Private API SDK for Forex and Cryptocurrency (Bun/TypeScript)

A modern, enterprise-grade Bun/TypeScript SDK for GMO Coin's Forex (FX) and Cryptocurrency trading APIs. Rebuilt for maximum type safety with TypeScript 5.9+, Zod validation, and the Result pattern.

## Features

### Core Capabilities

- **Modern Toolchain** - Optimized for **Bun** runtime and TypeScript 5.9+
- **Type-Safe Result Pattern** - Explicit error handling with `{ success: true, data: T } | { success: false, error: Error }`
- **SSOT (Single Source of Truth)** - Unified Zod schemas for both validation and type inference
- **REST & WebSocket APIs** - Full coverage for FX and Crypto trading
- **Strict Configuration** - Complies with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`

### Production-Ready Features

- **Rate Limiting** - Automatic management (6 GET/s, 1 POST/s, 1 WS/s)
- **Metrics & Audit** - Prometheus metrics and masked PII audit logging
- **Enterprise Ready** - Built-in Fastify service with JWT auth and multi-tenancy

## Requirements

- **Bun**: 1.2+ (Recommended)
- **Node.js**: 22+ (LTS)

## Quick Installation

```bash
bun add gmo-coin-sdk
```

## Quick Example (Result Pattern)

```typescript
import { FxPrivateRestClient } from 'gmo-coin-sdk';

const fx = new FxPrivateRestClient(process.env.FX_API_KEY!, process.env.FX_API_SECRET!);

// Get account assets with Result pattern
const result = await fx.getAssets();

if (result.success) {
  console.log('Balance:', result.data);
} else {
  console.error('Operation failed:', result.error.message);
}

// Type safety is guaranteed within the success block
```

## API Clients

### REST Clients

| Client                    | API            | Purpose                              |
| ------------------------- | -------------- | ------------------------------------ |
| `FxPrivateRestClient`     | Forex Private  | Trading, order management, positions |
| `CryptoPrivateRestClient` | Crypto Private | Trading, order management, positions |
| `PublicRestClient`        | Public API     | Market data, tickers, orderbook      |

## Development with Bun

```bash
# Install dependencies
bun install

# Build
bun run build

# Test
bun run test

# Run examples directly without building
bun examples/get-crypto-info.ts
```

## License

MIT