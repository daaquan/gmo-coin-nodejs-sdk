import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJwt } from './jwt.js';

type Mode = 'disabled' | 'jwt' | 'shared';

function getMode(): Mode {
  const v = (process.env.SERVICE_AUTH_MODE || 'disabled').toLowerCase();
  if (v === 'jwt' || v === 'shared' || v === 'disabled') return v;
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

  const token = getBearer(req);
  if (!token) return reply.status(401).send({ error: 'Missing or invalid token' });

  if (mode === 'shared') {
    const expected = process.env.SERVICE_AUTH_TOKEN;
    if (!expected) {
      return reply.status(500).send({ error: 'SERVICE_AUTH_TOKEN not set' });
    }
    if (token !== expected) {
      return reply.status(401).send({ error: 'Token verification failed' });
    }
    (req as any).user = { sub: 'shared-token' };
    return;
  }

  // mode === 'jwt'
  try {
    const options: any = {
      jwksUrl: process.env.JWKS_URL || '',
    };

    if (process.env.JWT_ISSUER) options.issuer = process.env.JWT_ISSUER;
    if (process.env.JWT_AUDIENCE) options.audience = process.env.JWT_AUDIENCE;

    const payload = await verifyJwt(token, options);
    (req as any).user = payload;
  } catch {
    return reply.status(401).send({ error: 'Token verification failed' });
  }
}
