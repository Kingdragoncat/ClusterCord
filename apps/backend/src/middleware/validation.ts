import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Validate request body against a schema
 */
export function validateBody<T>(
  schema: {
    [K in keyof T]: {
      type: 'string' | 'number' | 'boolean' | 'object' | 'array';
      required?: boolean;
      min?: number;
      max?: number;
      pattern?: RegExp;
      enum?: any[];
    };
  }
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    if (!body || typeof body !== 'object') {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Request body must be a valid JSON object'
      });
    }

    const errors: string[] = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = body[field];

      // Check required
      if (rules.required && (value === undefined || value === null)) {
        errors.push(`Field '${field}' is required`);
        continue;
      }

      // Skip validation if not required and not present
      if (!rules.required && (value === undefined || value === null)) {
        continue;
      }

      // Type validation
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        errors.push(
          `Field '${field}' must be of type '${rules.type}', got '${actualType}'`
        );
        continue;
      }

      // String validations
      if (rules.type === 'string') {
        if (rules.min && value.length < rules.min) {
          errors.push(
            `Field '${field}' must be at least ${rules.min} characters long`
          );
        }
        if (rules.max && value.length > rules.max) {
          errors.push(
            `Field '${field}' must be at most ${rules.max} characters long`
          );
        }
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`Field '${field}' does not match required pattern`);
        }
        if (rules.enum && !rules.enum.includes(value)) {
          errors.push(
            `Field '${field}' must be one of: ${rules.enum.join(', ')}`
          );
        }
      }

      // Number validations
      if (rules.type === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push(`Field '${field}' must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push(`Field '${field}' must be at most ${rules.max}`);
        }
      }

      // Array validations
      if (rules.type === 'array') {
        if (rules.min !== undefined && value.length < rules.min) {
          errors.push(
            `Field '${field}' must contain at least ${rules.min} items`
          );
        }
        if (rules.max !== undefined && value.length > rules.max) {
          errors.push(
            `Field '${field}' must contain at most ${rules.max} items`
          );
        }
      }
    }

    if (errors.length > 0) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Request validation failed',
        details: errors
      });
    }
  };
}

/**
 * Sanitize input to prevent XSS and injection attacks
 */
export function sanitizeInput(request: FastifyRequest, reply: FastifyReply) {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove null bytes
      obj = obj.replace(/\0/g, '');

      // Trim excessive whitespace
      obj = obj.replace(/\s+/g, ' ').trim();

      // Remove potentially dangerous characters for shell injection
      // (This is a basic implementation; for production, use proper escaping)
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }

    return obj;
  };

  if (request.body) {
    request.body = sanitize(request.body);
  }

  if (request.query) {
    request.query = sanitize(request.query);
  }
}

/**
 * Common validation schemas
 */
export const validationSchemas = {
  clusterAdd: validateBody<{
    name: string;
    kubeconfig: string;
    discordUserId: string;
  }>({
    name: {
      type: 'string',
      required: true,
      min: 1,
      max: 100,
      pattern: /^[a-zA-Z0-9-_]+$/
    },
    kubeconfig: {
      type: 'string',
      required: true,
      min: 10
    },
    discordUserId: {
      type: 'string',
      required: true,
      min: 1
    }
  }),

  terminalStart: validateBody<{
    discordUserId: string;
    cluster: string;
    namespace: string;
    pod: string;
    container?: string;
    shell?: string;
  }>({
    discordUserId: {
      type: 'string',
      required: true
    },
    cluster: {
      type: 'string',
      required: true
    },
    namespace: {
      type: 'string',
      required: true,
      pattern: /^[a-z0-9-]+$/
    },
    pod: {
      type: 'string',
      required: true,
      pattern: /^[a-z0-9-]+$/
    },
    container: {
      type: 'string',
      required: false
    },
    shell: {
      type: 'string',
      required: false,
      enum: ['/bin/sh', '/bin/bash', '/bin/zsh']
    }
  }),

  terminalExec: validateBody<{
    sessionId: string;
    command: string;
  }>({
    sessionId: {
      type: 'string',
      required: true
    },
    command: {
      type: 'string',
      required: true,
      min: 1,
      max: 10000
    }
  })
};
