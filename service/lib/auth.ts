import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJwt } from './jwt.js';

export async function serviceAuthHook(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) return reply.status(401).send({ error: 'Token empty' });

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