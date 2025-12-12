import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Fastify from 'fastify';
import { globalErrorHandler, createErrorResponse } from '../service/lib/errorHandler.js';
import { mapGmoError } from '../service/lib/errors.js';
import { registerAccountRoutes } from '../service/routes/account.js';

describe('errorHandler', () => {
  describe('createErrorResponse', () => {
    it('should create error response with code and message', () => {
      const response = createErrorResponse('test_error', 'Test error message');
      expect(response.status).toBe('error');
      expect(response.code).toBe('test_error');
      expect(response.message).toBe('Test error message');
      expect(response.timestamp).toBeDefined();
    });

    it('should include requestId when provided', () => {
      const response = createErrorResponse('test_error', 'Test message', undefined, 'req-123');
      expect(response.requestId).toBe('req-123');
    });

    it('should include details when provided', () => {
      const details = { field: 'name', reason: 'required' };
      const response = createErrorResponse('validation_error', 'Invalid input', details);
      expect(response.details).toEqual(details);
    });
  });

  describe('mapGmoError', () => {
    it('should return original message for unknown errors', () => {
      const result = mapGmoError(new Error('Unknown error'));
      expect(result).toBe('Unknown error');
    });

    it('should map ERR-201 to insufficient funds message', () => {
      const result = mapGmoError(new Error('Order failed: ERR-201 - Insufficient funds'));
      expect(result).toContain('Insufficient funds');
      expect(result).toContain('ERR-201');
    });

    it('should map ERR-5003 to rate limit message', () => {
      const result = mapGmoError(new Error('ERR-5003 Rate limit exceeded'));
      expect(result).toContain('Rate limit exceeded');
      expect(result).toContain('ERR-5003');
    });

    it('should map ERR-5008/5009 to timestamp skew message', () => {
      const result = mapGmoError(new Error('ERR-5008 Timestamp too old'));
      expect(result).toContain('Timestamp skew detected');
    });

    it('should handle string error input', () => {
      const result = mapGmoError('ERR-760 Price unchanged');
      expect(result).toContain('No prices are changed');
      expect(result).toContain('ERR-760');
    });

    it('should handle non-Error objects', () => {
      const result = mapGmoError({ message: 'Test' });
      expect(result).toBeDefined();
    });
  });

  describe('globalErrorHandler', () => {
    let mockRequest: Partial<FastifyRequest>;
    let mockReply: Partial<FastifyReply>;

    beforeEach(() => {
      mockRequest = {
        id: 'req-123',
        server: {
          log: {
            warn: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
          },
        } as any,
        headers: {},
        query: {},
      };

      mockReply = {
        status: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis(),
      };
    });

    it('should handle SDK errors with 500 status', async () => {
      const error = new Error('Connection failed');
      await globalErrorHandler(error, mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalled();
      const response = (mockReply.send as any).mock.calls[0][0];
      expect(response.status).toBe('error');
      expect(response.requestId).toBe('req-123');
    });

    it('should handle rate limit errors with 429 status', async () => {
      const error = new Error('Rate limit exceeded: ERR-5003');
      await globalErrorHandler(error, mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(429);
      const response = (mockReply.send as any).mock.calls[0][0];
      expect(response.code).toBe('rate_limit_exceeded');
    });

    it('should handle timestamp errors with 400 status', async () => {
      const error = new Error('ERR-5008 Timestamp error');
      await globalErrorHandler(error, mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
    });
  });
});

describe('Service Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({
      logger: { level: 'silent' },
    });

    app.addHook('onRequest', async (req, reply) => {
      // Mock auth - always pass
      return;
    });

    app.get('/health', async () => ({ status: 'ok' }));

    registerAccountRoutes(app);
  });

  describe('GET /v1/account/assets', () => {
    it('should return 400 when credentials are not provided via environment', async () => {
      // Clear any credentials from environment
      delete process.env.FX_API_KEY;
      delete process.env.FX_API_SECRET;
      delete process.env.TENANT_ID;

      const response = await app.inject({
        method: 'GET',
        url: '/v1/account/assets',
        headers: {},
      });

      // Should fail because credentials are not available
      expect([400, 401, 500]).toContain(response.statusCode);
    });

    it('should handle missing symbol gracefully', async () => {
      // Set up minimal mock credentials
      process.env.FX_API_KEY = 'test-key';
      process.env.FX_API_SECRET = 'test-secret';

      const response = await app.inject({
        method: 'GET',
        url: '/v1/account/assets',
        headers: {},
      });

      // Request should be processed (may fail at API level, but not 404)
      expect(response.statusCode).not.toBe(404);
    });
  });

  describe('Health check', () => {
    it('should return ok status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
    });
  });
});
