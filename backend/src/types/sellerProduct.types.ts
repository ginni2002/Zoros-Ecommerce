import { z } from "zod";
import { Document, Types } from "mongoose";
import {
  ProductCategory,
  specificationsSchema,
  ratingsSchema,
} from "./product.types";

export interface ISellerProduct extends Document {
  seller: Types.ObjectId;
  name: string;
  description: string;
  price: number;
  category: keyof typeof ProductCategory;
  brand: string;
  imageUrl: string;
  stock: number;
  isActive: boolean;
  specifications: Record<string, string | number>;
  ratings: {
    average: number;
    count: number;
  };
  createdAt: Date;
  updatedAt: Date;
  updateStock(quantity: number): Promise<void>;
}

export const sellerProductSchema = z.object({
  name: z.string().min(3, "Name is required"),
  description: z.string().min(1, "Description is required"),
  price: z.number().positive("Price must be positive"),
  category: z.enum(Object.values(ProductCategory) as [string, ...string[]], {
    required_error: "Category is required",
    invalid_type_error: "Invalid category",
  }),
  brand: z.string().min(1, "Brand is required"),
  imageUrl: z.string().url("Invalid image URL"),
  stock: z.number().int().min(0, "Stock cannot be negative").default(0),
  specifications: specificationsSchema.default({}),
  isActive: z.boolean().default(true),
});

export const sellerProductQuerySchema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("10"),
  sort: z
    .enum(["price", "-price", "name", "-name", "createdAt", "-createdAt"])
    .optional(),
  category: z
    .enum(Object.values(ProductCategory) as [string, ...string[]])
    .optional(),
  brand: z.string().optional(),
  minPrice: z.string().regex(/^\d+$/, "Must be a number").optional(),
  maxPrice: z.string().regex(/^\d+$/, "Must be a number").optional(),
  search: z.string().optional(),
  isActive: z
    .string()
    .regex(/^(true|false)$/, "Must be true or false")
    .optional(),
});

export const sellerProductIdSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid product ID"),
});

export type CreateSellerProductType = z.infer<typeof sellerProductSchema>;
export type UpdateSellerProductType = Partial<CreateSellerProductType>;
export type SellerProductQueryType = z.infer<typeof sellerProductQuerySchema>;
export type SellerProductIdParamType = z.infer<typeof sellerProductIdSchema>;

export interface SellerProductResponse {
  _id: string;
  seller: string;
  name: string;
  description: string;
  price: number;
  category: string;
  brand: string;
  imageUrl: string;
  stock: number;
  isActive: boolean;
  specifications: Record<string, string | number>;
  ratings: {
    average: number;
    count: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SellerProductPaginationResult {
  docs: SellerProductResponse[];
  totalDocs: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
