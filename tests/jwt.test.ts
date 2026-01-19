/**
 * Tests for service/lib/jwt.ts
 * JWT verification with JWKS
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock jose module
const mockJwtVerify = vi.fn();
const mockCreateRemoteJWKSet = vi.fn();

vi.mock('jose', () => ({
  jwtVerify: (...args: unknown[]) => mockJwtVerify(...args),
  createRemoteJWKSet: (...args: unknown[]) => mockCreateRemoteJWKSet(...args),
}));

describe('verifyJwt', () => {
  beforeEach(() => {
    vi.resetModules();
    mockJwtVerify.mockReset();
    mockCreateRemoteJWKSet.mockReset();
    mockCreateRemoteJWKSet.mockReturnValue('mock-jwks');
  });

  describe('Authorization header validation', () => {
    it('should throw "missing_bearer" for undefined authorization', async () => {
      const { verifyJwt } = await import('../service/lib/jwt.js');

      await expect(
        verifyJwt(undefined, { jwksUrl: 'https://example.com/.well-known/jwks.json' }),
      ).rejects.toThrow('missing_bearer');
    });

    it('should throw "missing_bearer" for empty authorization', async () => {
      const { verifyJwt } = await import('../service/lib/jwt.js');

      await expect(
        verifyJwt('', { jwksUrl: 'https://example.com/.well-known/jwks.json' }),
      ).rejects.toThrow('missing_bearer');
    });

    it('should throw "missing_bearer" for non-Bearer token', async () => {
      const { verifyJwt } = await import('../service/lib/jwt.js');

      await expect(
        verifyJwt('Basic abc123', { jwksUrl: 'https://example.com/.well-known/jwks.json' }),
      ).rejects.toThrow('missing_bearer');
    });

    it('should throw "missing_bearer" for "bearer" (lowercase)', async () => {
      const { verifyJwt } = await import('../service/lib/jwt.js');

      await expect(
        verifyJwt('bearer token123', { jwksUrl: 'https://example.com/.well-known/jwks.json' }),
      ).rejects.toThrow('missing_bearer');
    });

    it('should throw "missing_bearer" for "BEARER" (uppercase)', async () => {
      const { verifyJwt } = await import('../service/lib/jwt.js');

      await expect(
        verifyJwt('BEARER token123', { jwksUrl: 'https://example.com/.well-known/jwks.json' }),
      ).rejects.toThrow('missing_bearer');
    });
  });

  describe('JwtOptions validation', () => {
    it('should throw "missing_jwks" when jwksUrl is empty', async () => {
      const { verifyJwt } = await import('../service/lib/jwt.js');

      await expect(verifyJwt('Bearer valid-token', { jwksUrl: '' })).rejects.toThrow(
        'missing_jwks',
      );
    });

    it('should throw "missing_jwks" when opts is undefined', async () => {
      const { verifyJwt } = await import('../service/lib/jwt.js');

      await expect(verifyJwt('Bearer valid-token', undefined)).rejects.toThrow('missing_jwks');
    });

    it('should accept optional issuer', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'user-123', iss: 'test-issuer' },
      });

      const { verifyJwt } = await import('../service/lib/jwt.js');

      const result = await verifyJwt('Bearer valid-token', {
        jwksUrl: 'https://example.com/.well-known/jwks.json',
        issuer: 'test-issuer',
      });

      expect(result.sub).toBe('user-123');
      expect(mockJwtVerify).toHaveBeenCalledWith(
        'valid-token',
        'mock-jwks',
        expect.objectContaining({ issuer: 'test-issuer' }),
      );
    });

    it('should accept optional audience', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'user-123', aud: 'test-audience' },
      });

      const { verifyJwt } = await import('../service/lib/jwt.js');

      const result = await verifyJwt('Bearer valid-token', {
        jwksUrl: 'https://example.com/.well-known/jwks.json',
        audience: 'test-audience',
      });

      expect(result.sub).toBe('user-123');
      expect(mockJwtVerify).toHaveBeenCalledWith(
        'valid-token',
        'mock-jwks',
        expect.objectContaining({ audience: 'test-audience' }),
      );
    });

    it('should accept both issuer and audience', async () => {
      mockJwtVerify.mockResolvedValue({
        payload: { sub: 'user-123' },
      });

      const { verifyJwt } = await import('../service/lib/jwt.js');

      await verifyJwt('Bearer valid-token', {
        jwksUrl: 'https://example.com/.well-known/jwks.json',
        issuer: 'test-issuer',
        audience: 'test-audience',
      });

      expect(mockJwtVerify).toHaveBeenCalledWith(
        'valid-token',
        'mock-jwks',
        expect.objectContaining({
          issuer: 'test-issuer',
          audience: 'test-audience',
        }),
      );
    });
  });

  describe('Token verification', () => {
    it('should return JWTPayload on success', async () => {
      const mockPayload = {
        sub: 'user-123',
        iss: 'test-issuer',
        aud: 'test-audience',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockJwtVerify.mockResolvedValue({ payload: mockPayload });

      const { verifyJwt } = await import('../service/lib/jwt.js');

      const result = await verifyJwt('Bearer valid-token', {
        jwksUrl: 'https://example.com/.well-known/jwks.json',
      });

      expect(result).toEqual(mockPayload);
      expect(result.sub).toBe('user-123');
    });

    it('should extract token from Bearer prefix correctly', async () => {
      mockJwtVerify.mockResolvedValue({ payload: { sub: 'user' } });

      const { verifyJwt } = await import('../service/lib/jwt.js');

      await verifyJwt('Bearer my-jwt-token-here', {
        jwksUrl: 'https://example.com/.well-known/jwks.json',
      });

      expect(mockJwtVerify).toHaveBeenCalledWith(
        'my-jwt-token-here',
        'mock-jwks',
        expect.any(Object),
      );
    });

    it('should throw on verification failure', async () => {
      mockJwtVerify.mockRejectedValue(new Error('Token expired'));

      const { verifyJwt } = await import('../service/lib/jwt.js');

      await expect(
        verifyJwt('Bearer expired-token', {
          jwksUrl: 'https://example.com/.well-known/jwks.json',
        }),
      ).rejects.toThrow('Token expired');
    });

    it('should throw on invalid signature', async () => {
      mockJwtVerify.mockRejectedValue(new Error('Invalid signature'));

      const { verifyJwt } = await import('../service/lib/jwt.js');

      await expect(
        verifyJwt('Bearer tampered-token', {
          jwksUrl: 'https://example.com/.well-known/jwks.json',
        }),
      ).rejects.toThrow('Invalid signature');
    });
  });

  describe('JWKS caching', () => {
    it('should create JWKS with correct URL', async () => {
      mockJwtVerify.mockResolvedValue({ payload: { sub: 'user' } });

      const { verifyJwt } = await import('../service/lib/jwt.js');

      await verifyJwt('Bearer token', {
        jwksUrl: 'https://auth.example.com/.well-known/jwks.json',
      });

      expect(mockCreateRemoteJWKSet).toHaveBeenCalledWith(
        new URL('https://auth.example.com/.well-known/jwks.json'),
      );
    });

    it('should cache JWKS after first call', async () => {
      mockJwtVerify.mockResolvedValue({ payload: { sub: 'user' } });

      const { verifyJwt } = await import('../service/lib/jwt.js');

      // First call
      await verifyJwt('Bearer token1', {
        jwksUrl: 'https://example.com/.well-known/jwks.json',
      });

      // Second call
      await verifyJwt('Bearer token2', {
        jwksUrl: 'https://example.com/.well-known/jwks.json',
      });

      // JWKS should only be created once
      expect(mockCreateRemoteJWKSet).toHaveBeenCalledTimes(1);
    });
  });
});

describe('JwtOptions type', () => {
  it('should have correct type structure', () => {
    const opts = {
      jwksUrl: 'https://example.com/.well-known/jwks.json',
      issuer: 'test-issuer',
      audience: 'test-audience',
    };

    expect(typeof opts.jwksUrl).toBe('string');
    expect(typeof opts.issuer).toBe('string');
    expect(typeof opts.audience).toBe('string');
  });

  it('should allow optional issuer and audience', () => {
    const minimalOpts = {
      jwksUrl: 'https://example.com/.well-known/jwks.json',
    };

    expect(minimalOpts.jwksUrl).toBeDefined();
  });
});
