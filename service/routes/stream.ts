import type { FastifyInstance } from 'fastify';

export function registerStreamRoutes(app: FastifyInstance) {
  // Simple proxy for stream data if needed
  app.post('/v1/stream/decode', async (req, reply) => {
    const body = req.body as { payload?: string };
    const payload = body.payload;
    if (!payload) return reply.status(400).send({ error: 'payload_missing' });

    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
      return reply.send({ data: decoded });
    } catch (e) {
      return reply.status(400).send({ error: 'decode_failed', detail: String(e) });
    }
  });
}