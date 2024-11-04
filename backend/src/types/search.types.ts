import { z } from "zod";
import { IProduct } from "./product.types";
import { Document } from "mongoose";

export const searchQuerySchema = z.object({
  q: z.string().min(1, "Search query is required"),
  category: z.string().optional(),
  minPrice: z.string().regex(/^\d+$/, "Must be a number").optional(),
  maxPrice: z.string().regex(/^\d+$/, "Must be a number").optional(),
  brand: z.string().optional(),
  limit: z.string().regex(/^\d+$/, "Must be a number").optional().default("10"),
  page: z.string().regex(/^\d+$/, "Must be a number").optional().default("1"),
  suggest: z.string().optional(),
});

// Create a type for plain product object without mongoose methods
export type PlainProduct = Omit<IProduct, keyof Document>;

export interface SearchResponse {
  products: PlainProduct[];
  totalResults: number;
  suggestions?: string[];
  facets: {
    categories: Array<{ _id: string; count: number }>;
    brands: Array<{ _id: string; count: number }>;
    priceRanges: Array<{
      _id: string;
      count: number;
      minPrice: number;
      maxPrice: number;
    }>;
  };
}

export type SearchQueryType = z.infer<typeof searchQuerySchema>;
