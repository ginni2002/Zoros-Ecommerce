import { Request, Response } from "express";
import { ApiResponse } from "../types/api.types";
import {
  OrderFilterType,
  OrderHistoryResponse,
  orderFilterSchema,
} from "../types/order-history.types";
import Order from "../models/orderSchema";
import { formatZodError } from "../utils/errorUtils";

export const getOrderHistory = async (
  req: Request<{}, {}, {}, OrderFilterType>,
  res: Response<ApiResponse<OrderHistoryResponse>>
): Promise<void> => {
  try {
    const validationResult = orderFilterSchema.safeParse(req.query);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const {
      startDate,
      endDate,
      status,
      minAmount,
      maxAmount,
      page = "1",
      limit = "10",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = validationResult.data;

    const query: any = { user: req.user._id };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    if (status) {
      query.orderStatus = status;
    }

    if (minAmount || maxAmount) {
      query.totalAmount = {};
      if (minAmount) {
        query.totalAmount.$gte = parseInt(minAmount);
      }
      if (maxAmount) {
        query.totalAmount.$lte = parseInt(maxAmount);
      }
    }

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const sortObject: { [key: string]: "asc" | "desc" } = {
      [sortBy]: sortOrder,
    };

    const [orders, totalOrders] = await Promise.all([
      Order.find(query).sort(sortObject).skip(skip).limit(limitNumber).lean(),
      Order.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalOrders / limitNumber);

    const formattedOrders = orders.map((order) => ({
      _id: order._id.toString(),
      items: order.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        imageUrl: item.imageUrl,
      })),
      totalAmount: order.totalAmount,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      shippingAddress: order.shippingAddress,
      createdAt: order.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: {
        orders: formattedOrders,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalOrders,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1,
        },
      },
      message: "Order history retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getOrderHistory:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve order history",
    });
  }
};

export const getOrderDetails = async (
  req: Request<{ orderId: string }>,
  res: Response
): Promise<void> => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      user: req.user._id,
    }).lean();

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
        ...order,
        _id: order._id.toString(),
      },
      message: "Order details retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getOrderDetails:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve order details",
    });
  }
};
