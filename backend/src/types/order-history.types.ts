import { z } from "zod";
import { OrderStatus } from "./order.types";

export const orderFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z
    .enum(Object.values(OrderStatus) as [string, ...string[]])
    .optional(),
  minAmount: z.string().regex(/^\d+$/, "Must be a number").optional(),
  maxAmount: z.string().regex(/^\d+$/, "Must be a number").optional(),
  page: z.string().regex(/^\d+$/, "Must be a number").default("1"),
  limit: z.string().regex(/^\d+$/, "Must be a number").default("10"),
  sortBy: z.enum(["createdAt", "totalAmount"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type OrderFilterType = z.infer<typeof orderFilterSchema>;

export interface OrderHistoryResponse {
  orders: Array<{
    _id: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
      imageUrl: string;
    }>;
    totalAmount: number;
    orderStatus: string;
    paymentStatus: string;
    shippingAddress: {
      street: string;
      city: string;
      state: string;
      pincode: string;
    };
    createdAt: Date;
  }>;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalOrders: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
