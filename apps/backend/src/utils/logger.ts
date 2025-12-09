import pino from 'pino';

/**
 * Create a structured logger
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
            colorize: true
          }
        }
      : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    }
  }
});

/**
 * Create a child logger with context
 */
export function createLogger(context: Record<string, any>) {
  return logger.child(context);
}
