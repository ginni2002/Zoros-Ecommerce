import { z } from "zod";
import { IProduct } from "./product.types";

export interface ProductDetailResponse {
  product: IProduct;
  relatedProducts: IProduct[];
  nextProduct?: IProduct;
  previousProduct?: IProduct;
}

export const productIdSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid product ID"),
});

export type ProductIdParamType = z.infer<typeof productIdSchema>;
