import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJwt } from './jwt.js';

// Auth modes:
// - SERVICE_AUTH_MODE=jwt: verify with JWKS (JWKS_URL required; optional JWT_ISSUER/JWT_AUDIENCE)
// - else if SERVICE_AUTH_TOKEN: simple shared-secret bearer
// - else: disabled
export async function serviceAuthHook(req: FastifyRequest, reply: FastifyReply) {
  const mode = process.env.SERVICE_AUTH_MODE;
  const got = req.headers['authorization'] as string | undefined;

  if (mode === 'jwt') {
    try {
      await verifyJwt(got, {
        jwksUrl: process.env.JWKS_URL || '',
        issuer: process.env.JWT_ISSUER || undefined,
        audience: process.env.JWT_AUDIENCE || undefined,
      });
      return;
    } catch {
      return reply.status(401).send({ error: 'unauthorized_jwt' });
    }
  }

  const shared = process.env.SERVICE_AUTH_TOKEN;
  if (!shared) return; // disabled
  if (got !== `Bearer ${shared}`) {
    return reply.status(401).send({ error: 'unauthorized' });
  }
}
