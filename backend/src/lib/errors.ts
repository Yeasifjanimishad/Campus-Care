import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err instanceof AppError && err.statusCode ? err.statusCode : 500;

  // Output structured JSON error log
  const errorLog = {
    timestamp: new Date().toISOString(),
    level: statusCode >= 500 ? 'error' : 'warn',
    type: 'http_error',
    method: req.method,
    path: req.originalUrl || req.url,
    statusCode,
    ip: req.ip || req.socket.remoteAddress,
    userId: (req as any).user?.id,
    error: {
      name: err.name,
      message: err.message,
      code: (err as AppError).code,
      stack: err.stack,
      details: (err as AppError).details,
    },
  };

  if (statusCode >= 500) {
    console.error(JSON.stringify(errorLog));
  } else {
    console.warn(JSON.stringify(errorLog));
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code || 'APPLICATION_ERROR',
        details: err.details,
      },
    });
    return;
  }

  res.status(500).json({
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    },
  });
};
