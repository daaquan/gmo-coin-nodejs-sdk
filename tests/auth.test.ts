import { describe, it, expect, vi, afterAll } from 'vitest';
import { buildHeaders } from '../src/auth.js';
import crypto from 'node:crypto';

// Mock Date.now to ensure consistent timestamps
const mockTimestamp = 1609459200000; // 2021-01-01T00:00:00.000Z
vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

describe('buildHeaders', () => {
  const apiKey = 'test-api-key';
  const secret = 'test-secret';

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should build correct headers for GET request', () => {
    const method = 'GET';
    const path = '/v1/account/assets';
    const body = '';

    const headers = buildHeaders(apiKey, secret, method, path, body);

    // Expected signature calculation
    const text = `${mockTimestamp}${method}${path}${body}`;
    const expectedSign = crypto.createHmac('sha256', secret).update(text).digest('hex');

    expect(headers).toEqual({
      'API-KEY': apiKey,
      'API-TIMESTAMP': mockTimestamp.toString(),
      'API-SIGN': expectedSign,
      'Content-Type': 'application/json',
    });
  });

  it('should build correct headers for POST request with body', () => {
    const method = 'POST';
    const path = '/v1/order';
    const body = JSON.stringify({
      symbol: 'USD_JPY',
      side: 'BUY',
      size: '10000',
      executionType: 'LIMIT',
      limitPrice: '130.00',
    });

    const headers = buildHeaders(apiKey, secret, method, path, body);

    const text = `${mockTimestamp}${method}${path}${body}`;
    const expectedSign = crypto.createHmac('sha256', secret).update(text).digest('hex');

    expect(headers).toEqual({
      'API-KEY': apiKey,
      'API-TIMESTAMP': mockTimestamp.toString(),
      'API-SIGN': expectedSign,
      'Content-Type': 'application/json',
    });
  });

  it('should generate different signatures for different methods', () => {
    const path = '/v1/test';
    const body = '';

    const getHeaders = buildHeaders(apiKey, secret, 'GET', path, body);
    const postHeaders = buildHeaders(apiKey, secret, 'POST', path, body);

    expect(getHeaders['API-SIGN']).not.toBe(postHeaders['API-SIGN']);
  });

  it('should use HMAC-SHA256 for signature generation', () => {
    const method = 'GET';
    const path = '/v1/test';
    const body = '';

    const headers = buildHeaders(apiKey, secret, method, path, body);

    // Verify the signature is a valid hex string of expected length (64 chars for SHA256)
    expect(headers['API-SIGN']).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should include all required headers', () => {
    const headers = buildHeaders(apiKey, secret, 'GET', '/v1/test', '');

    expect(headers).toHaveProperty('API-KEY');
    expect(headers).toHaveProperty('API-TIMESTAMP');
    expect(headers).toHaveProperty('API-SIGN');
    expect(headers).toHaveProperty('Content-Type');
  });
});
