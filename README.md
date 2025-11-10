GMO Coin Private API SDK for Forex and Cryptocurrency (Node.js/TypeScript)

Overview
- Typed, minimal-deps client for Forex and Crypto Private REST and WebSocket APIs.
- Supports both Forex (FX) and Cryptocurrency trading.
- Requires Node 18+ (uses built-in `fetch`). Runtime dep: `ws`.

Quick Start
- Prereqs: Node 18+ and npm.
- Install deps: `npm install`
- Build: `npm run build`
- Set environment variables (FX and/or Crypto):
  - macOS/Linux (one-shot): `FX_API_KEY=yourFxKey FX_API_SECRET=yourFxSecret CRYPTO_API_KEY=yourCryptoKey CRYPTO_API_SECRET=yourCryptoSecret npm run examples:rest`
  - macOS/Linux (export then run):
    - `export FX_API_KEY=yourFxKey`
    - `export FX_API_SECRET=yourFxSecret`
    - `export CRYPTO_API_KEY=yourCryptoKey`
    - `export CRYPTO_API_SECRET=yourCryptoSecret`
    - `npm run examples:rest`
  - Windows PowerShell: `$env:FX_API_KEY="yourFxKey"; $env:FX_API_SECRET="yourFxSecret"; $env:CRYPTO_API_KEY="yourCryptoKey"; $env:CRYPTO_API_SECRET="yourCryptoSecret"; npm run examples:rest`
  - Windows cmd.exe: `set FX_API_KEY=yourFxKey && set FX_API_SECRET=yourFxSecret && set CRYPTO_API_KEY=yourCryptoKey && set CRYPTO_API_SECRET=yourCryptoSecret && npm run examples:rest`
- Run examples: `npm run examples:rest` or `npm run examples:ws`

Basic Usage — REST

**Forex (FX):**
- Import: `import { FxPrivateRestClient } from 'gmo-coin-sdk'` (when used as a package) or `import { FxPrivateRestClient } from './src/rest.js'` when using in this repo directly.
- Example:

  ```ts
  import { FxPrivateRestClient } from './src/rest.js';

  const fx = new FxPrivateRestClient(process.env.FX_API_KEY!, process.env.FX_API_SECRET!);

  // Get account assets
  const assets = await fx.getAssets();
  console.log(assets.data);

  // Place a LIMIT order
  const placed = await fx.placeOrder({
    symbol: 'USD_JPY', side: 'BUY', size: '10000',
    executionType: 'LIMIT', limitPrice: '130'
  });

  // Cancel by rootOrderIds
  const ids = placed.data.map(o => o.rootOrderId);
  if (ids.length) await fx.cancelOrders({ rootOrderIds: ids });
  ```

**Cryptocurrency (Crypto):**
- Import: `import { CryptoPrivateRestClient } from 'gmo-coin-sdk'` (when used as a package) or `import { CryptoPrivateRestClient } from './src/rest.js'` when using in this repo directly.
- Example:

  ```ts
  import { CryptoPrivateRestClient } from './src/rest.js';

  const crypto = new CryptoPrivateRestClient(process.env.CRYPTO_API_KEY!, process.env.CRYPTO_API_SECRET!);

  // Get account assets
  const assets = await crypto.getAssets();
  console.log(assets.data);

  // Place an order
  const placed = await crypto.placeOrder({
    symbol: 'BTC', side: 'BUY', executionType: 'MARKET', size: '0.01'
  });

  // Cancel by orderId
  if (placed.data.orderId) {
    await crypto.cancelOrder({ orderId: placed.data.orderId });
  }
  ```

Basic Usage — Private WebSocket

**Forex (FX):**
- Token lifecycle via REST helper, then connect with the token.
- Example:

  ```ts
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

**Cryptocurrency (Crypto):**
- Token lifecycle via REST helper, then connect with the token.
- Example:

  ```ts
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

Private WS Notes
- Requires a token from `POST /v1/ws-auth`. If token creation fails:
  - Verify API key/secret and that your client IP is allowlisted in GMO Coin settings.
  - You can pass a pre-created token via `WS_TOKEN` env var to the example.

Exports
- `FxPrivateRestClient` and `CryptoPrivateRestClient` for REST.
- `FxPrivateWsAuth`, `FxPrivateWsClient`, `CryptoPrivateWsAuth`, and `CryptoPrivateWsClient` for Private WS.
- Types in `src/types.ts`.

Operational Notes
- Rate limits: GET ≤ 6/s, POST ≤ 1/s; WS subscribe/unsubscribe ≤ 1/s.
- Time sync: API compares `API-TIMESTAMP` with server; keep clock accurate.
- Errors: Throws on non-`status:0` with HTTP status and API code/message when available.
- Real trading risk: This SDK can submit live orders. Test carefully before production.

Examples
- REST demo: `examples/private-rest.ts`
- WS demo: `examples/private-ws.ts`

Placing Orders in the REST Example
- The example skips order placement by default to avoid unintended trades.
- To place and then cancel a LIMIT order:
  - `FX_API_KEY=... FX_API_SECRET=... PLACE_LIMIT=1 ORDER_SYMBOL=USD_JPY ORDER_SIDE=BUY ORDER_SIZE=1000 ORDER_LIMIT_PRICE=yourPrice npm run examples:rest`
  - Ensure `ORDER_LIMIT_PRICE` is within the allowed price range and tick size per GMO Coin specs.
- To place and then cancel a SPEED order (market-like):
  - `FX_API_KEY=... FX_API_SECRET=... PLACE_SPEED=1 ORDER_SYMBOL=USD_JPY ORDER_SIDE=BUY ORDER_SIZE=1000 npm run examples:rest`
  - Optional protective bounds: `upperBound`/`lowerBound` are not set in the example; add them in code if needed.

Microservice Usage
- Start the service:
  - `cp .env.example .env` and fill `FX_API_KEY`, `FX_API_SECRET`, `CRYPTO_API_KEY`, `CRYPTO_API_SECRET` (and optional `SERVICE_AUTH_TOKEN`).
  - `npm run start:service`
- Endpoints (local service):
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
- Auth: If `SERVICE_AUTH_TOKEN` is set, include `Authorization: Bearer <token>` in requests. TODO: Replace with JWT/mTLS in production.
- Auth via JWT (JWKS): set `SERVICE_AUTH_MODE=jwt`, `JWKS_URL`, and optional `JWT_ISSUER`/`JWT_AUDIENCE`.
- Rate limiting: If `REDIS_URL` is set, uses Redis fixed-window limiter (GET 6/s, POST 1/s, WS 1/s). Falls back to in-process.
- Idempotency: If `REDIS_URL` is set, uses Redis for `Idempotency-Key` storage; otherwise in-memory.
 - Multi-tenant: Supply `X-Tenant-Id` header or `?tenant=...` to pick creds from `FX_API_KEY__<TENANT>` / `FX_API_SECRET__<TENANT>`; falls back to base.
 - OpenAPI: See `openapi.yaml` for a high-level spec of the service API.
