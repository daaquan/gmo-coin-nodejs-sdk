import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogger, createAuditLogger, AuditLogEntry } from '../src/audit.js';

describe('Audit Logger', () => {
  let auditLogger: AuditLogger;
  let loggedEntries: AuditLogEntry[] = [];

  beforeEach(() => {
    loggedEntries = [];
    auditLogger = new AuditLogger({
      logHeaders: true,
      logRequestBody: true,
      logResponseData: true,
      logger: (entry) => loggedEntries.push(entry),
      includeStackTrace: false,
    });
  });

  describe('Basic Logging', () => {
    it('should log API calls with basic information', () => {
      auditLogger.log('GET', '/v1/assets', 200, 100);

      expect(loggedEntries).toHaveLength(1);
      expect(loggedEntries[0].method).toBe('GET');
      expect(loggedEntries[0].path).toBe('/v1/assets');
      expect(loggedEntries[0].statusCode).toBe(200);
      expect(loggedEntries[0].duration).toBe(100);
    });

    it('should include timestamp', () => {
      const before = new Date();
      auditLogger.log('POST', '/v1/order', 200, 50);
      const after = new Date();

      expect(loggedEntries).toHaveLength(1);
      const timestamp = new Date(loggedEntries[0].timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should support all HTTP methods', () => {
      auditLogger.log('GET', '/path', 200, 10);
      auditLogger.log('POST', '/path', 200, 20);
      auditLogger.log('DELETE', '/path', 204, 30);

      expect(loggedEntries[0].method).toBe('GET');
      expect(loggedEntries[1].method).toBe('POST');
      expect(loggedEntries[2].method).toBe('DELETE');
    });
  });

  describe('PII Masking', () => {
    it('should mask API keys in headers', () => {
      auditLogger.log('GET', '/path', 200, 10, {
        headers: {
          'X-API-Key': 'secret-key-12345',
          'Authorization': 'Bearer token123',
          'Content-Type': 'application/json',
        },
      });

      const entry = loggedEntries[0];
      expect(entry.requestHeaders?.['X-API-Key']).toBe('***MASKED***');
      expect(entry.requestHeaders?.['Authorization']).toBe('***MASKED***');
      expect(entry.requestHeaders?.['Content-Type']).toBe('application/json');
    });

    it('should mask API keys in request body', () => {
      auditLogger.log('POST', '/order', 200, 50, {
        requestBody: {
          symbol: 'BTC',
          size: '0.1',
          apiKey: 'secret-key-12345',
        },
      });

      const entry = loggedEntries[0];
      expect((entry.requestBody as any)?.symbol).toBe('BTC');
      expect((entry.requestBody as any)?.apiKey).toBe('***MASKED***');
    });

    it('should mask nested sensitive data', () => {
      auditLogger.log('POST', '/order', 200, 50, {
        requestBody: {
          symbol: 'BTC',
          credentials: {
            secret: 'my-secret-value',
            token: 'my-token-value',
          },
        },
      });

      const body = loggedEntries[0].requestBody as any;
      expect(body?.credentials?.secret).toBe('***MASKED***');
      expect(body?.credentials?.token).toBe('***MASKED***');
    });

    it('should mask entire array if key matches PII pattern', () => {
      auditLogger.log('POST', '/path', 200, 10, {
        requestBody: {
          passwords: ['pass1', 'pass2'],
          symbols: ['BTC', 'ETH'],
        },
      });

      const body = loggedEntries[0].requestBody as any;
      // Fields matching PII patterns get masked entirely (including arrays)
      expect(body?.passwords).toBe('***MASKED***');
      expect(body?.symbols).toEqual(['BTC', 'ETH']);
    });

    it('should mask keys that match PII patterns regardless of values', () => {
      auditLogger.log('POST', '/path', 200, 10, {
        requestBody: {
          api_key: 'my-key-123',
          secret_token: 'my-token-456',
          public_id: 'id-789',
        },
      });

      const body = loggedEntries[0].requestBody as any;
      expect(body?.api_key).toBe('***MASKED***');
      expect(body?.secret_token).toBe('***MASKED***');
      expect(body?.public_id).toBe('id-789');
    });

    it('should support custom PII patterns', () => {
      const customLogger = new AuditLogger({
        piiPatterns: [/custom_secret/i, /my_key/i],
        logger: (entry) => loggedEntries.push(entry),
      });

      customLogger.log('GET', '/path', 200, 10, {
        headers: {
          'custom_secret': 'should-be-masked',
          'my_key': 'also-masked',
          'other_header': 'not-masked',
        },
      });

      const entry = loggedEntries[0];
      expect(entry.requestHeaders?.['custom_secret']).toBe('***MASKED***');
      expect(entry.requestHeaders?.['my_key']).toBe('***MASKED***');
      expect(entry.requestHeaders?.['other_header']).toBe('not-masked');
    });
  });

  describe('Error Logging', () => {
    it('should log errors as strings', () => {
      auditLogger.log('GET', '/path', 500, 100, {
        error: new Error('Connection timeout'),
      });

      const entry = loggedEntries[0];
      expect(entry.error).toContain('Connection timeout');
    });

    it('should log string errors', () => {
      auditLogger.log('POST', '/path', 400, 50, {
        error: 'Validation failed',
      });

      expect(loggedEntries[0].error).toBe('Validation failed');
    });

    it('should include stack trace when enabled', () => {
      const logger = new AuditLogger({
        includeStackTrace: true,
        logger: (entry) => loggedEntries.push(entry),
      });

      const error = new Error('Test error');
      logger.log('GET', '/path', 500, 100, { error });

      // Stack trace should contain 'at ' which indicates file location
      expect(loggedEntries[0].error).toContain('at ');
    });

    it('should exclude stack trace when disabled', () => {
      const error = new Error('Test error');
      auditLogger.log('GET', '/path', 500, 100, { error });

      // Should just contain the message, not stack
      expect(loggedEntries[0].error).toBe('Test error');
      expect(loggedEntries[0].error).not.toContain('at ');
    });
  });

  describe('Selective Logging', () => {
    it('should respect logHeaders setting', () => {
      const noHeadersLogger = new AuditLogger({
        logHeaders: false,
        logger: (entry) => loggedEntries.push(entry),
      });

      noHeadersLogger.log('GET', '/path', 200, 10, {
        headers: { 'Content-Type': 'application/json' },
      });

      expect(loggedEntries[0].requestHeaders).toBeUndefined();
    });

    it('should respect logRequestBody setting', () => {
      const noBodyLogger = new AuditLogger({
        logRequestBody: false,
        logger: (entry) => loggedEntries.push(entry),
      });

      noBodyLogger.log('POST', '/path', 200, 20, {
        requestBody: { key: 'value' },
      });

      expect(loggedEntries[0].requestBody).toBeUndefined();
    });

    it('should respect logResponseData setting', () => {
      const noResponseLogger = new AuditLogger({
        logResponseData: false,
        logger: (entry) => loggedEntries.push(entry),
      });

      noResponseLogger.log('GET', '/path', 200, 10, {
        responseData: { key: 'value' },
      });

      expect(loggedEntries[0].responseData).toBeUndefined();
    });

    it('should log response data when enabled', () => {
      auditLogger.log('GET', '/path', 200, 10, {
        responseData: { status: 'success', data: 'test' },
      });

      expect(loggedEntries[0].responseData).toEqual({ status: 'success', data: 'test' });
    });
  });

  describe('User Identification', () => {
    it('should include userId when provided', () => {
      auditLogger.log('GET', '/path', 200, 10, {
        userId: 'user-123',
      });

      expect(loggedEntries[0].userId).toBe('user-123');
    });

    it('should exclude userId when not provided', () => {
      auditLogger.log('GET', '/path', 200, 10, {});

      expect(loggedEntries[0].userId).toBeUndefined();
    });
  });

  describe('Custom Logger Function', () => {
    it('should call custom logger function', () => {
      const logSpy = vi.fn();
      const customLogger = new AuditLogger({ logger: logSpy });

      customLogger.log('GET', '/path', 200, 10);

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/path',
          statusCode: 200,
        })
      );
    });

    it('should pass complete AuditLogEntry to logger', () => {
      const logSpy = vi.fn();
      const logger = new AuditLogger({ logger: logSpy });

      logger.log('POST', '/v1/order', 201, 150, {
        userId: 'user-1',
        requestBody: { symbol: 'BTC' },
      });

      const entry = logSpy.mock.calls[0][0];
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('method', 'POST');
      expect(entry).toHaveProperty('path', '/v1/order');
      expect(entry).toHaveProperty('statusCode', 201);
      expect(entry).toHaveProperty('duration', 150);
    });
  });

  describe('HTTP Status Codes', () => {
    it('should handle various success codes', () => {
      auditLogger.log('GET', '/path', 200, 10);
      auditLogger.log('POST', '/path', 201, 20);
      auditLogger.log('DELETE', '/path', 204, 30);

      expect(loggedEntries[0].statusCode).toBe(200);
      expect(loggedEntries[1].statusCode).toBe(201);
      expect(loggedEntries[2].statusCode).toBe(204);
    });

    it('should handle error codes', () => {
      auditLogger.log('GET', '/path', 400, 10, { error: 'Bad request' });
      auditLogger.log('GET', '/path', 401, 15, { error: 'Unauthorized' });
      auditLogger.log('GET', '/path', 404, 20, { error: 'Not found' });
      auditLogger.log('GET', '/path', 500, 25, { error: 'Server error' });

      expect(loggedEntries[0].statusCode).toBe(400);
      expect(loggedEntries[1].statusCode).toBe(401);
      expect(loggedEntries[2].statusCode).toBe(404);
      expect(loggedEntries[3].statusCode).toBe(500);
    });
  });

  describe('Factory Function', () => {
    it('should create logger with createAuditLogger', () => {
      const entries: AuditLogEntry[] = [];
      const logger = createAuditLogger({
        logger: (entry) => entries.push(entry),
      });

      logger.log('GET', '/path', 200, 10);

      expect(entries).toHaveLength(1);
      expect(entries[0].method).toBe('GET');
    });

    it('should support custom configuration', () => {
      const entries: AuditLogEntry[] = [];
      const logger = createAuditLogger({
        logHeaders: false,
        logRequestBody: false,
        logger: (entry) => entries.push(entry),
      });

      logger.log('POST', '/path', 200, 10, {
        headers: { 'X-API-Key': 'key' },
        requestBody: { data: 'test' },
      });

      expect(entries[0].requestHeaders).toBeUndefined();
      expect(entries[0].requestBody).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', () => {
      auditLogger.log('GET', '/path', 200, 10, {
        requestBody: { key: null },
        responseData: { result: null },
      });

      expect(loggedEntries[0].requestBody).toEqual({ key: null });
      expect(loggedEntries[0].responseData).toEqual({ result: null });
    });

    it('should handle undefined values', () => {
      auditLogger.log('GET', '/path', 200, 10, {
        requestBody: { key: undefined },
      });

      // JSON.stringify removes undefined, so it won't be in the output
      expect(loggedEntries[0].requestBody).toBeDefined();
    });

    it('should handle empty objects', () => {
      auditLogger.log('GET', '/path', 200, 10, {
        requestBody: {},
        headers: {},
      });

      expect(loggedEntries[0].requestBody).toEqual({});
      expect(loggedEntries[0].requestHeaders).toEqual({});
    });

    it('should handle very large request bodies', () => {
      const largeBody = {
        data: new Array(1000).fill({ key: 'value' }),
      };

      auditLogger.log('POST', '/path', 200, 100, {
        requestBody: largeBody,
      });

      expect(loggedEntries).toHaveLength(1);
      expect((loggedEntries[0].requestBody as any)?.data).toHaveLength(1000);
    });

    it('should handle special characters in paths', () => {
      auditLogger.log('GET', '/v1/order/123?symbol=BTC&size=0.1', 200, 10);
      auditLogger.log('POST', '/v1/orders/(bulk)', 200, 20);

      expect(loggedEntries[0].path).toBe('/v1/order/123?symbol=BTC&size=0.1');
      expect(loggedEntries[1].path).toBe('/v1/orders/(bulk)');
    });
  });
});
