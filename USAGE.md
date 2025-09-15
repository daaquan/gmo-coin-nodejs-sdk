# GMO Coin Forex (FX) Private API SDK 使用ガイド

## 導入

このSDKは、GMO CoinのForex (FX) Private APIをNode.js/TypeScriptで利用するためのライブラリです。REST APIとWebSocketの両方をサポートしており、資産管理、注文の配置・取消、リアルタイムデータの購読などが可能です。

主な機能:
- REST APIクライアント (`FxPrivateRestClient`)
- WebSocketクライアント (`FxPrivateWsClient`)
- 自動レートリミッティング
- エラーハンドリング

## インストール

### npmからインストールする場合
```bash
npm install fx-sdk
```

### ローカル開発の場合
```bash
git clone https://github.com/your-repo/gmo-coin-nodejs-sdk.git
cd gmo-coin-nodejs-sdk
npm install
npm run build
```

Node.js 18以上が必要です。

## 認証設定

GMO CoinのPrivate APIを使用するには、APIキーとシークレットが必要です。これらはGMO Coinの管理画面から取得してください。

### 環境変数の設定
```bash
export FX_API_KEY="your_api_key_here"
export FX_API_SECRET="your_secret_here"
```

### コードでの設定
```typescript
import { FxPrivateRestClient } from 'fx-sdk';

const apiKey = process.env.FX_API_KEY;
const secret = process.env.FX_API_SECRET;

if (!apiKey || !secret) {
  throw new Error('APIキーとシークレットが必要です');
}

const client = new FxPrivateRestClient(apiKey, secret);
```

## REST APIの使用例

### 基本的な使用方法

```typescript
import { FxPrivateRestClient } from 'fx-sdk';

const client = new FxPrivateRestClient(process.env.FX_API_KEY!, process.env.FX_API_SECRET!);

// 資産情報の取得
async function getAssets() {
  try {
    const response = await client.getAssets();
    console.log('資産情報:', response.data);
  } catch (error) {
    console.error('エラー:', error);
  }
}

// アクティブ注文の取得
async function getActiveOrders() {
  try {
    const response = await client.getActiveOrders({ symbol: 'USD_JPY', count: '10' });
    console.log('アクティブ注文:', response.data);
  } catch (error) {
    console.error('エラー:', error);
  }
}

// LIMIT注文の配置
async function placeLimitOrder() {
  try {
    const response = await client.placeOrder({
      symbol: 'USD_JPY',
      side: 'BUY',
      size: '1000',
      executionType: 'LIMIT',
      limitPrice: '150.00'
    });
    console.log('注文配置結果:', response.data);
  } catch (error) {
    console.error('エラー:', error);
  }
}

// SPEED注文の配置（市場価格）
async function placeSpeedOrder() {
  try {
    const response = await client.speedOrder({
      symbol: 'USD_JPY',
      side: 'SELL',
      size: '1000'
    });
    console.log('SPEED注文結果:', response.data);
  } catch (error) {
    console.error('エラー:', error);
  }
}

// IFD注文の配置
async function placeIfdOrder() {
  try {
    const response = await client.placeIfdOrder({
      symbol: 'USD_JPY',
      side: 'BUY',
      size: '1000',
      firstExecutionType: 'LIMIT',
      firstPrice: '150.00',
      secondExecutionType: 'LIMIT',
      secondPrice: '151.00'
    });
    console.log('IFD注文結果:', response.data);
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 注文の取消
async function cancelOrders() {
  try {
    const response = await client.cancelOrders({
      rootOrderIds: ['order_id_1', 'order_id_2']
    });
    console.log('注文取消結果:', response.data);
  } catch (error) {
    console.error('エラー:', error);
  }
}

// ポジションの取得
async function getOpenPositions() {
  try {
    const response = await client.getOpenPositions({ symbol: 'USD_JPY' });
    console.log('オープンポジション:', response.data);
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 約定履歴の取得
async function getExecutions() {
  try {
    const response = await client.getLatestExecutions({
      symbol: 'USD_JPY',
      count: '20'
    });
    console.log('最新約定:', response.data);
  } catch (error) {
    console.error('エラー:', error);
  }
}
```

### 完全なサンプルコード

