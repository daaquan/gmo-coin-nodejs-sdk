/**
 * Tests for service/lib/auth.ts
 * Service authentication hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRequest, createMockReply } from './helpers/mockTypes.js';

// Mock verifyJwt
const mockVerifyJwt = vi.fn();

vi.mock('../service/lib/jwt.js', () => ({
  verifyJwt: (...args: unknown[]) => mockVerifyJwt(...args),
}));

describe('serviceAuthHook', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    mockVerifyJwt.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('JWT mode (SERVICE_AUTH_MODE=jwt)', () => {
    beforeEach(() => {
      process.env.SERVICE_AUTH_MODE = 'jwt';
      process.env.JWKS_URL = 'https://auth.example.com/.well-known/jwks.json';
    });

    it('should verify JWT and return on success', async () => {
      mockVerifyJwt.mockResolvedValue({ sub: 'user-123' });

      const { serviceAuthHook } = await import('../service/lib/auth.js');
      const req = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      });
      const reply = createMockReply();

      await serviceAuthHook(req as any, reply as any);

      expect(mockVerifyJwt).toHaveBeenCalledWith(
        'Bearer valid-token',
        expect.objectContaining({
          jwksUrl: 'https://auth.example.com/.well-known/jwks.json',
        })
      );
      expect(reply.status).not.toHaveBeenCalled();
    });

    it('should return 401 with error: "unauthorized_jwt" on verification failure', async () => {
      mockVerifyJwt.mockRejectedValue(new Error('Token expired'));

      const { serviceAuthHook } = await import('../service/lib/auth.js');
      const req = createMockRequest({
        headers: { authorization: 'Bearer expired-token' },
      });
      const reply = createMockReply();

      await serviceAuthHook(req as any, reply as any);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({ error: 'unauthorized_jwt' });
    });

    it('should use JWKS_URL from environment', async () => {
      process.env.JWKS_URL = 'https://custom-auth.example.com/jwks';
      mockVerifyJwt.mockResolvedValue({ sub: 'user' });

      const { serviceAuthHook } = await import('../service/lib/auth.js');
      const req = createMockRequest({
        headers: { authorization: 'Bearer token' },
      });
      const reply = createMockReply();

      await serviceAuthHook(req as any, reply as any);

      expect(mockVerifyJwt).toHaveBeenCalledWith(
        'Bearer token',
        expect.objectContaining({
          jwksUrl: 'https://custom-auth.example.com/jwks',
        })
      );
    });

    it('should pass optional JWT_ISSUER to verifyJwt', async () => {
      process.env.JWT_ISSUER = 'https://issuer.example.com';
      mockVerifyJwt.mockResolvedValue({ sub: 'user' });

      const { serviceAuthHook } = await import('../service/lib/auth.js');
      const req = createMockRequest({
        headers: { authorization: 'Bearer token' },
      });
      const reply = createMockReply();

      await serviceAuthHook(req as any, reply as any);

      expect(mockVerifyJwt).toHaveBeenCalledWith(
        'Bearer token',
        expect.objectContaining({
          issuer: 'https://issuer.example.com',
        })
      );
    });

    it('should pass optional JWT_AUDIENCE to verifyJwt', async () => {
      process.env.JWT_AUDIENCE = 'my-api';
      mockVerifyJwt.mockResolvedValue({ sub: 'user' });

      const { serviceAuthHook } = await import('../service/lib/auth.js');
      const req = createMockRequest({
        headers: { authorization: 'Bearer token' },
      });
      const reply = createMockReply();

      await serviceAuthHook(req as any, reply as any);

      expect(mockVerifyJwt).toHaveBeenCalledWith(
        'Bearer token',
        expect.objectContaining({
          audience: 'my-api',
        })
      );
    });

    it('should pass undefined for unset JWT_ISSUER', async () => {
      delete process.env.JWT_ISSUER;
      mockVerifyJwt.mockResolvedValue({ sub: 'user' });

      const { serviceAuthHook } = await import('../service/lib/auth.js');
      const req = createMockRequest({
        headers: { authorization: 'Bearer token' },
      });
      const reply = createMockReply();

      await serviceAuthHook(req as any, reply as any);

      expect(mockVerifyJwt).toHaveBeenCalledWith(
        'Bearer token',
        expect.objectContaining({
          issuer: undefined,
        })
      );
    });

    it('should handle missing authorization header', async () => {
      mockVerifyJwt.mockRejectedValue(new Error('missing_bearer'));

      const { serviceAuthHook } = await import('../service/lib/auth.js');
      const req = createMockRequest({ headers: {} });
      const reply = createMockReply();

      await serviceAuthHook(req as any, reply as any);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({ error: 'unauthorized_jwt' });
    });
  });

  describe('Shared secret mode (SERVICE_AUTH_TOKEN set)', () => {
    beforeEach(() => {
      delete process.env.SERVICE_AUTH_MODE;
      process.env.SERVICE_AUTH_TOKEN = 'shared-secret-token';
    });

    it('should pass when authorization matches Bearer token', async () => {
      const { serviceAuthHook } = await import('../service/lib/auth.js');
      const req = createMockRequest({
        headers: { authorization: 'Bearer shared-secret-token' },
      });
      const reply = createMockReply();

      await serviceAuthHook(req as any, reply as any);

      expect(reply.status).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    it('should return 401 with error: "unauthorized" when token mismatch', async () => {
      const { serviceAuthHook } = await import('../service/lib/auth.js');
      const req = createMockRequest({
        headers: { authorization: 'Bearer wrong-token' },
      });
      const reply = createMockReply();

      await serviceAuthHook(req as any, reply as any);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({ error: 'unauthorized' });
    });

    it('should return 401 when no authorization header', async () => {
      const { serviceAuthHook } = await import('../service/lib/auth.js');
      const req = createMockRequest({ headers: {} });
      const reply = createMockReply();

      await serviceAuthHook(req as any, reply as any);

      expect(reply.status).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({ error: 'unauthorized' });
    });

    it('should return 401 when authorization is not Bearer format', async () => {
      const { serviceAuthHook } = await import('../service/lib/auth.js');
      const req = createMockRequest({
        headers: { authorization: 'Basic shared-secret-token' },
      });
      const reply = createMockReply();

      await serviceAuthHook(req as any, reply as any);

      expect(reply.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Disabled mode (no SERVICE_AUTH_MODE or SERVICE_AUTH_TOKEN)', () => {
    beforeEach(() => {
      delete process.env.SERVICE_AUTH_MODE;
      delete process.env.SERVICE_AUTH_TOKEN;
    });

    it('should pass through without authentication', async () => {
      const { serviceAuthHook } = await import('../service/lib/auth.js');
      const req = createMockRequest({ headers: {} });
      const reply = createMockReply();

      await serviceAuthHook(req as any, reply as any);

      expect(reply.status).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });

    it('should pass through even with invalid authorization header', async () => {
      const { serviceAuthHook } = await import('../service/lib/auth.js');
      const req = createMockRequest({
        headers: { authorization: 'Bearer some-random-token' },
      });
      const reply = createMockReply();

      await serviceAuthHook(req as any, reply as any);

      expect(reply.status).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });
  });

  describe('Mode priority', () => {
    it('should prioritize JWT mode over shared secret', async () => {
      process.env.SERVICE_AUTH_MODE = 'jwt';
      process.env.JWKS_URL = 'https://auth.example.com/jwks';
      process.env.SERVICE_AUTH_TOKEN = 'shared-secret'; // Also set

      mockVerifyJwt.mockResolvedValue({ sub: 'user' });

      const { serviceAuthHook } = await import('../service/lib/auth.js');
      const req = createMockRequest({
        headers: { authorization: 'Bearer jwt-token' },
      });
      const reply = createMockReply();

      await serviceAuthHook(req as any, reply as any);

      // Should use JWT verification, not shared secret
      expect(mockVerifyJwt).toHaveBeenCalled();
    });
  });
});
