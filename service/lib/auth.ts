import type { FastifyRequest, FastifyReply } from 'fastify';

// TODO: replace with JWT or mTLS. This is a simple shared-secret header check.
export async function serviceAuthHook(req: FastifyRequest, reply: FastifyReply) {
  const expected = process.env.SERVICE_AUTH_TOKEN;
  if (!expected) return; // auth disabled if not set
  const got = req.headers['authorization'];
  if (got !== `Bearer ${expected}`) {
    return reply.status(401).send({ error: 'unauthorized' });
  }
}

