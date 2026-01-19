import { FastifyReply, FastifyError, FastifyRequest } from 'fastify';
import { Result } from '../../src/types.js';
import { z } from 'zod';

/**
 * Handles the Result from SDK and sends appropriate Fastify response
 */
export function handleResult<T>(reply: FastifyReply, result: Result<T>) {
  if (result.success) {
    return reply.send({
      status: 0,
      data: result.data,
      responsetime: new Date().toISOString(),
    });
  }

  const error = result.error;

  if (error instanceof z.ZodError) {
    return reply.status(400).send({
      status: 1,
      error: 'Validation Error',
      details: error.errors,
    });
  }

  return reply.status(500).send({
    status: 1,
    error: error.message || 'Internal Server Error',
  });
}

/**
 * Global error handler for Fastify
 */
export function globalErrorHandler(error: FastifyError, _req: FastifyRequest, reply: FastifyReply) {
  const statusCode = error.statusCode || 500;
  reply.status(statusCode).send({
    status: 1,
    error: error.name,
    message: error.message,
  });
}
