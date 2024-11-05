import { z } from "zod";
import { Types, Document } from "mongoose";

export const OrderStatus = {
  PENDING_PAYMENT: "PENDING_PAYMENT",
  PROCESSING: "PROCESSING",
  CONFIRMED: "CONFIRMED",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
} as const;

export interface OrderItem {
  product: Types.ObjectId | string;
  name: string;
  quantity: number;
  price: number;
  imageUrl: string;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
}

export interface IOrder extends Document {
  user: Types.ObjectId | string;
  items: OrderItem[];
  totalAmount: number;
  shippingAddress: ShippingAddress;
  paymentStatus: "pending" | "paid" | "failed";
  orderStatus: (typeof OrderStatus)[keyof typeof OrderStatus];
  paymentIntentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const shippingAddressSchema = z.object({
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().regex(/^[0-9]{6}$/, "Invalid pincode"),
});

export const createOrderSchema = z.object({
  shippingAddress: shippingAddressSchema,
});

export type CreateOrderType = z.infer<typeof createOrderSchema>;

export interface OrderResponse {
  _id: string;
  items: OrderItem[];
  totalAmount: number;
  shippingAddress: ShippingAddress;
  paymentStatus: string;
  orderStatus: string;
  createdAt: Date;
  clientSecret?: string; // stripe payment
}
