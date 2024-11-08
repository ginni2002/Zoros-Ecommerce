import { Request, Response } from "express";
import { ApiResponse } from "../types/api.types";
import { IProduct, ProductCategory } from "../types/product.types";
import {
  ProductQueryType,
  productQuerySchema,
  PaginationResult,
} from "../types/product-query.types";
import Product from "../models/productSchema";
import { formatZodError } from "../utils/errorUtils";
import {
  ProductDetailResponse,
  ProductIdParamType,
  productIdSchema,
} from "../types/product-detail.types";
import mongoose from "mongoose";
import redisClient from "../utils/redisUtils";

export const getProducts = async (
  req: Request<
    {},
    ApiResponse<PaginationResult<IProduct>>,
    {},
    ProductQueryType
  >,
  res: Response<ApiResponse<PaginationResult<IProduct>>>
): Promise<void> => {
  try {
    const validationResult = productQuerySchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const {
      page = "1",
      limit = "10",
      sort,
      category,
      brand,
      minPrice,
      maxPrice,
      search,
    } = validationResult.data;

    // Build query
    const query: any = {};

    // Category filter
    if (category) {
      query.category = category;
    }

    // Brand filter
    if (brand) {
      query.brand = brand;
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseInt(minPrice);
      if (maxPrice) query.price.$lte = parseInt(maxPrice);
    }

    // Search in name and description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    let sortObj = {};
    if (sort) {
      const [field, order] = sort.startsWith("-")
        ? [sort.slice(1), -1]
        : [sort, 1];
      sortObj = { [field]: order };
    }

    // Execute query with pagination
    const totalDocs = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalDocs / limitNum);

    const products = await Product.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      data: {
        docs: products,
        totalDocs,
        totalPages,
        currentPage: pageNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
      message: "Products retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getProducts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve products",
    });
  }
};

export const getProductById = async (
  req: Request<ProductIdParamType, ApiResponse<ProductDetailResponse>>,
  res: Response<ApiResponse<ProductDetailResponse>>
): Promise<void> => {
  try {
    const validationResult = productIdSchema.safeParse({ id: req.params.id });

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const productId = validationResult.data.id;

    const cachedProduct = await redisClient.getCachedProduct(productId);

    let product;
    if (cachedProduct) {
      product = cachedProduct;
    } else {
      product = await Product.findById(productId);
      if (!product) {
        res.status(404).json({
          success: false,
          message: "Product not found",
        });
        return;
      }
      await redisClient.cacheProduct(product);
    }

    const [previousProduct, nextProduct] = await Promise.all([
      Product.findOne({
        category: product.category,
        _id: { $lt: product._id },
      })
        .sort({ _id: -1 })
        .limit(1),
      Product.findOne({
        category: product.category,
        _id: { $gt: product._id },
      })
        .sort({ _id: 1 })
        .limit(1),
    ]);

    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },

      price: {
        $gte: product.price * 0.7, // 30% cheaper
        $lte: product.price * 1.3, // 30% more expensive
      },
    }).limit(4);

    res.status(200).json({
      success: true,
      data: {
        product,
        relatedProducts,
        nextProduct: nextProduct || undefined,
        previousProduct: previousProduct || undefined,
      },
      message: "Product retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getProductById:", error);

    if (error instanceof mongoose.Error.CastError) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve product",
    });
  }
};

export const getProductsByCategory = async (
  req: Request<{ category: string }, ApiResponse<PaginationResult<IProduct>>>,
  res: Response<ApiResponse<PaginationResult<IProduct>>>
): Promise<void> => {
  try {
    const { category } = req.params;
    const { page = "1", limit = "10", sort } = req.query;

    if (!Object.values(ProductCategory).includes(category as any)) {
      res.status(400).json({
        success: false,
        message: "Invalid category",
      });
      return;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const sortObj: Record<string, 1 | -1> = {};
    if (typeof sort === "string") {
      const sortField = sort.startsWith("-") ? sort.slice(1) : sort;
      const sortOrder = sort.startsWith("-") ? -1 : 1;
      sortObj[sortField] = sortOrder;
    }

    const totalDocs = await Product.countDocuments({ category });
    const totalPages = Math.ceil(totalDocs / limitNum);

    const products = await Product.find({ category })
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum);

    res.status(200).json({
      success: true,
      data: {
        docs: products,
        totalDocs,
        totalPages,
        currentPage: pageNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
      message: `Products in category ${category} retrieved successfully`,
    });
  } catch (error) {
    console.error("Error in getProductsByCategory:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve products by category",
    });
  }
};

export const updateProduct = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found",
      });
      return;
    }

    await redisClient.invalidateProduct(id);

    await redisClient.invalidateSearchCache();

    res.status(200).json({
      success: true,
      data: product,
      message: "Product updated successfully",
    });
  } catch (error) {
    console.error("Error in updateProduct:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update product",
    });
  }
};
