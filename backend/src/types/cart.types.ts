import { z } from "zod";
import { Document, Types } from "mongoose";

export interface CartItem {
  product: Types.ObjectId | string;
  quantity: number;
  price: number;
}

export interface ICart extends Document {
  user: Types.ObjectId | string;
  items: CartItem[];
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const addToCartSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid product ID"),
  quantity: z.number().int().positive("Quantity must be positive"),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive("Quantity must be positive"),
});

export type AddToCartType = z.infer<typeof addToCartSchema>;
export type UpdateCartItemType = z.infer<typeof updateCartItemSchema>;

export interface CartItemResponse extends Omit<CartItem, "product"> {
  product: {
    _id: string;
    name: string;
    imageUrl: string;
    price: number;
    stock: number;
  };
}

export interface CartResponse {
  _id: string;
  items: CartItemResponse[];
  totalAmount: number;
  totalItems: number;
}
