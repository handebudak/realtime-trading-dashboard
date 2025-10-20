import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/database';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export const rateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const redisClient = getRedisClient();
    
    // Default rate limit options
    const options: RateLimitOptions = {
      windowMs: config.RATE_LIMIT.WINDOW_MS,
      maxRequests: config.RATE_LIMIT.MAX_REQUESTS,
      keyGenerator: (req: Request) => {
        // Use IP address as default key, but can be customized
        return `rate_limit:${req.ip}:${req.path}`;
      },
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    };

    const key = options.keyGenerator!(req);
    const window = Math.floor(Date.now() / options.windowMs);
    const redisKey = `${key}:${window}`;

    // Get current request count
    const currentCount = await redisClient.get(redisKey);
    const count = currentCount ? parseInt(currentCount, 10) : 0;

    if (count >= options.maxRequests) {
      logger.warn('Rate limit exceeded:', {
        ip: req.ip,
        path: req.path,
        count,
        maxRequests: options.maxRequests,
      });

      res.status(429).json({
        success: false,
        error: {
          message: 'Too many requests, please try again later',
          retryAfter: Math.ceil(options.windowMs / 1000),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Increment counter
    await redisClient.incr(redisKey);
    await redisClient.expire(redisKey, Math.ceil(options.windowMs / 1000));

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': options.maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, options.maxRequests - count - 1).toString(),
      'X-RateLimit-Reset': new Date(Date.now() + options.windowMs).toISOString(),
    });

    next();
  } catch (error) {
    logger.error('Rate limiter error:', error);
    // If Redis is down, allow the request to proceed
    next();
  }
};

// Specialized rate limiters for different endpoints
export const authRateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const redisClient = getRedisClient();
    const key = `auth_rate_limit:${req.ip}`;
    const window = Math.floor(Date.now() / (15 * 60 * 1000)); // 15 minutes
    const redisKey = `${key}:${window}`;

    const currentCount = await redisClient.get(redisKey);
    const count = currentCount ? parseInt(currentCount, 10) : 0;

    if (count >= 50) { // Max 50 auth attempts per 15 minutes
      logger.warn('Auth rate limit exceeded:', {
        ip: req.ip,
        count,
      });

      res.status(429).json({
        success: false,
        error: {
          message: 'Too many authentication attempts, please try again later',
          retryAfter: 900, // 15 minutes
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await redisClient.incr(redisKey);
    await redisClient.expire(redisKey, 900);

    next();
  } catch (error) {
    logger.error('Auth rate limiter error:', error);
    next();
  }
};

export const tradingRateLimiter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const redisClient = getRedisClient();
    const key = `trading_rate_limit:${req.ip}`;
    const window = Math.floor(Date.now() / (60 * 1000)); // 1 minute
    const redisKey = `${key}:${window}`;

    const currentCount = await redisClient.get(redisKey);
    const count = currentCount ? parseInt(currentCount, 10) : 0;

    if (count >= 100) { // Max 100 trading requests per minute
      logger.warn('Trading rate limit exceeded:', {
        ip: req.ip,
        count,
      });

      res.status(429).json({
        success: false,
        error: {
          message: 'Trading rate limit exceeded, please slow down',
          retryAfter: 60,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await redisClient.incr(redisKey);
    await redisClient.expire(redisKey, 60);

    next();
  } catch (error) {
    logger.error('Trading rate limiter error:', error);
    next();
  }
};

