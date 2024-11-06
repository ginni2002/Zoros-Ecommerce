import { Request, Response } from "express";
import { ApiResponse } from "../types/api.types";
import {
  OrderResponse,
  CreateOrderType,
  createOrderSchema,
  OrderStatus,
} from "../types/order.types";
import { IProduct } from "../types/product.types";
import Order from "../models/orderSchema";
import Cart from "../models/cartSchema";
import Product from "../models/productSchema";
import { createPaymentIntent } from "../utils/stripeUtils";
import emailService from "../utils/emailService";
import { formatZodError } from "../utils/errorUtils";
import { Types } from "mongoose";
import User from "../models/userSchema";

interface PopulatedCartItem {
  product: IProduct & { _id: Types.ObjectId };
  quantity: number;
  price: number;
}

interface PopulatedCart extends Omit<Document, "items"> {
  items: PopulatedCartItem[];
  totalAmount: number;
  user: Types.ObjectId | string;
}

export const createOrder = async (
  req: Request<{}, {}, CreateOrderType>,
  res: Response<ApiResponse<OrderResponse>>
): Promise<void> => {
  try {
    const validationResult = createOrderSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const { shippingAddress } = validationResult.data;

    const cart = await Cart.findOne({ user: req.user._id }).populate<{
      items: PopulatedCartItem[];
    }>("items.product");

    if (!cart || cart.items.length === 0) {
      res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
      return;
    }

    for (const item of cart.items) {
      const product = item.product;
      if (!product || product.stock < item.quantity) {
        res.status(400).json({
          success: false,
          message: `Insufficient stock for product: ${
            product?.name || "Unknown product"
          }`,
        });
        return;
      }
    }

    const orderItems = cart.items.map((item) => ({
      product: item.product._id,
      name: item.product.name,
      quantity: item.quantity,
      price: item.price,
      imageUrl: item.product.imageUrl,
    }));

    const { clientSecret, paymentIntentId } = await createPaymentIntent(
      cart.totalAmount
    );
    console.log("Created Payment Intent:", {
      clientSecret,
      paymentIntentId: clientSecret.split("_secret")[0],
    });

    const order = new Order({
      user: req.user._id,
      items: orderItems,
      totalAmount: cart.totalAmount,
      shippingAddress,
      paymentStatus: "pending",
      orderStatus: OrderStatus.PENDING_PAYMENT,
      paymentIntentId,
    });
    await order.save();
    console.log("Created Order:", {
      orderId: order._id,
      paymentIntentId: order.paymentIntentId,
    });

    cart.items = [];
    await cart.save();

    res.status(201).json({
      success: true,
      data: {
        _id: order._id.toString(),
        items: order.items,
        totalAmount: order.totalAmount,
        shippingAddress: order.shippingAddress,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        createdAt: order.createdAt,
        clientSecret,
      },
      message: "Order created successfully",
    });
  } catch (error) {
    console.error("Error in createOrder:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
    });
  }
};

export const getOrderById = async (
  req: Request<{ orderId: string }>,
  res: Response<ApiResponse<OrderResponse>>
): Promise<void> => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user._id,
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        _id: order._id.toString(),
        items: order.items,
        totalAmount: order.totalAmount,
        shippingAddress: order.shippingAddress,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        createdAt: order.createdAt,
      },
      message: "Order retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getOrderById:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve order",
    });
  }
};

export const getUserOrders = async (
  req: Request,
  res: Response<ApiResponse<OrderResponse[]>>
): Promise<void> => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    const orderResponses = orders.map((order) => ({
      _id: order._id.toString(),
      items: order.items,
      totalAmount: order.totalAmount,
      shippingAddress: order.shippingAddress,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      createdAt: order.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: orderResponses,
      message: "Orders retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getUserOrders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve orders",
    });
  }
};

export const handlePaymentSuccess = async (
  req: Request<{}, {}, { orderId: string; paymentIntentId: string }>,
  res: Response<ApiResponse<null>>
): Promise<void> => {
  try {
    const { orderId, paymentIntentId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({
        success: false,
        message: "Order not found",
      });
      return;
    }

    order.paymentStatus = "paid";
    order.orderStatus = OrderStatus.CONFIRMED;
    order.paymentIntentId = paymentIntentId;
    await order.save();

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity },
      });
    }

    const user = await User.findById(order.user);

    if (user) {
      await Promise.all([
        emailService.sendOrderConfirmation(order, user),
        emailService.sendPaymentConfirmation(order, user),
      ]);
    }

    res.status(200).json({
      success: true,
      data: null,
      message: "Payment processed successfully",
    });
  } catch (error) {
    console.error("Error in handlePaymentSuccess:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process payment",
    });
  }
};

export const updateOrderStatus = async (
  orderId: string,
  status: keyof typeof OrderStatus
): Promise<void> => {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new Error("Order not found");
  }

  order.orderStatus = status;
  await order.save();

  const user = await User.findById(order.user);
  if (user) {
    await emailService.sendOrderStatusUpdate(order, user, status);
  }
};
