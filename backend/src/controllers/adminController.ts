import { Request, Response } from "express";
import { ZodError } from "zod";
import Product from "../models/productSchema";
import {
  createProductSchema,
  CreateProductType,
  IProduct,
} from "../types/product.types";
import { ApiResponse } from "../types/api.types";

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
