/**
 * Public WebSocket clients for GMO Coin FX and Crypto APIs
 * No authentication required - provides real-time ticker data
 *
 * FX endpoint: wss://forex-api.coin.z.com/ws/public/v1
 * Crypto endpoint: wss://api.coin.z.com/ws/public/v1
 *
 * Rate limit: 1 subscribe/unsubscribe per second
 * Server pings every ~60 seconds; disconnect if 3 pongs missed
 */
import WebSocket from 'ws';
import { wsGate } from './rateLimiter.js';

const FX_WS_BASE = 'wss://forex-api.coin.z.com/ws/public/v1';
const CRYPTO_WS_BASE = 'wss://api.coin.z.com/ws/public/v1';
const WS_TIMEOUT = 30_000; // 30 seconds
const PING_INTERVAL = 55_000; // 55 seconds (server pings ~60s)

/**
 * Public WebSocket client for GMO Coin FX
 * Provides real-time ticker data without authentication
 */
export class FxPublicWsClient {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(private wsBase: string = FX_WS_BASE) {}

  /**
   * Establish WebSocket connection
   * Throws error if connection fails or times out
   */
  async connect(): Promise<void> {
    if (this.closed) {
      throw new Error('FxPublicWsClient: Connection already closed, cannot reconnect.');
    }
    if (this.ws) {
      throw new Error('FxPublicWsClient: Already connected.');
    }

    this.ws = new WebSocket(this.wsBase);

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws?.close();
        reject(new Error('FxPublicWsClient: Connection timeout'));
      }, WS_TIMEOUT);

      const onOpen = () => {
        clearTimeout(timeout);
        cleanup();

        // Client-side keepalive pings
        this.pingTimer = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.ping();
          }
        }, PING_INTERVAL);

        resolve();
      };

      const onError = (error: Event) => {
        clearTimeout(timeout);
        cleanup();
        const err = error instanceof Error ? error : new Error('WebSocket error');
        reject(err);
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

  /**
   * Register callback for incoming messages
   * Messages are automatically parsed from JSON
   */
  onMessage(fn: (msg: unknown) => void): void {
    if (!this.ws) {
      throw new Error('FxPublicWsClient: Not connected. Call connect() first.');
    }

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        fn(JSON.parse(raw.toString()));
      } catch (e) {
        const parseError = e instanceof Error ? e : new Error(String(e));
        console.error('Failed to parse WebSocket message:', parseError.message);
      }
    });
  }

  /**
   * Register callback for connection close event
   */
  onClose(fn: () => void): void {
    if (!this.ws) {
      throw new Error('FxPublicWsClient: Not connected. Call connect() first.');
    }
    this.ws.on('close', () => fn());
  }

  /**
   * Register callback for WebSocket errors
   */
  onError(fn: (error: Error) => void): void {
    if (!this.ws) {
      throw new Error('FxPublicWsClient: Not connected. Call connect() first.');
    }
    this.ws.on('error', (event: Event) => {
      const error = event instanceof Error ? event : new Error('WebSocket error');
      fn(error);
    });
  }

  /**
   * Subscribe to ticker stream for a specific symbol
   * Rate limited to 1 per second
   *
   * @param symbol Trading symbol (e.g., "USD_JPY", "EUR_JPY")
   */
  async subscribe(symbol: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('FxPublicWsClient: Not connected.');
    }

    await wsGate.wait();

    const payload = {
      command: 'subscribe',
      channel: 'ticker',
      symbol,
    };

    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Unsubscribe from ticker stream for a specific symbol
   * Rate limited to 1 per second
   *
   * @param symbol Trading symbol (e.g., "USD_JPY", "EUR_JPY")
   */
  async unsubscribe(symbol: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('FxPublicWsClient: Not connected.');
    }

    await wsGate.wait();

    const payload = {
      command: 'unsubscribe',
      channel: 'ticker',
      symbol,
    };

    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Close WebSocket connection and cleanup resources
   * Can be called multiple times safely (idempotent)
   */
  async close(): Promise<void> {
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

/**
 * Public WebSocket client for GMO Coin Crypto
 * Provides real-time ticker data without authentication
 */
export class CryptoPublicWsClient extends FxPublicWsClient {
  constructor() {
    super(CRYPTO_WS_BASE);
  }
}