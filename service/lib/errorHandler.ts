import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { mapGmoError } from './errors.js';

export interface ErrorResponse {
  status: 'error';
  code: string;
  message: string;
  timestamp: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): ErrorResponse {
  return {
    status: 'error',
    code,
    message,
    timestamp: new Date().toISOString(),
    requestId,
    ...(details && { details }),
  };
}

export async function globalErrorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const requestId = request.id;

  // Handle Fastify errors
  if ('statusCode' in error) {
    const statusCode = (error as FastifyError).statusCode || 500;
    const code = statusCode === 401 ? 'unauthorized' : statusCode === 403 ? 'forbidden' : statusCode === 404 ? 'not_found' : 'validation_error';
    request.server.log.warn({ requestId, statusCode, message: error.message }, 'HTTP error');
    return reply.status(statusCode).send(
      createErrorResponse(code, error.message, { validation: (error as any)?.validation }, requestId)
    );
  }

  // Handle SDK/API errors
  const gmoMessage = mapGmoError(error);
  const statusCode = gmoMessage.includes('Rate limit') ? 429 : gmoMessage.includes('unauthorized') ? 401 : gmoMessage.includes('Timestamp') ? 400 : 500;

  request.server.log.error({ requestId, error: error.message, gmoMessage }, 'Request failed');

  return reply.status(statusCode).send(
    createErrorResponse(
      statusCode === 429 ? 'rate_limit_exceeded' : statusCode === 401 ? 'unauthorized' : 'internal_error',
      gmoMessage || 'Internal server error',
      { originalError: error instanceof Error ? error.message : String(error) },
      requestId
    )
  );
}

/**
 * Wraps route handlers with error handling
 */
export function withErrorHandler(
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await handler(request, reply);
    } catch (error) {
      await globalErrorHandler(error as Error | FastifyError, request, reply);
    }
  };
}
