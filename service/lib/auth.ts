import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJwt } from './jwt.js';

type Mode = 'disabled' | 'jwt' | 'shared';

function getMode(): Mode {
  const v = (process.env.SERVICE_AUTH_MODE || '').toLowerCase();
  if (v === 'jwt') return 'jwt';
  if (v === 'shared') return 'shared';
  if (process.env.SERVICE_AUTH_TOKEN) return 'shared';
  return 'disabled';
}

function getBearer(req: FastifyRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  return token || null;
}

export async function serviceAuthHook(req: FastifyRequest, reply: FastifyReply) {
  // Allow unauthenticated health checks (for Docker/K8s)
  if (req.url === '/health') return;

  const mode = getMode();
  if (mode === 'disabled') return;

  if (mode === 'shared') {
    const expected = process.env.SERVICE_AUTH_TOKEN;
    if (!expected) {
      return reply.status(500).send({ error: 'SERVICE_AUTH_TOKEN not set' });
    }
    const token = getBearer(req);
    if (!token || token !== expected) {
      return reply.status(401).send({ error: 'unauthorized' });
    }
    (req as any).user = { sub: 'shared-token' };
    return;
  }

  // mode === 'jwt'
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return reply.status(401).send({ error: 'unauthorized_jwt' });
    }

    const options: any = {
      jwksUrl: process.env.JWKS_URL || '',
      issuer: process.env.JWT_ISSUER,
    };
    if (process.env.JWT_AUDIENCE) options.audience = process.env.JWT_AUDIENCE;

    const payload = await verifyJwt(authHeader, options);
    (req as any).user = payload;
  } catch {
    return reply.status(401).send({ error: 'unauthorized_jwt' });
  }
}
