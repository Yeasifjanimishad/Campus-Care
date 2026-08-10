import { Request, Response, NextFunction } from 'express';

export interface StructuredLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  type: 'http_request' | 'http_error' | 'system' | 'security';
  message?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  userAgent?: string;
  userId?: string;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Utility for emitting structured JSON log messages across the backend
 */
export const structuredLogger = {
  info: (message: string, metadata?: Record<string, any>) => {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      type: 'system',
      message,
      metadata,
    };
    console.log(JSON.stringify(entry));
  },
  warn: (message: string, metadata?: Record<string, any>) => {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      type: 'system',
      message,
      metadata,
    };
    console.warn(JSON.stringify(entry));
  },
  error: (message: string, error?: Error | any, metadata?: Record<string, any>) => {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      type: 'system',
      message,
      error: error
        ? {
            message: error.message || String(error),
            code: error.code,
            stack: error.stack,
          }
        : undefined,
      metadata,
    };
    console.error(JSON.stringify(entry));
  },
};

/**
 * Express middleware to log all incoming HTTP requests in structured JSON format
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    const logEntry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      type: 'http_request',
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode,
      durationMs,
      ip: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      userId: (req as any).user?.id,
    };

    if (level === 'error') {
      console.error(JSON.stringify(logEntry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  });

  next();
};

/**
 * Express error logging middleware with full stack traces in structured JSON
 */
export const errorLogger = (err: any, req: Request, _res: Response, next: NextFunction) => {
  const logEntry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    type: 'http_error',
    message: err.message || 'Unhandled error during request execution',
    method: req.method,
    path: req.originalUrl || req.url,
    statusCode: err.statusCode || 500,
    ip: req.ip || req.socket.remoteAddress,
    userId: (req as any).user?.id,
    error: {
      message: err.message || String(err),
      code: err.code,
      stack: err.stack,
    },
  };

  console.error(JSON.stringify(logEntry));
  next(err);
};
