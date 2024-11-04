import { z } from "zod";
import { Document } from "mongoose";

export const ProductCategory = {
  GAMING_LAPTOP: "GAMING_LAPTOP",
  MOUSE: "MOUSE",
  KEYBOARD: "KEYBOARD",
  MONITOR: "MONITOR",
  HEADSET: "HEADSET",
} as const;

export const specificationsSchema = z.record(z.union([z.string(), z.number()]));

export const ratingsSchema = z.object({
  average: z.number().min(0).max(5).default(0),
  count: z.number().min(0).default(0),
});

export const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
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
  ratings: ratingsSchema.default({
    average: 0,
    count: 0,
  }),
});

export const createProductSchema = productSchema.omit({
  ratings: true,
});

export type ProductType = z.infer<typeof productSchema>;
export type CreateProductType = z.infer<typeof createProductSchema>;

export interface IProduct extends ProductType, Document {
  createdAt: Date;
  updatedAt: Date;
}