```typescript
import { FxPrivateRestClient } from 'fx-sdk';

const apiKey = process.env.FX_API_KEY!;
const secret = process.env.FX_API_SECRET!;
const client = new FxPrivateRestClient(apiKey, secret);

async function main() {
  try {
    // 資産確認
    const assets = await client.getAssets();
    console.log('現在の資産:', assets.data);

    // アクティブ注文確認
    const activeOrders = await client.getActiveOrders();
    console.log('アクティブ注文数:', activeOrders.data.length);

    // 新規注文（LIMIT）
    const order = await client.placeOrder({
      symbol: 'USD_JPY',
      side: 'BUY',
      size: '10000',
      executionType: 'LIMIT',
      limitPrice: '145.50'
    });
    console.log('注文ID:', order.data[0].rootOrderId);

    // 注文取消（必要に応じて）
    // await client.cancelOrders({ rootOrderIds: [order.data[0].rootOrderId] });

  } catch (error) {
    console.error('取引エラー:', error);
  }
}

main();
```

## WebSocketの使用例

### 基本的な使用方法

```typescript
import { FxPrivateWsAuth, FxPrivateWsClient } from 'fx-sdk';

const apiKey = process.env.FX_API_KEY!;
const secret = process.env.FX_API_SECRET!;

// 1. WebSocket認証トークンの取得
async function getWsToken() {
  const auth = new FxPrivateWsAuth(apiKey, secret);
  try {
    const tokenResponse = await auth.create();
    return tokenResponse.data.token;
  } catch (error) {
    console.error('トークン取得エラー:', error);
    throw error;
  }
}

// 2. WebSocket接続と購読
async function connectWebSocket() {
  try {
    const token = await getWsToken();
    const wsClient = new FxPrivateWsClient(token);

    // 接続
    await wsClient.connect();
    console.log('WebSocket接続成功');

    // メッセージ受信ハンドラー
    wsClient.onMessage((message) => {
      console.log('受信メッセージ:', message);
    });

    // チャンネル購読
    await wsClient.subscribe('execution', 'USD_JPY');  // 約定情報
    await wsClient.subscribe('order', 'USD_JPY');      // 注文情報
    await wsClient.subscribe('position', 'USD_JPY');   // ポジション情報

    // 60秒後に接続を閉じる（デモ用）
    setTimeout(async () => {
      await wsClient.close();
      console.log('WebSocket接続を閉じました');
    }, 60000);

  } catch (error) {
    console.error('WebSocketエラー:', error);
  }
}

connectWebSocket();
```

### 購読可能なチャンネル

- `execution`: 約定情報
- `order`: 注文ステータス変更
- `position`: ポジション変更
- `positionSummary`: ポジションサマリー

### 完全なサンプルコード

```typescript
import { FxPrivateWsAuth, FxPrivateWsClient } from 'fx-sdk';

const apiKey = process.env.FX_API_KEY!;
const secret = process.env.FX_API_SECRET!;

async function runWebSocketExample() {
  const auth = new FxPrivateWsAuth(apiKey, secret);

  try {
    // トークン取得
    const tokenResp = await auth.create();
    const token = tokenResp.data.token;

    // WebSocketクライアント作成
    const ws = new FxPrivateWsClient(token);
    await ws.connect();

    // メッセージ処理
    ws.onMessage((msg) => {
      if (msg.channel === 'execution') {
        console.log('約定:', msg.data);
      } else if (msg.channel === 'order') {
        console.log('注文更新:', msg.data);
      }
    });

    // 複数シンボルの購読
    await ws.subscribe('execution', 'USD_JPY');
    await ws.subscribe('execution', 'EUR_USD');
    await ws.subscribe('order');

    // 30秒後に購読解除
    setTimeout(async () => {
      await ws.unsubscribe('execution', 'EUR_USD');
      console.log('EUR_USDの約定購読を解除');
    }, 30000);

    // 5分後に終了
    setTimeout(async () => {
      await ws.close();
      await auth.revoke(token);  // トークン無効化
      process.exit(0);
    }, 300000);

  } catch (error) {
    console.error('WebSocket例の実行エラー:', error);
  }
}

runWebSocketExample();
```

## エラーハンドリング

SDKは自動的にエラーを処理しますが、適切なエラーハンドリングを行うことを推奨します。

### 一般的なエラーパターン

