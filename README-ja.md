GMOコイン FX Private API SDK (Node.js/TypeScript)

概要
- GMOコインのFX Private RESTおよびPrivate WebSocket向けの型付き・最小依存のSDKです。
- Node 18+ が必要です（組み込みの `fetch` を使用）。ランタイム依存は `ws` のみ。

クイックスタート
- 前提: Node 18+ と npm。
- 依存インストール: `npm install`
- ビルド: `npm run build`
- 環境変数を設定:
  - macOS/Linux（ワンショット）: `FX_API_KEY=yourKey FX_API_SECRET=yourSecret npm run examples:rest`
  - macOS/Linux（exportしてから実行）:
    - `export FX_API_KEY=yourKey`
    - `export FX_API_SECRET=yourSecret`
    - `npm run examples:rest`
  - Windows PowerShell: `$env:FX_API_KEY="yourKey"; $env:FX_API_SECRET="yourSecret"; npm run examples:rest`
  - Windows cmd.exe: `set FX_API_KEY=yourKey && set FX_API_SECRET=yourSecret && npm run examples:rest`
- サンプル実行: `npm run examples:rest` または `npm run examples:ws`

基本的な使い方 — REST
- インポート: パッケージとして使う場合は `import { FxPrivateRestClient } from 'fx-sdk'`。このリポジトリを直接使う場合は `import { FxPrivateRestClient } from './src/rest.js'`。
- 例:

  ```ts
  import { FxPrivateRestClient } from './src/rest.js';

  const fx = new FxPrivateRestClient(process.env.FX_API_KEY!, process.env.FX_API_SECRET!);

  // 資産情報の取得
  const assets = await fx.getAssets();
  console.log(assets.data);

  // 指値注文（LIMIT）
  const placed = await fx.placeOrder({
    symbol: 'USD_JPY', side: 'BUY', size: '10000',
    executionType: 'LIMIT', limitPrice: '130'
  });

  // rootOrderId でキャンセル
  const ids = placed.data.map(o => o.rootOrderId);
  if (ids.length) await fx.cancelOrders({ rootOrderIds: ids });
  ```

基本的な使い方 — Private WebSocket
- まず REST でアクセストークンを発行し、そのトークンでWSに接続します。
- 例:

  ```ts
  import { FxPrivateWsAuth, FxPrivateWsClient } from './src/ws-private.js';

  const auth = new FxPrivateWsAuth(process.env.FX_API_KEY!, process.env.FX_API_SECRET!);
  const token = (await auth.create()).data.token;

  const ws = new FxPrivateWsClient(token);
  await ws.connect();
  ws.onMessage(msg => console.log('WS:', msg));

  await ws.subscribe('execution');
  await ws.subscribe('order');

  // ...終了時
  await ws.close();
  // await auth.revoke(token);
  ```

Private WS の注意点
- `POST /v1/ws-auth` で発行するトークンが必要です。発行に失敗する場合:
  - APIキー/シークレットが正しいか、クライアントIPがGMOコイン側で許可リストに登録されているか確認してください。
  - 既に発行済みのトークンがある場合は、環境変数 `WS_TOKEN` で例に渡すこともできます。

エクスポート
- REST クライアント: `FxPrivateRestClient`
- Private WS: `FxPrivateWsAuth`, `FxPrivateWsClient`
- 型定義: `src/types.ts`

運用上の注意
- レート制限: GET ≤ 6/秒, POST ≤ 1/秒; WSのsubscribe/unsubscribe ≤ 1/秒。
- 時刻同期: APIは `API-TIMESTAMP` を検証します。システム時計を正確に保ってください。
- エラー: HTTPステータスとAPIのコード/メッセージ（可能な場合）を含めて例外として投げます。
- 実取引のリスク: 本SDKは実際の注文を発注できます。サンドボックスや検証を十分に行ってから本番運用を行ってください。

サンプル
- REST デモ: `examples/private-rest.ts`
- WS デモ: `examples/private-ws.ts`

RESTサンプルでの注文について
- 既定では意図しない取引を避けるため、注文発注はスキップします。
- 指値注文（LIMIT）を発注してすぐキャンセルするには:
  - `FX_API_KEY=... FX_API_SECRET=... PLACE_LIMIT=1 ORDER_SYMBOL=USD_JPY ORDER_SIDE=BUY ORDER_SIZE=1000 ORDER_LIMIT_PRICE=価格 npm run examples:rest`
  - `ORDER_LIMIT_PRICE` は許容範囲・刻みに合う現実的な価格を指定してください（ERR-761対策）。
- スピード注文（SPEED／成行相当）を発注してすぐキャンセルするには:
  - `FX_API_KEY=... FX_API_SECRET=... PLACE_SPEED=1 ORDER_SYMBOL=USD_JPY ORDER_SIDE=BUY ORDER_SIZE=1000 npm run examples:rest`
  - 保護価格（upperBound/lowerBound）は例では未指定です。必要ならコードに追加してください。

マイクロサービスとしての利用
- 起動手順:
  - `cp .env.example .env` を作成し、`FX_API_KEY`, `FX_API_SECRET`（任意で `SERVICE_AUTH_TOKEN`）を設定
  - `npm run start:service`
- エンドポイント（ローカルサービス）:
  - `GET /health`
  - `GET /v1/account/assets`
  - `GET /v1/orders/active?symbol=USD_JPY&count=50`
  - `POST /v1/orders/limit` 本文 `{ symbol, side, size, limitPrice, clientOrderId?, expireDate?, settleType? }`
  - `POST /v1/orders/speed` 本文 `{ symbol, side, size, clientOrderId?, upperBound?, lowerBound?, isHedgeable? }`
  - `POST /v1/orders/cancel` 本文 `{ rootOrderIds: number[] }`
  - `GET /v1/positions/open`
  - `GET /v1/positions/summary`
  - `GET /v1/stream?topics=execution,order&symbol=USD_JPY`（SSE）
  - `GET /metrics`（Prometheus 形式）
- 認証: `SERVICE_AUTH_TOKEN` を設定した場合、`Authorization: Bearer <token>` を付与。
- JWT（JWKS）認証: `SERVICE_AUTH_MODE=jwt` と `JWKS_URL`（必要に応じて `JWT_ISSUER`/`JWT_AUDIENCE`）を設定。
- レート制限: `REDIS_URL` を設定すると Redis の固定ウィンドウ制限（GET 6/s, POST 1/s, WS 1/s）を使用。未設定時はプロセス内制限。
- 冪等: `REDIS_URL` 設定時は Redis に `Idempotency-Key` を保存。未設定時はメモリ保持。
 - マルチテナント: `X-Tenant-Id` ヘッダ または `?tenant=...` でテナントを指定。`FX_API_KEY__<TENANT>` / `FX_API_SECRET__<TENANT>` が使われ、なければベースの環境変数を使用。
 - OpenAPI: サービスAPIの概要は `openapi.yaml` を参照。
