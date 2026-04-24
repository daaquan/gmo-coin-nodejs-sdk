import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import WebSocket from 'ws';
import {
  FxPrivateWsAuth,
  FxPrivateWsClient,
  CryptoPrivateWsAuth,
  CryptoPrivateWsClient,
} from '../src/ws-private.js';

// Mock WebSocket
vi.mock('ws', () => ({
  default: vi.fn(),
}));

describe('FxPrivateWsAuth', () => {
  const mockApiKey = 'test-api-key';
  const mockSecret = 'test-secret';

  it('should throw error if API key is missing', () => {
    expect(() => new FxPrivateWsAuth('', mockSecret)).toThrow('Missing API credentials');
  });

  it('should throw error if secret is missing', () => {
    expect(() => new FxPrivateWsAuth(mockApiKey, '')).toThrow('Missing API credentials');
  });

  it('should create auth instance with valid credentials', () => {
    const auth = new FxPrivateWsAuth(mockApiKey, mockSecret);
    expect(auth).toBeInstanceOf(FxPrivateWsAuth);
  });

  it('should allow custom restBase URL', () => {
    const customUrl = 'https://custom.example.com/private';
    const auth = new FxPrivateWsAuth(mockApiKey, mockSecret, customUrl);
    expect(auth).toBeInstanceOf(FxPrivateWsAuth);
  });

  describe('ws-auth REST calls (GMO FX spec)', () => {
    const testRestBase = 'https://forex-api.coin.z.com/private';
    let fetchSpy: ReturnType<typeof vi.spyOn>;
    let calls: Array<{ url: string; init: RequestInit }>;

    beforeEach(() => {
      calls = [];
      fetchSpy = vi
        .spyOn(globalThis, 'fetch' as never)
        .mockImplementation(async (input: any, init: any) => {
          const url = typeof input === 'string' ? input : input?.toString?.() ?? '';
          calls.push({ url, init });
          return new Response(
            JSON.stringify({ status: 0, data: 'new-token', responsetime: '2026-04-24T00:00:00Z' }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ) as never;
        });
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    const verifySignature = (
      expected: { method: string; path: string; body: string },
      headers: Record<string, string>,
    ) => {
      const ts = headers['API-TIMESTAMP'];
      expect(ts).toBeTruthy();
      const text = ts + expected.method + expected.path + expected.body;
      const expectedSign = crypto
        .createHmac('sha256', mockSecret)
        .update(text)
        .digest('hex');
      expect(headers['API-SIGN']).toBe(expectedSign);
      expect(headers['API-KEY']).toBe(mockApiKey);
    };

    const extractHeaders = (init: RequestInit): Record<string, string> => {
      const h = init.headers as Record<string, string> | Headers | undefined;
      if (!h) return {};
      if (h instanceof Headers) {
        const out: Record<string, string> = {};
        h.forEach((v, k) => (out[k] = v));
        return out;
      }
      return h;
    };

    it('create() sends POST /v1/ws-auth with body "{}" and signs with that body', async () => {
      const auth = new FxPrivateWsAuth(mockApiKey, mockSecret, testRestBase);
      await auth.create();

      expect(calls).toHaveLength(1);
      const call = calls[0]!;
      expect(call.url).toBe(`${testRestBase}/v1/ws-auth`);
      expect(call.init.method).toBe('POST');
      expect(call.init.body).toBe('{}');
      verifySignature(
        { method: 'POST', path: '/v1/ws-auth', body: '{}' },
        extractHeaders(call.init),
      );
    });

    it('extend() sends PUT with token in query string and empty body (signed with empty body)', async () => {
      const auth = new FxPrivateWsAuth(mockApiKey, mockSecret, testRestBase);
      const token = 'abc-123';
      await auth.extend(token);

      expect(calls).toHaveLength(1);
      const call = calls[0]!;
      expect(call.url).toBe(`${testRestBase}/v1/ws-auth?token=${token}`);
      expect(call.init.method).toBe('PUT');
      // body must NOT contain the token — that would break the signature on GMO's side
      expect(call.init.body).toBeUndefined();
      verifySignature(
        { method: 'PUT', path: '/v1/ws-auth', body: '' },
        extractHeaders(call.init),
      );
    });

    it('revoke() sends DELETE with token in query string and empty body', async () => {
      const auth = new FxPrivateWsAuth(mockApiKey, mockSecret, testRestBase);
      const token = 'xyz-789';
      await auth.revoke(token);

      expect(calls).toHaveLength(1);
      const call = calls[0]!;
      expect(call.url).toBe(`${testRestBase}/v1/ws-auth?token=${token}`);
      expect(call.init.method).toBe('DELETE');
      expect(call.init.body).toBeUndefined();
      verifySignature(
        { method: 'DELETE', path: '/v1/ws-auth', body: '' },
        extractHeaders(call.init),
      );
    });

    it('extend() url-encodes unusual token characters', async () => {
      const auth = new FxPrivateWsAuth(mockApiKey, mockSecret, testRestBase);
      await auth.extend('a/b+c=d');
      expect(calls[0]!.url).toBe(`${testRestBase}/v1/ws-auth?token=a%2Fb%2Bc%3Dd`);
    });
  });
});

describe('FxPrivateWsClient', () => {
  const mockToken = 'test-token-12345';

  it('should throw error if token is missing', () => {
    expect(() => new FxPrivateWsClient('')).toThrow('token is required');
  });

  it('should create client instance with valid token', () => {
    const client = new FxPrivateWsClient(mockToken);
    expect(client).toBeInstanceOf(FxPrivateWsClient);
  });

  it('should throw error when calling onMessage before connect', () => {
    const client = new FxPrivateWsClient(mockToken);
    expect(() => client.onMessage(() => {})).toThrow('Not connected');
  });

  it('should throw error when calling onClose before connect', () => {
    const client = new FxPrivateWsClient(mockToken);
    expect(() => client.onClose(() => {})).toThrow('Not connected');
  });

  it('should throw error when calling onError before connect', () => {
    const client = new FxPrivateWsClient(mockToken);
    expect(() => client.onError(() => {})).toThrow('Not connected');
  });

  it('should throw error when subscribing before connect', async () => {
    const client = new FxPrivateWsClient(mockToken);
    await expect(client.subscribe('execution')).rejects.toThrow('Not connected');
  });

  it('should throw error when unsubscribing before connect', async () => {
    const client = new FxPrivateWsClient(mockToken);
    await expect(client.unsubscribe('execution')).rejects.toThrow('Not connected');
  });

  it('should throw error when trying to reconnect after close', async () => {
    const client = new FxPrivateWsClient(mockToken);
    await client.close();
    await expect(client.connect()).rejects.toThrow('already closed');
  });

  it('should allow close without side effects', async () => {
    const client = new FxPrivateWsClient(mockToken);
    await expect(async () => {
      await client.close();
      await client.close(); // Second close should not throw
    }).not.toThrow();
  });

  it('should parse JSON messages correctly', async () => {
    const client = new FxPrivateWsClient(mockToken);

    // Create a minimal mock WebSocket
    const mockWs = {
      readyState: WebSocket.OPEN,
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        if (event === 'message') {
          // Simulate receiving a message
          setTimeout(() => {
            const mockRawData = {
              toString: () => JSON.stringify({ channel: 'execution', data: 'test' }),
            };
            handler(mockRawData);
          }, 0);
        }
      }),
      once: vi.fn(),
      send: vi.fn(),
      ping: vi.fn(),
      close: vi.fn(),
      removeListener: vi.fn(),
    };

    // Override the private ws property for testing
    (client as any).ws = mockWs;

    const messages: unknown[] = [];
    client.onMessage((msg) => messages.push(msg));

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0]).toEqual({ channel: 'execution', data: 'test' });
  });
});

describe('CryptoPrivateWsAuth', () => {
  const mockApiKey = 'crypto-api-key';
  const mockSecret = 'crypto-secret';

  it('should create crypto auth instance with custom restBase', () => {
    const auth = new CryptoPrivateWsAuth(mockApiKey, mockSecret);
    expect(auth).toBeInstanceOf(CryptoPrivateWsAuth);
  });

  it('should throw error if credentials are missing', () => {
    expect(() => new CryptoPrivateWsAuth('', mockSecret)).toThrow('Missing API credentials');
  });
});

describe('CryptoPrivateWsClient', () => {
  const mockToken = 'crypto-token-12345';

  it('should create crypto client instance', () => {
    const client = new CryptoPrivateWsClient(mockToken);
    expect(client).toBeInstanceOf(CryptoPrivateWsClient);
  });

  it('should inherit FxPrivateWsClient methods', () => {
    const client = new CryptoPrivateWsClient(mockToken);
    expect(typeof client.connect).toBe('function');
    expect(typeof client.close).toBe('function');
  });
});
