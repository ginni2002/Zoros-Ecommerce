import { z } from "zod";
import { ProductCategory } from "./product.types";

export const sortOptions = ["price", "-price", "name", "-name"] as const;

export const productQuerySchema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("10"),
  sort: z.enum(sortOptions).optional(),
  category: z
    .enum(Object.values(ProductCategory) as [string, ...string[]])
    .optional(),
  brand: z.string().optional(),
  minPrice: z.string().regex(/^\d+$/, "Must be a number").optional(),
  maxPrice: z.string().regex(/^\d+$/, "Must be a number").optional(),
  search: z.string().optional(),
});

export type ProductQueryType = z.infer<typeof productQuerySchema>;

export interface PaginationResult<T> {
  docs: T[];
  totalDocs: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
