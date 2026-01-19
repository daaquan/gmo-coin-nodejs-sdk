/**
 * Private WS requires an access token from REST:
 *  - POST /v1/ws-auth    -> { token, expireAt }
 *  - PUT  /v1/ws-auth    -> extend current token
 *  - DELETE /v1/ws-auth  -> revoke
 * Then connect to: wss://forex-api.coin.z.com/ws/private/v1/<token>
 * Server pings ~1/min; disconnect if 3 pongs missed.
 */
import WebSocket from 'ws';
import { buildHeaders } from './auth.js';
import { wsGate } from './rateLimiter.js';

const WS_BASE = 'wss://forex-api.coin.z.com/ws/private/v1';
const WS_TIMEOUT = 30_000; // 30 seconds
const PING_INTERVAL = 55_000; // 55 seconds (server pings ~60s)

export class FxPrivateWsAuth {
  constructor(
    private apiKey: string,
    private secret: string,
    private restBase = 'https://forex-api.coin.z.com/private',
  ) {
    if (!apiKey || !secret) {
      throw new Error(
        'FxPrivateWsAuth: Missing API credentials. Set FX_API_KEY and FX_API_SECRET.',
      );
    }
  }

  private async call(
    method: 'POST' | 'PUT' | 'DELETE',
    path = '/v1/ws-auth',
    body?: { token?: string },
  ) {
    const payload = body ? JSON.stringify(body) : JSON.stringify({});
    const headers = buildHeaders(this.apiKey, this.secret, method, path, payload);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WS_TIMEOUT);
    try {
      const res = await fetch(this.restBase + path, {
        method,
        headers,
        body: payload,
        signal: controller.signal,
      });
      let json: Record<string, unknown> | null = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      if (!res.ok || json?.status !== 0) {
        const errorMsg = `${method} ${path} failed: ${res.status} ${JSON.stringify(json)}`;
        throw new Error(errorMsg);
      }
      return json as unknown as { status: number; data: string; responsetime: string };
    } finally {
      clearTimeout(timeout);
    }
  }

  create() {
    return this.call('POST');
  }
  extend(token: string) {
    return this.call('PUT', '/v1/ws-auth', { token });
  }
  revoke(token: string) {
    return this.call('DELETE', '/v1/ws-auth', { token });
  }
}

export class FxPrivateWsClient {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(private token: string) {
    if (!token)
      throw new Error('FxPrivateWsClient: token is required. Obtain via FxPrivateWsAuth.create().');
  }

  async connect() {
    if (this.closed)
      throw new Error('FxPrivateWsClient: Connection already closed, cannot reconnect.');
    if (this.ws) throw new Error('FxPrivateWsClient: Already connected.');

    this.ws = new WebSocket(`${WS_BASE}/${this.token}`);

    return new Promise<void>((res, rej) => {
      const timeout = setTimeout(() => {
        this.ws?.close();
        rej(new Error('FxPrivateWsClient: Connection timeout'));
      }, WS_TIMEOUT);

      const onOpen = () => {
        clearTimeout(timeout);
        cleanup();
        this.pingTimer = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.ping();
          }
        }, PING_INTERVAL);
        res();
      };

      const onError = (error: Event) => {
        clearTimeout(timeout);
        cleanup();
        const err = error instanceof Error ? error : new Error('WebSocket error');
        rej(err);
      };

      const cleanup = () => {
        this.ws?.removeListener('open', onOpen);
        this.ws?.removeListener('error', onError);
      };

      if (this.ws) {
        this.ws.once('open', onOpen);
        this.ws.once('error', onError);
      }
    });
  }

  onMessage(fn: (msg: unknown) => void) {
    if (!this.ws) throw new Error('FxPrivateWsClient: Not connected. Call connect() first.');
    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        fn(JSON.parse(raw.toString()));
      } catch (e) {
        const parseError = e instanceof Error ? e : new Error(String(e));
        console.error('Failed to parse WebSocket message:', parseError.message);
      }
    });
  }

  onClose(fn: () => void) {
    if (!this.ws) throw new Error('FxPrivateWsClient: Not connected. Call connect() first.');
    this.ws.on('close', () => fn());
  }

  onError(fn: (error: Error) => void) {
    if (!this.ws) throw new Error('FxPrivateWsClient: Not connected. Call connect() first.');
    this.ws.on('error', (event: Event) => {
      const error = event instanceof Error ? event : new Error('WebSocket error');
      fn(error);
    });
  }

  async subscribe(topic: 'execution' | 'order' | 'position' | 'positionSummary', symbol?: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('FxPrivateWsClient: Not connected.');
    }
    await wsGate.wait();
    const payload: { command: string; channel: string; symbol?: string } = {
      command: 'subscribe',
      channel: topic,
    };
    if (symbol) payload.symbol = symbol;
    this.ws.send(JSON.stringify(payload));
  }

  async unsubscribe(
    topic: 'execution' | 'order' | 'position' | 'positionSummary',
    symbol?: string,
  ) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('FxPrivateWsClient: Not connected.');
    }
    await wsGate.wait();
    const payload: { command: string; channel: string; symbol?: string } = {
      command: 'unsubscribe',
      channel: topic,
    };
    if (symbol) payload.symbol = symbol;
    this.ws.send(JSON.stringify(payload));
  }

  async close() {
    this.closed = true;
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}

// Crypto variant
export class CryptoPrivateWsAuth extends FxPrivateWsAuth {
  constructor(apiKey: string, secret: string, restBase = 'https://api.coin.z.com/private') {
    super(apiKey, secret, restBase);
  }
}

export class CryptoPrivateWsClient extends FxPrivateWsClient {
  constructor(
    token: string,
    _cryptoWsBase = 'wss://api.coin.z.com/ws/private/v1',
  ) {
    super(token);
  }
}