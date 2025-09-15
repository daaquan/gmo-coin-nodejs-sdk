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

export class FxPrivateWsAuth {
  constructor(
    private apiKey: string,
    private secret: string,
    private restBase = 'https://forex-api.coin.z.com/private'
  ) {
    if (!apiKey || !secret) {
      throw new Error('FxPrivateWsAuth: Missing API credentials. Set FX_API_KEY and FX_API_SECRET.');
    }
  }

  private async call(method: 'POST' | 'PUT' | 'DELETE', path = '/v1/ws-auth', body?: any) {
    const payload = body ? JSON.stringify(body) : JSON.stringify({});
    const headers = buildHeaders(this.apiKey, this.secret, method, path, payload);
    const res = await fetch(this.restBase + path, { method, headers, body: payload });
    let json: any; try { json = await res.json(); } catch { json = undefined; }
    if (!res.ok || json?.status !== 0) throw new Error(`${method} ${path} failed: ${res.status} ${JSON.stringify(json)}`);
    return json as { status: number; data: string; responsetime: string };
  }

  create() { return this.call('POST'); }
  extend(token: string) { return this.call('PUT', '/v1/ws-auth', { token }); }
  revoke(token: string) { return this.call('DELETE', '/v1/ws-auth', { token }); }
}

export class FxPrivateWsClient {
  private ws?: WebSocket;
  private pingTimer?: ReturnType<typeof setInterval>;

  constructor(private token: string) {
    if (!token) throw new Error('FxPrivateWsClient: token is required. Obtain via FxPrivateWsAuth.create().');
  }

  async connect() {
    this.ws = new WebSocket(`${WS_BASE}/${this.token}`);
    await new Promise<void>((res, rej) => {
      this.ws!.once('open', () => {
        // client-side keepalive pings slightly under server interval
        this.pingTimer = setInterval(() => this.ws?.ping(), 55_000);
        res();
      });
      this.ws!.once('error', rej);
    });
  }

  onMessage(fn: (msg: any) => void) {
    this.ws?.on('message', (raw: WebSocket.RawData) => {
      try { fn(JSON.parse(raw.toString())); } catch {}
    });
  }

  async subscribe(topic: 'execution' | 'order' | 'position' | 'positionSummary', symbol?: string) {
    await wsGate.wait();
    const payload: any = { command: 'subscribe', channel: topic };
    if (symbol) payload.symbol = symbol;
    this.ws?.send(JSON.stringify(payload));
  }

  async unsubscribe(topic: 'execution' | 'order' | 'position' | 'positionSummary', symbol?: string) {
    await wsGate.wait();
    const payload: any = { command: 'unsubscribe', channel: topic };
    if (symbol) payload.symbol = symbol;
    this.ws?.send(JSON.stringify(payload));
  }

  async close() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
  }
}
