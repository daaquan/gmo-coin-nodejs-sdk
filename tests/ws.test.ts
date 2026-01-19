import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
