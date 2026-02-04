import { z } from 'zod';

export type Creds = { apiKey: string; secret: string };
export type TenantQuery = { tenant?: string };

const BaseEnv = z.object({
  FX_API_KEY: z.string().optional(),
  FX_API_SECRET: z.string().optional(),
  CRYPTO_API_KEY: z.string().optional(),
  CRYPTO_API_SECRET: z.string().optional(),
});

function getByPrefix(prefix: 'FX' | 'CRYPTO', tenantId?: string): Creds {
  const base = BaseEnv.parse(process.env);

  const baseKey = (prefix === 'FX' ? base.FX_API_KEY : base.CRYPTO_API_KEY) || undefined;
  const baseSec = (prefix === 'FX' ? base.FX_API_SECRET : base.CRYPTO_API_SECRET) || undefined;

  if (!tenantId) {
    if (!baseKey || !baseSec) throw new Error('missing_credentials');
    return { apiKey: baseKey, secret: baseSec };
  }

  const key = process.env[`${prefix}_API_KEY__${tenantId}`];
  const sec = process.env[`${prefix}_API_SECRET__${tenantId}`];
  if (key && sec) return { apiKey: key, secret: sec };

  if (!baseKey || !baseSec) throw new Error('missing_credentials');
  return { apiKey: baseKey, secret: baseSec };
}

/**
 * Back-compat: returns FX creds.
 * Prefer getFxCreds / getCryptoCreds.
 */
export function getCreds(tenantId?: string): Creds {
  return getByPrefix('FX', tenantId);
}

export function getFxCreds(tenantId?: string): Creds {
  return getByPrefix('FX', tenantId);
}

export function getCryptoCreds(tenantId?: string): Creds {
  return getByPrefix('CRYPTO', tenantId);
}

export function tenantFromReq(
  headers: Record<string, string | string[] | undefined>,
  query?: TenantQuery,
): string | undefined {
  return (headers['x-tenant-id'] as string | undefined) || (query?.tenant as string | undefined);
}
