import type { FastifyInstance } from 'fastify';
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export function registerMetricsRoute(app: FastifyInstance) {
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return reply.send(await register.metrics());
  });
}
