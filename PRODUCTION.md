# Production Deployment Guide

このドキュメントは、gmo-coin-sdk の本番環境へのデプロイメント時に推奨される設定とセキュリティ対策をまとめています。

## セキュリティ対策

### 1. API 認証情報の管理

**Do:**
- API キー/シークレットは環境変数で管理（`.env` は `.gitignore` に含める）
- 本番環境では AWS Secrets Manager、HashiCorp Vault など使用
- キーのローテーションポリシーを設定（3-6 ヶ月）
- 定期的にアクセスログを監視

**Don't:**
- ソースコードに認証情報をハードコーディングしない
- `.env` ファイルをリポジトリに含めない
- シークレットをコンテナイメージに焼き込まない
- 本番キーを開発環境で使用しない

### 2. サービス認証（JWT）の設定

本番環境では必ず JWT 認証を有効化してください：

```bash
SERVICE_AUTH_MODE=jwt
JWKS_URL=https://your-identity-provider.com/.well-known/jwks.json
JWT_ISSUER=https://your-issuer.com
JWT_AUDIENCE=gmo-coin-service
```

**推奨:**
- OpenID Connect 互換の IdP を使用（Auth0, Okta など）
- JWT の署名検証は自動的に行われます
- 発行者と対象の検証を有効化

### 3. ネットワークセキュリティ

```bash
# リバースプロキシを使用する場合
TRUST_PROXY=true

# ホストを 127.0.0.1 にバインド（ファイアウォール背後）
HOST=127.0.0.1
PORT=3000
```

**推奨:**
- サービスを内部ネットワークのみに公開
- リバースプロキシ（Nginx、ALB）を前面に配置
- TLS/SSL 通信を強制
- 不必要なポートを開かない

### 4. ログとモニタリング

```bash
LOG_LEVEL=warn  # 本番環境では 'info' または 'warn' を使用
```

**推奨:**
- ログは外部サービスに集約（CloudWatch, ELK Stack など）
- エラーレスポンスにはリクエスト ID を含める（監査用）
- レート制限エラーを監視
- API タイムアウト（30s）を超える遅い要求を検出

### 5. レート制限の設定

SDK には以下のレート制限が組み込まれています：

- **GET**: 6 リクエスト/秒
- **POST**: 1 リクエスト/秒
- **WebSocket subscribe/unsubscribe**: 1 回/秒

**推奨:**
- API ゲートウェイで追加のレート制限を設定
- Redis を使用した分散レート制限の実装を検討

### 6. エラーハンドリング

SDK は以下のエラーを自動的に処理します：

| エラーコード | HTTP ステータス | 説明 |
|-----------|-----------------|------|
| ERR-201 | 400 | 資金不足 |
| ERR-5003 | 429 | レート制限超過 |
| ERR-5008/5009 | 400 | タイムスタンプずれ |
| その他 | 500 | 内部エラー |

**推奨:**
- エラーレスポンスをクライアントに返す際、機密情報を削除
- 監査ログにはエラーの詳細を記録
- 頻発するエラーはアラート設定

## デプロイメント構成

### Docker 環境

```dockerfile
FROM node:18-alpine

WORKDIR /app

# セキュリティ: npm audit を実行
RUN npm ci --only=production && npm audit

# ビルド
COPY . .
RUN npm run build

# 本番実行
EXPOSE 3000
CMD ["node", "dist/service/server.js"]
```

**推奨:**
- マルチステージビルドを使用（ビルド成果物のみをコピー）
- `npm ci` を使用（`npm install` ではなく）
- ヘルスチェックを設定

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
```

### 環境変数の設定例

```yaml
# Docker Compose
version: '3.8'
services:
  gmo-service:
    image: gmo-coin-service:latest
    environment:
      FX_API_KEY: ${FX_API_KEY}
      FX_API_SECRET: ${FX_API_SECRET}
      SERVICE_AUTH_MODE: jwt
      JWKS_URL: https://auth.example.com/.well-known/jwks.json
      LOG_LEVEL: info
      TRUST_PROXY: 'true'
    ports:
      - "127.0.0.1:3000:3000"
    restart: always
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
```

### Kubernetes 環境

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gmo-coin-service
spec:
  replicas: 2
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
        image: gmo-coin-service:v1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: FX_API_KEY
          valueFrom:
            secretKeyRef:
              name: gmo-credentials
              key: fx-api-key
        - name: FX_API_SECRET
          valueFrom:
            secretKeyRef:
              name: gmo-credentials
              key: fx-api-secret
        - name: SERVICE_AUTH_MODE
          value: "jwt"
        - name: JWKS_URL
          value: "https://auth.example.com/.well-known/jwks.json"
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
---
apiVersion: v1
kind: Service
metadata:
  name: gmo-coin-service
spec:
  type: ClusterIP
  selector:
    app: gmo-coin-service
  ports:
  - port: 80
    targetPort: 3000
```

## 本番チェックリスト

- [ ] API 認証情報が環境変数で管理されている
- [ ] `.env` ファイルが `.gitignore` に含まれている
- [ ] 本番環境で JWT 認証が有効化されている
- [ ] JWKS URL が正しく設定されている
- [ ] ログレベルが 'info' または 'warn' に設定
- [ ] エラーログが外部サービスに集約されている
- [ ] ヘルスチェックエンドポイントが機能している
- [ ] グレースフルシャットダウンが動作確認済み
- [ ] レート制限が適切に機能している
- [ ] リバースプロキシで TLS/SSL が設定されている
- [ ] セキュリティヘッダーが設定されている
- [ ] リソースリミット（CPU、メモリ）が設定されている
- [ ] バックアップとリカバリ計画が策定済み
- [ ] インシデント対応計画が策定済み

## トラブルシューティング

### タイムスタンプエラー（ERR-5008/5009）

サーバー時刻が正確でない場合に発生します：

```bash
# 時刻同期の確認（Linux）
timedatectl status

# NTP サーバーの同期
sudo systemctl restart systemd-timesyncd
```

### レート制限エラー（ERR-5003）

リクエストレートが制限を超えた場合に発生します。以下をご確認ください：

- 複数のクライアントが同時にリクエストしていないか
- POST リクエストの頻度が 1 回/秒を超えていないか
- SDK の内部レート制限を確認：`src/rateLimiter.ts`

### WebSocket 接続失敗

```typescript
const auth = new FxPrivateWsAuth(apiKey, secret);
const tokenResp = await auth.create();
const client = new FxPrivateWsClient(tokenResp.data);
await client.connect(); // タイムアウト：30秒
```

タイムアウト内に接続完了しない場合：
- ネットワーク接続を確認
- ファイアウォール設定を確認
- WebSocket URL が正しいか確認（wss:// で始まること）

## セキュリティアドバイザリ

最新のセキュリティアドバイザリについては、GitHub Issues を確認してください：
https://github.com/anthropics/gmo-coin-nodejs-sdk/security

## サポート

本番環境でのトラブルは以下にご報告ください：
- GitHub Issues: https://github.com/anthropics/gmo-coin-nodejs-sdk/issues
- セキュリティ脆弱性: security@example.com
