import { Request, Response } from "express";
import { ZodError } from "zod";
import Product from "../models/productSchema";
import {
  createProductSchema,
  CreateProductType,
  IProduct,
} from "../types/product.types";
import { ApiResponse } from "../types/api.types";
import { DetailedRateLimitInfo, ClearLimitInfo } from "../types/admin.types";
import redisClient from "../utils/redisUtils";

const formatZodError = (error: ZodError) => {
  return error.errors.reduce((acc, curr) => {
    const path = curr.path.join(".");
    if (!acc[path]) {
      acc[path] = [];
    }
    acc[path].push(curr.message);
    return acc;
  }, {} as Record<string, string[]>);
};

export const addMockData = async (
  req: Request<{}, ApiResponse<IProduct>, CreateProductType>,
  res: Response<ApiResponse<IProduct>>
): Promise<void> => {
  try {
    const validationResult = createProductSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const productData = validationResult.data;

    const product = new Product({
      ...productData,

      ratings: {
        average: 0,
        count: 0,
      },
    });

    await product.save();

    res.status(201).json({
      success: true,
      data: product,
      message: "Product created successfully",
    });
  } catch (error) {
    console.error("Error in addMockData:", error);

    if (error instanceof Error) {
      if (error.name === "ValidationError") {
        res.status(400).json({
          success: false,
          message: "Validation Error",
          errors: { general: [error.message] },
        });
        return;
      }

      if (error.name === "MongoError" || error.name === "MongoServerError") {
        res.status(500).json({
          success: false,
          message: "Database Error",
          errors: { general: ["Error saving to database"] },
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      errors: { general: ["An unexpected error occurred"] },
    });
  }
};

export const clearRateLimits = async (
  req: Request,
  res: Response<ApiResponse<ClearLimitInfo>>
): Promise<void> => {
  try {
    const result = await redisClient.clearRateLimits();
    if (result.success) {
      res.json({
        success: true,
        data: {
          cleared: result.cleared,
        },
        message: `Successfully cleared ${result.cleared} rate limit entries`,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to clear rate limits",
      });
    }
  } catch (error) {
    console.error("Error clearing rate limits:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear rate limits",
    });
  }
};

export const checkRateLimits = async (
  req: Request,
  res: Response<ApiResponse<DetailedRateLimitInfo>>
): Promise<void> => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";

  if (ip === "unknown") {
    res.status(400).json({
      success: false,
      message: "Could not determine IP address",
    });
    return;
  }

  try {
    const [apiRemaining, authRemaining, searchRemaining, orderRemaining] =
      await Promise.all([
        redisClient.getRemainingRequests(ip, "rl:api:"),
        redisClient.getRemainingRequests(ip, "rl:auth:"),
        redisClient.getRemainingRequests(ip, "rl:search:"),
        redisClient.getRemainingRequests(ip, "rl:order:"),
      ]);

    res.json({
      success: true,
      data: {
        ip,
        limits: {
          api: {
            remaining: apiRemaining,
            total: 100,
            resetIn: "15 minutes",
          },
          auth: {
            remaining: authRemaining,
            total: 5,
            resetIn: "15 minutes",
          },
          search: {
            remaining: searchRemaining,
            total: 30,
            resetIn: "1 minute",
          },
          order: {
            remaining: orderRemaining,
            total: 10,
            resetIn: "1 hour",
          },
        },
      },
      message: "Rate limit info retrieved successfully",
    });
  } catch (error) {
    console.error("Error checking rate limits:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check rate limits",
    });
  }
};
