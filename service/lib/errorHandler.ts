import { FastifyReply, FastifyError, FastifyRequest } from 'fastify';
import { Result } from '../../src/types.js';
import { z } from 'zod';

/**
 * Creates a standardized error response object
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown,
  requestId?: string,
) {
  const response: Record<string, unknown> = {
    status: 'error',
    code,
    message,
    timestamp: new Date().toISOString(),
  };
  if (requestId) response.requestId = requestId;
  if (details) response.details = details;
  return response;
}

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
export function globalErrorHandler(error: FastifyError, req: FastifyRequest, reply: FastifyReply) {
  const message = error.message || '';
  const requestId = (req as any).id;

  // Rate limit errors
  if (message.includes('ERR-5003') || message.includes('Rate limit exceeded')) {
    return reply.status(429).send({
      status: 'error',
      code: 'rate_limit_exceeded',
      message: 'Rate limit exceeded',
      requestId,
      timestamp: new Date().toISOString(),
    });
  }

  // Timestamp skew errors
  if (message.includes('ERR-5008') || message.includes('ERR-5009') || message.includes('Timestamp')) {
    return reply.status(400).send({
      status: 'error',
      code: 'timestamp_skew',
      message: 'Timestamp skew detected',
      requestId,
      timestamp: new Date().toISOString(),
    });
  }

  const statusCode = error.statusCode || 500;
  const response: Record<string, unknown> = {
    status: 'error',
    error: error.name,
    message: error.message,
    timestamp: new Date().toISOString(),
  };
  if (requestId) response.requestId = requestId;
  reply.status(statusCode).send(response);
}
