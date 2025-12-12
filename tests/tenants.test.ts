/**
 * Tests for service/lib/tenants.ts
 * Multi-tenant credential management
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Creds, TenantQuery } from '../service/lib/tenants.js';

describe('Tenants module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getCreds', () => {
    describe('Without tenantId', () => {
      it('should return base credentials from FX_API_KEY/FX_API_SECRET', async () => {
        process.env.FX_API_KEY = 'base-api-key';
        process.env.FX_API_SECRET = 'base-secret';

        const { getCreds } = await import('../service/lib/tenants.js');
        const creds: Creds = getCreds();

        expect(creds.apiKey).toBe('base-api-key');
        expect(creds.secret).toBe('base-secret');
      });

      it('should throw "missing_credentials" when FX_API_KEY not set', async () => {
        delete process.env.FX_API_KEY;
        process.env.FX_API_SECRET = 'base-secret';

        // Need to reimport to get fresh state
        const { getCreds } = await import('../service/lib/tenants.js');

        expect(() => getCreds()).toThrow('missing_credentials');
      });

      it('should throw "missing_credentials" when FX_API_SECRET not set', async () => {
        process.env.FX_API_KEY = 'base-api-key';
        delete process.env.FX_API_SECRET;

        const { getCreds } = await import('../service/lib/tenants.js');

        expect(() => getCreds()).toThrow('missing_credentials');
      });

      it('should throw "missing_credentials" when both not set', async () => {
        delete process.env.FX_API_KEY;
        delete process.env.FX_API_SECRET;

        const { getCreds } = await import('../service/lib/tenants.js');

        expect(() => getCreds()).toThrow('missing_credentials');
      });
    });

    describe('With tenantId', () => {
      it('should return tenant-specific credentials when available', async () => {
        process.env.FX_API_KEY = 'base-key';
        process.env.FX_API_SECRET = 'base-secret';
        process.env['FX_API_KEY__tenant1'] = 'tenant1-key';
        process.env['FX_API_SECRET__tenant1'] = 'tenant1-secret';

        const { getCreds } = await import('../service/lib/tenants.js');
        const creds: Creds = getCreds('tenant1');

        expect(creds.apiKey).toBe('tenant1-key');
        expect(creds.secret).toBe('tenant1-secret');
      });

      it('should fallback to base credentials when tenant-specific not available', async () => {
        process.env.FX_API_KEY = 'base-key';
        process.env.FX_API_SECRET = 'base-secret';
        // tenant2 credentials not set

        const { getCreds } = await import('../service/lib/tenants.js');
        const creds: Creds = getCreds('tenant2');

        expect(creds.apiKey).toBe('base-key');
        expect(creds.secret).toBe('base-secret');
      });

      it('should fallback when only tenant key is set', async () => {
        process.env.FX_API_KEY = 'base-key';
        process.env.FX_API_SECRET = 'base-secret';
        process.env['FX_API_KEY__tenant3'] = 'tenant3-key';
        // FX_API_SECRET__tenant3 not set

        const { getCreds } = await import('../service/lib/tenants.js');
        const creds: Creds = getCreds('tenant3');

        // Should fallback to base
        expect(creds.apiKey).toBe('base-key');
        expect(creds.secret).toBe('base-secret');
      });

      it('should fallback when only tenant secret is set', async () => {
        process.env.FX_API_KEY = 'base-key';
        process.env.FX_API_SECRET = 'base-secret';
        process.env['FX_API_SECRET__tenant4'] = 'tenant4-secret';
        // FX_API_KEY__tenant4 not set

        const { getCreds } = await import('../service/lib/tenants.js');
        const creds: Creds = getCreds('tenant4');

        // Should fallback to base
        expect(creds.apiKey).toBe('base-key');
        expect(creds.secret).toBe('base-secret');
      });

      it('should throw when neither tenant nor base credentials available', async () => {
        delete process.env.FX_API_KEY;
        delete process.env.FX_API_SECRET;
        // No tenant credentials either

        const { getCreds } = await import('../service/lib/tenants.js');

        expect(() => getCreds('tenant5')).toThrow('missing_credentials');
      });

      it('should handle special characters in tenant ID', async () => {
        process.env.FX_API_KEY = 'base-key';
        process.env.FX_API_SECRET = 'base-secret';
        process.env['FX_API_KEY__tenant-with-dash'] = 'dash-key';
        process.env['FX_API_SECRET__tenant-with-dash'] = 'dash-secret';

        const { getCreds } = await import('../service/lib/tenants.js');
        const creds: Creds = getCreds('tenant-with-dash');

        expect(creds.apiKey).toBe('dash-key');
        expect(creds.secret).toBe('dash-secret');
      });
    });
  });

  describe('tenantFromReq', () => {
    it('should extract tenant from x-tenant-id header', async () => {
      const { tenantFromReq } = await import('../service/lib/tenants.js');

      const headers: Record<string, string | string[] | undefined> = {
        'x-tenant-id': 'header-tenant',
      };
      const query: TenantQuery = {};

      const result = tenantFromReq(headers, query);
      expect(result).toBe('header-tenant');
    });

    it('should extract tenant from query parameter', async () => {
      const { tenantFromReq } = await import('../service/lib/tenants.js');

      const headers: Record<string, string | string[] | undefined> = {};
      const query: TenantQuery = { tenant: 'query-tenant' };

      const result = tenantFromReq(headers, query);
      expect(result).toBe('query-tenant');
    });

    it('should prefer header over query parameter', async () => {
      const { tenantFromReq } = await import('../service/lib/tenants.js');

      const headers: Record<string, string | string[] | undefined> = {
        'x-tenant-id': 'header-tenant',
      };
      const query: TenantQuery = { tenant: 'query-tenant' };

      const result = tenantFromReq(headers, query);
      expect(result).toBe('header-tenant');
    });

    it('should return undefined when neither header nor query provided', async () => {
      const { tenantFromReq } = await import('../service/lib/tenants.js');

      const headers: Record<string, string | string[] | undefined> = {};
      const query: TenantQuery = {};

      const result = tenantFromReq(headers, query);
      expect(result).toBeUndefined();
    });

    it('should return undefined when query is undefined', async () => {
      const { tenantFromReq } = await import('../service/lib/tenants.js');

      const headers: Record<string, string | string[] | undefined> = {};

      const result = tenantFromReq(headers, undefined);
      expect(result).toBeUndefined();
    });

    it('should handle empty header value', async () => {
      const { tenantFromReq } = await import('../service/lib/tenants.js');

      const headers: Record<string, string | string[] | undefined> = {
        'x-tenant-id': '',
      };
      const query: TenantQuery = { tenant: 'query-tenant' };

      // Empty string is falsy, should fallback to query
      const result = tenantFromReq(headers, query);
      expect(result).toBe('query-tenant');
    });
  });

  describe('Type definitions', () => {
    it('Creds type should have apiKey and secret', () => {
      const creds: Creds = {
        apiKey: 'test-key',
        secret: 'test-secret',
      };

      expect(typeof creds.apiKey).toBe('string');
      expect(typeof creds.secret).toBe('string');
    });

    it('TenantQuery type should have optional tenant', () => {
      const queryWithTenant: TenantQuery = { tenant: 'my-tenant' };
      const queryWithoutTenant: TenantQuery = {};

      expect(queryWithTenant.tenant).toBe('my-tenant');
      expect(queryWithoutTenant.tenant).toBeUndefined();
    });
  });
});