```typescript
import { FxPrivateRestClient } from 'fx-sdk';

const client = new FxPrivateRestClient(process.env.FX_API_KEY!, process.env.FX_API_SECRET!);

async function safeApiCall() {
  try {
    const result = await client.getAssets();
    return result.data;
  } catch (error) {
    // エラーの種類に応じた処理
    if (error.message.includes('ERR-201')) {
      console.error('残高不足です');
    } else if (error.message.includes('ERR-5003')) {
      console.error('レート制限を超えました。しばらく待ってください');
    } else if (error.message.includes('ERR-5008') || error.message.includes('ERR-5009')) {
      console.error('タイムスタンプがずれています。システム時刻を確認してください');
    } else {
      console.error('予期しないエラー:', error.message);
    }
    throw error;  // 必要に応じて再スロー
  }
}
```

### 主要なエラーコード

- `ERR-201`: 残高不足
- `ERR-5003`: レート制限超過
- `ERR-5008/5009`: タイムスタンプずれ（システム時刻同期が必要）
- `ERR-760`: 価格変更なし
- `ERR-761`: 注文レートが価格制限範囲を超過

### WebSocketエラーハンドリング

```typescript
import { FxPrivateWsClient } from 'fx-sdk';

async function handleWebSocketErrors() {
  try {
    const ws = new FxPrivateWsClient('your_token');
    await ws.connect();

    ws.onMessage((msg) => {
      if (msg.type === 'error') {
        console.error('WebSocketエラー:', msg.data);
        // 必要に応じて再接続処理
      } else {
        // 正常メッセージ処理
        console.log('データ:', msg);
      }
    });

  } catch (error) {
    console.error('WebSocket接続エラー:', error);
    // 指数バックオフなどで再試行
  }
}
```

## レートリミッターの注意点

SDKは自動的にAPIレート制限を管理しますが、使用時には以下の点に注意してください。

### レート制限の仕様

- **GETリクエスト**: 6回/秒
- **POSTリクエスト**: 1回/秒  
- **WebSocketメッセージ**: 1回/秒

### 自動レートリミッティングの動作

```typescript
// SDK内部で自動的にレート制限を管理
const client = new FxPrivateRestClient(apiKey, secret);

// この呼び出しは自動的に1秒間隔を空ける
await client.getAssets();      // GET: すぐに実行
await client.placeOrder(...);  // POST: 1秒待機
await client.getAssets();      // GET: すぐに実行（GETは6/秒までOK）
```

### レート制限超過時の動作

レート制限を超えると、SDKは自動的にリクエストを遅延させます。ただし、短時間に大量のリクエストを送ると応答が遅くなる可能性があります。

### 最適化のヒント

```typescript
// 効率的なリクエストパターン
async function efficientTrading() {
  const client = new FxPrivateRestClient(apiKey, secret);

  // 1. まず現在の状態を確認
  const [assets, positions, activeOrders] = await Promise.all([
    client.getAssets(),
    client.getOpenPositions(),
    client.getActiveOrders()
  ]);

  // 2. 必要な注文のみ実行
  if (positions.data.length < 5) {  // ポジション数が少ない場合のみ
    await client.placeOrder({
      symbol: 'USD_JPY',
      side: 'BUY',
      size: '1000',
      executionType: 'LIMIT',
      limitPrice: '150.00'
    });
  }

  // 3. 定期的な監視（間隔を空ける）
  setInterval(async () => {
    const latest = await client.getLatestExecutions({ symbol: 'USD_JPY', count: '5' });
    console.log('最新約定:', latest.data);
  }, 10000);  // 10秒間隔
}
```

### カスタムレートリミッターの使用

必要に応じて独自のレートリミッターを実装できます：

```typescript
import { FixedGate } from 'fx-sdk';

// カスタムレートゲート（2回/秒）
const customGate = new FixedGate(2);

async function customRateLimitedCall() {
  await customGate.wait();  // レート制限を待機
  // API呼び出し
}
```

## まとめ

このSDKを使用することで、GMO CoinのFX Private APIを安全かつ効率的に利用できます。以下のポイントを押さえてください：

1. **認証**: APIキーとシークレットを正しく設定
2. **エラーハンドリング**: 適切なtry-catchを実装
3. **レート制限**: SDKの自動管理を活用し、無駄なリクエストを避ける
4. **WebSocket**: リアルタイムデータが必要な場合はWebSocketを使用
5. **テスト**: 本番取引前に必ずテスト環境で動作確認

より詳細なAPI仕様については、GMO Coinの公式ドキュメントを参照してください。</target_file>