import Fastify from 'fastify';
import dotenv from 'dotenv';
import { registerAccountRoutes } from './routes/account.js';
import { registerOrderRoutes } from './routes/orders.js';
import { registerPositionRoutes } from './routes/positions.js';
import { registerStreamRoutes } from './routes/stream.js';
import { serviceAuthHook } from './lib/auth.js';
import { registerMetricsRoute } from './routes/metrics.js';
import { registerWsAuthRoutes } from './routes/ws-auth.js';
import { globalErrorHandler } from './lib/errorHandler.js';

dotenv.config();

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL || 'info' },
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'requestId',
  disableRequestLogging: false,
  trustProxy: process.env.TRUST_PROXY === 'true',
});

// Error handler
app.setErrorHandler(globalErrorHandler);

// Simple service-level auth (optional). TODO: replace with JWT/mTLS in production
app.addHook('onRequest', serviceAuthHook);

// Health check endpoint
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Register domain routes
registerAccountRoutes(app);
registerOrderRoutes(app);
registerPositionRoutes(app);
registerStreamRoutes(app);
registerMetricsRoute(app);
registerWsAuthRoutes(app);

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  app.log.info({ signal }, 'Received signal, starting graceful shutdown');

  try {
    // Close server and wait for ongoing requests to complete
    await app.close();
    app.log.info('Server closed gracefully');
    process.exit(0);
  } catch (err) {
    app.log.error(err, 'Error during graceful shutdown');
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught exception handler
process.on('uncaughtException', (err) => {
  app.log.error(err, 'Uncaught exception');
  process.exit(1);
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  app.log.error({ promise, reason }, 'Unhandled promise rejection');
  process.exit(1);
});

app
  .listen({ port, host })
  .then((addr) => {
    app.log.info({ msg: 'service started', addr, nodeVersion: process.version });
    app.log.info({
      msg: 'environment',
      logLevel: process.env.LOG_LEVEL || 'info',
      authMode: process.env.SERVICE_AUTH_MODE || 'disabled',
    });
  })
  .catch((err) => {
    app.log.error(err, 'failed to start');
    process.exit(1);
  });
