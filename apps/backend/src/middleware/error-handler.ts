import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * Global error handler for Fastify
 */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log the error
  request.log.error({
    err: error,
    req: {
      method: request.method,
      url: request.url,
      headers: request.headers,
      query: request.query,
      body: request.body
    }
  });

  // Determine status code
  const statusCode = error.statusCode || (error as AppError).statusCode || 500;

  // Build error response
  const errorResponse: any = {
    error: error.name || 'Error',
    message: error.message || 'An unexpected error occurred',
    statusCode
  };

  // Add error code if available
  if (error.code) {
    errorResponse.code = error.code;
  }

  // Add validation errors if present
  if (error.validation) {
    errorResponse.validation = error.validation;
  }

  // Add details in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.details = (error as AppError).details;
  }

  // Handle specific error types
  if (error.name === 'PrismaClientKnownRequestError') {
    errorResponse.error = 'Database Error';
    errorResponse.message = 'A database error occurred';
    errorResponse.statusCode = 500;
  }

  if (error.name === 'UnauthorizedError') {
    errorResponse.error = 'Unauthorized';
    errorResponse.message = 'Authentication required';
    errorResponse.statusCode = 401;
  }

  if (error.name === 'ForbiddenError') {
    errorResponse.error = 'Forbidden';
    errorResponse.message = 'You do not have permission to access this resource';
    errorResponse.statusCode = 403;
  }

  // Send response
  reply.status(errorResponse.statusCode).send(errorResponse);
}

/**
 * Not found handler
 */
export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  reply.status(404).send({
    error: 'Not Found',
    message: `Route ${request.method} ${request.url} not found`,
    statusCode: 404
  });
}

/**
 * Custom error classes
 */
export class ValidationError extends Error implements AppError {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  details: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class UnauthorizedError extends Error implements AppError {
  statusCode = 401;
  code = 'UNAUTHORIZED';

  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error implements AppError {
  statusCode = 403;
  code = 'FORBIDDEN';

  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error implements AppError {
  statusCode = 404;
  code = 'NOT_FOUND';

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error implements AppError {
  statusCode = 409;
  code = 'CONFLICT';

  constructor(message: string = 'Resource already exists') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error implements AppError {
  statusCode = 429;
  code = 'RATE_LIMIT_EXCEEDED';

  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}
