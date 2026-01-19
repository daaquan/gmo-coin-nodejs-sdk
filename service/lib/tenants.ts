import { z } from 'zod';

export type Creds = { apiKey: string; secret: string };
export type TenantQuery = { tenant?: string };

const BaseEnv = z.object({
  FX_API_KEY: z.string().optional(),
  FX_API_SECRET: z.string().optional(),
});

export function getCreds(tenantId?: string): Creds {
  const base = BaseEnv.parse(process.env);
  if (!tenantId) {
    if (!base.FX_API_KEY || !base.FX_API_SECRET) throw new Error('missing_credentials');
    return { apiKey: base.FX_API_KEY, secret: base.FX_API_SECRET } as Creds;
  }
  const key = process.env[`FX_API_KEY__${tenantId}`];
  const sec = process.env[`FX_API_SECRET__${tenantId}`];
  if (key && sec) return { apiKey: key, secret: sec };
  // fallback to base
  if (!base.FX_API_KEY || !base.FX_API_SECRET) throw new Error('missing_credentials');
  return { apiKey: base.FX_API_KEY, secret: base.FX_API_SECRET } as Creds;
}

export function tenantFromReq(
  headers: Record<string, string | string[] | undefined>,
  query?: TenantQuery,
): string | undefined {
  return (headers['x-tenant-id'] as string | undefined) || (query?.tenant as string | undefined);
}
