import { Redis } from "ioredis";
import dotenv from "dotenv";
import { IProduct } from "../types/product.types";

dotenv.config();
if (
  !process.env.REDIS_HOST ||
  !process.env.REDIS_PORT ||
  !process.env.REDIS_PASSWORD
) {
  throw new Error("REDIS envs are not defined in environment variables");
}

const redisConfig = {
  password: process.env.REDIS_PASSWORD,
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

const redis = new Redis({
  password: redisConfig.password,
  host: redisConfig.host,
  port: redisConfig.port,
});

const CACHE_TTL = {
  PRODUCT: 30 * 60,
  SEARCH: 5 * 60,
  WEBHOOK: 24 * 60 * 60,
  CART: 2 * 24 * 60 * 60,
};

export const redisClient = {
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
};

redis.on("connect", () => {
  console.log("Redis connected successfully");
});

redis.on("error", (error) => {
  console.error("Redis connection error:", error);
});

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
