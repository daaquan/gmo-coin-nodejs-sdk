import Fastify from 'fastify';
import pino from 'pino';
import dotenv from 'dotenv';
import { registerAccountRoutes } from './routes/account.js';
import { registerOrderRoutes } from './routes/orders.js';
import { registerPositionRoutes } from './routes/positions.js';
import { registerStreamRoutes } from './routes/stream.js';
import { serviceAuthHook } from './lib/auth.js';
import { registerMetricsRoute } from './routes/metrics.js';
import { registerWsAuthRoutes } from './routes/ws-auth.js';

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = Fastify({ logger: logger as any });

// Simple service-level auth (optional). TODO: replace with JWT/mTLS in production
app.addHook('onRequest', serviceAuthHook);

// Health
app.get('/health', async () => ({ ok: true }));

// Register domain routes
registerAccountRoutes(app);
registerOrderRoutes(app);
registerPositionRoutes(app);
registerStreamRoutes(app);
registerMetricsRoute(app);
registerWsAuthRoutes(app);

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

app
  .listen({ port, host })
  .then((addr) => app.log.info({ msg: 'service started', addr }))
  .catch((err) => {
    app.log.error(err, 'failed to start');
    process.exit(1);
  });
