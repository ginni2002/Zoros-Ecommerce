import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redis, redisClient } from "../utils/redisUtils";
import { Request, Response } from "express";

let redisStore: RedisStore | null = null;

const createRedisStore = (prefix: string, max: number): RedisStore => {
  return new RedisStore({
    sendCommand: async (command: string, ...args: string[]): Promise<any> => {
      try {
        await redisClient.ensureConnection();

        if (!redisClient.isConnected()) {
          console.warn(
            "Redis not connected, falling back to memory rate limiting"
          );
          return max;
        }

        const result = await redis.call(command, ...args);
        return result;
      } catch (error) {
        console.error("Redis rate limit error:", error);
        return max;
      }
    },

    prefix: `rl:${prefix}:`,
  });
};

export const createRateLimiter = (
  windowMs: number,
  max: number,
  message: string,
  prefix: string
) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(prefix, max),
    skip: (req) => {
      if (!redisClient.isConnected()) {
        console.warn("Redis not connected, using memory rate limiting");
        return false;
      }
      return false;
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        message: message,
      });
    },
  });
};

//types
interface RateLimiterConfig {
  windowMs: number;
  max: number;
  message: string;
  prefix: string;
}

const rateLimiterConfigs: Record<string, RateLimiterConfig> = {
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per windowMs
    message:
      "Too many requests from this IP, please try again after 15 minutes",
    prefix: "api",
  },
  auth: {
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many login attempts, please try again after 15 minutes",
    prefix: "auth",
  },
  search: {
    windowMs: 60 * 1000,
    max: 30,
    message: "Too many search requests, please try again after a minute",
    prefix: "search",
  },
  order: {
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "Order creation limit reached, please try again later",
    prefix: "order",
  },
};

export const apiLimiter = createRateLimiter(
  rateLimiterConfigs.api.windowMs,
  rateLimiterConfigs.api.max,
  rateLimiterConfigs.api.message,
  rateLimiterConfigs.api.prefix
);

export const authLimiter = createRateLimiter(
  rateLimiterConfigs.auth.windowMs,
  rateLimiterConfigs.auth.max,
  rateLimiterConfigs.auth.message,
  rateLimiterConfigs.auth.prefix
);

export const searchLimiter = createRateLimiter(
  rateLimiterConfigs.search.windowMs,
  rateLimiterConfigs.search.max,
  rateLimiterConfigs.search.message,
  rateLimiterConfigs.search.prefix
);

export const orderLimiter = createRateLimiter(
  rateLimiterConfigs.order.windowMs,
  rateLimiterConfigs.order.max,
  rateLimiterConfigs.order.message,
  rateLimiterConfigs.order.prefix
);
