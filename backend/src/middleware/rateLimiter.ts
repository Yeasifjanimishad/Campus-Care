import { rateLimit, ipKeyGenerator, type Options } from 'express-rate-limit';
import { Request, Response } from 'express';

// 1. Default API Rate Limiter: 100 requests per 15 minutes per IP
export const defaultRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        message: 'Too many requests from this IP, please try again after 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    });
  }
}) as any;

// 2. Auth Endpoints Rate Limiter: 10 login / signup attempts per 15 minutes per IP
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        message: 'Too many authentication attempts from this IP, please try again in 15 minutes.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED'
      }
    });
  }
}) as any;

// 3. Public Endpoints (e.g. Doctor Request Access): 5 requests per hour per IP
export const publicEndpointLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        message: 'Rate limit exceeded for public requests. Maximum 5 requests allowed per hour.',
        code: 'PUBLIC_RATE_LIMIT_EXCEEDED'
      }
    });
  }
}) as any;

// 4. SOS Endpoint Rate Limiter: 3 requests per minute per user (to prevent spam)
export const sosRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 3,
  keyGenerator: (req: Request) => {
    // If authenticated, rate limit per user id, otherwise use the proper ipKeyGenerator helper
    return (req as any).user?.id || ipKeyGenerator(req.ip || 'unknown');
  },
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: {
        message: 'Too many SOS emergency requests submitted in a short time. Maximum 3 requests allowed per minute.',
        code: 'SOS_RATE_LIMIT_EXCEEDED'
      }
    });
  }
}) as any;
