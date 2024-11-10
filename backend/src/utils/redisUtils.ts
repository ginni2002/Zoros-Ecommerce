import { Redis } from "ioredis";
import dotenv from "dotenv";
import type { RedisOptions } from "ioredis";
import { IProduct } from "../types/product.types";

dotenv.config();
const requiredEnvVars = ["REDIS_HOST", "REDIS_PORT", "REDIS_PASSWORD"];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
);
if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required Redis environment variables: ${missingEnvVars.join(", ")}`
  );
}

const CACHE_TTL = {
  PRODUCT: 30 * 60,
  SEARCH: 5 * 60,
  WEBHOOK: 24 * 60 * 60,
  CART: 2 * 24 * 60 * 60,
  RATE_LIMIT: 24 * 60 * 60,
};

const redisConfig: RedisOptions = {
  password: process.env.REDIS_PASSWORD,
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || "6379"),
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const maxRetryAttempts = 3;
    if (times > maxRetryAttempts) {
      console.error(`Redis retry attempt ${times} failed, giving up`);
      return null;
    }
    const delay = Math.min(times * 50, 2000);
    console.log(`Retrying Redis connection in ${delay}ms...`);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    return err.message.includes("READONLY");
  },
};

export const redis = new Redis({
  ...redisConfig,
  lazyConnect: true,
});

let isRedisConnected = false;
let connectionPromise: Promise<void> | null = null;

redis.on("connect", () => {
  console.log("Redis connected successfully");
  isRedisConnected = true;
});

redis.on("error", (error) => {
  console.error("Redis connection error:", error);
  isRedisConnected = false;
});

redis.on("close", () => {
  console.log("Redis connection closed");
  isRedisConnected = false;
  connectionPromise = null;
});

export const redisClient = {
  isConnected(): boolean {
    return isRedisConnected && redis.status === "ready";
  },

  async ensureConnection(): Promise<boolean> {
    if (!isRedisConnected) {
      if (connectionPromise) {
        try {
          await connectionPromise;
          return true;
        } catch (error) {
          connectionPromise = null;
          return false;
        }
      }

      try {
        connectionPromise = redis.connect();
        await connectionPromise;
        return true;
      } catch (error) {
        console.error("Failed to establish Redis connection:", error);
        connectionPromise = null;
        return false;
      }
    }
    return true;
  },

  async cacheProduct(product: IProduct): Promise<void> {
    try {
      await redis.setex(
        `product:${product._id}`,
        CACHE_TTL.PRODUCT,
        JSON.stringify(product)
      );
      console.log(`Cached product: ${product._id}`);
    } catch (error) {
      console.error("Error caching product:", error);
    }
  },

  async getCachedProduct(productId: string): Promise<IProduct | null> {
    try {
      const cached = await redis.get(`product:${productId}`);
      if (!cached) return null;
      return JSON.parse(cached);
    } catch (error) {
      console.error("Error getting cached product:", error);
      return null;
    }
  },

  async cacheSearchResults(
    query: string,
    filters: any,
    results: any
  ): Promise<void> {
    try {
      const cacheKey = `search:${JSON.stringify({ query, ...filters })}`;
      await redis.setex(cacheKey, CACHE_TTL.SEARCH, JSON.stringify(results));
    } catch (error) {
      console.error("Error caching search results:", error);
    }
  },

  async getCachedSearchResults(
    query: string,
    filters: any
  ): Promise<any | null> {
    try {
      const cacheKey = `search:${JSON.stringify({ query, ...filters })}`;
      const cached = await redis.get(cacheKey);
      if (!cached) return null;
      return JSON.parse(cached);
    } catch (error) {
      console.error("Error getting cached search results:", error);
      return null;
    }
  },

  async markWebhookProcessed(webhookId: string): Promise<void> {
    try {
      await redis.setex(`webhook:${webhookId}`, CACHE_TTL.WEBHOOK, "processed");
    } catch (error) {
      console.error("Error marking webhook as processed:", error);
    }
  },

  async isWebhookProcessed(webhookId: string): Promise<boolean> {
    try {
      const result = await redis.get(`webhook:${webhookId}`);
      return result !== null;
    } catch (error) {
      console.error("Error checking webhook status:", error);
      return false;
    }
  },

  async invalidateProduct(productId: string): Promise<void> {
    try {
      await redis.del(`product:${productId}`);
    } catch (error) {
      console.error("Error invalidating product cache:", error);
    }
  },

  async invalidateSearchCache(): Promise<void> {
    try {
      const keys = await redis.keys("search:*");
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error("Error invalidating search cache:", error);
    }
  },

  async cacheCart(userId: string, cart: any): Promise<void> {
    try {
      await redis.setex(`cart:${userId}`, CACHE_TTL.CART, JSON.stringify(cart));
      console.log(`Cached cart for user: ${userId}`);
    } catch (error) {
      console.error("Error caching cart:", error);
    }
  },

  async getCachedCart(userId: string): Promise<any | null> {
    try {
      const cached = await redis.get(`cart:${userId}`);
      if (!cached) return null;
      return JSON.parse(cached);
    } catch (error) {
      console.error("Error getting cached cart:", error);
      return null;
    }
  },

  async invalidateCart(userId: string): Promise<void> {
    try {
      await redis.del(`cart:${userId}`);
      console.log(`Invalidated cart cache for user: ${userId}`);
    } catch (error) {
      console.error("Error invalidating cart cache:", error);
    }
  },

  async invalidateAllCarts(): Promise<void> {
    try {
      const keys = await redis.keys("cart:*");
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`Invalidated ${keys.length} cart caches`);
      }
    } catch (error) {
      console.error("Error invalidating all cart caches:", error);
    }
  },

  async updateCartCache(userId: string, cart: any): Promise<void> {
    try {
      const formattedCart = cart.toObject ? cart.toObject() : cart;
      await redis.setex(
        `cart:${userId}`,
        CACHE_TTL.CART,
        JSON.stringify(formattedCart)
      );

      if (cart.items?.length > 0) {
        await Promise.all(
          cart.items.map((item: any) =>
            this.invalidateProduct(item.product.toString())
          )
        );
      }
      console.log(`Updated cart cache for user: ${userId}`);
    } catch (error) {
      console.error("Error updating cart cache:", error);
    }
  },

  async clearRateLimits(prefix: string = "rl:"): Promise<{
    success: boolean;
    cleared: number;
  }> {
    try {
      const keys = await redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        return {
          success: true,
          cleared: keys.length,
        };
      }
      return {
        success: true,
        cleared: 0,
      };
    } catch (error) {
      console.error("Error clearing rate limits: ", error);
      return {
        success: false,
        cleared: 0,
      };
    }
  },

  async getRemainingRequests(
    ip: string,
    prefix: string = "rl:"
  ): Promise<number> {
    try {
      if (!ip || ip === "unknown") {
        return 0;
      }
      const key = `${prefix}${ip}`;
      const remaining = await redis.get(key);
      return remaining ? parseInt(remaining) : -1;
    } catch (error) {
      console.error("Error getting remaining requests:", error);
      return 0;
    }
  },
};

//testing
export const testRedisConnection = async (): Promise<void> => {
  try {
    await redis.set("test_key", "Hello Redis!");
    const value = await redis.get("test_key");
    console.log("Redis test value:", value);
    await redis.del("test_key");
    console.log("Redis is working properly!");
  } catch (error) {
    console.error("Redis test failed:", error);
  }
};

export default redisClient;
