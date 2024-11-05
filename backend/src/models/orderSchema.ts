import { Schema, model } from "mongoose";
import { IOrder, OrderStatus } from "../types/order.types";

const orderItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId as any,
    ref: "Product",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, "Quantity cannot be less than 1"],
  },
  price: {
    type: Number,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
});

const shippingAddressSchema = new Schema({
  street: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  pincode: {
    type: String,
    required: true,
    match: [/^[0-9]{6}$/, "Invalid pincode"],
  },
});

const orderSchema = new Schema<IOrder>(
  {
    user: {
      type: Schema.Types.ObjectId as any,
      ref: "User",
      required: true,
    },
    items: [orderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
    },
    shippingAddress: shippingAddressSchema,
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING_PAYMENT,
    },
    paymentIntentId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Order = model<IOrder>("Order", orderSchema);

export default Order;
