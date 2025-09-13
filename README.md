GMO Coin Forex (FX) Private API SDK (Node.js/TypeScript)

Overview
- Typed, minimal-deps client for FX Private REST and Private WebSocket.
- Requires Node 18+ (uses built-in `fetch`). Runtime dep: `ws`.

Quick Start
- Prereqs: Node 18+ and npm.
- Install deps: `npm install`
- Build: `npm run build`
- Set environment variables:
  - macOS/Linux (one-shot): `FX_API_KEY=yourKey FX_API_SECRET=yourSecret npm run examples:rest`
  - macOS/Linux (export then run):
    - `export FX_API_KEY=yourKey`
    - `export FX_API_SECRET=yourSecret`
    - `npm run examples:rest`
  - Windows PowerShell: `$env:FX_API_KEY="yourKey"; $env:FX_API_SECRET="yourSecret"; npm run examples:rest`
  - Windows cmd.exe: `set FX_API_KEY=yourKey && set FX_API_SECRET=yourSecret && npm run examples:rest`
- Run examples: `npm run examples:rest` or `npm run examples:ws`

Basic Usage — REST
- Import: `import { FxPrivateRestClient } from 'fx-sdk'` (when used as a package) or `import { FxPrivateRestClient } from './src/rest.js'` when using in this repo directly.
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

Basic Usage — Private WebSocket
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

Private WS Notes
- Requires a token from `POST /v1/ws-auth`. If token creation fails:
  - Verify API key/secret and that your client IP is allowlisted in GMO Coin settings.
  - You can pass a pre-created token via `WS_TOKEN` env var to the example.

Exports
- `FxPrivateRestClient` for REST.
- `FxPrivateWsAuth` and `FxPrivateWsClient` for Private WS.
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
