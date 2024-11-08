import { Request, Response } from "express";
import stripe from "../utils/stripeUtils";
import Order from "../models/orderSchema";
import Product from "../models/productSchema";
import { OrderStatus } from "../types/order.types";
import emailService from "../utils/emailService";
import User from "../models/userSchema";
import redisClient from "../utils/redisUtils";

export const handleStripeWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sig = req.headers["stripe-signature"];

  // console.log("Webhook Headers:", req.headers);
  // console.log("Webhook Body Type:", typeof req.body);

  try {
    let event;

    if (sig && process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      // console.log("Verified Webhook Event:", event.type);
    } else {
      event = req.body;
      // console.log("Test Webhook Event:", event.type);
    }

    if (event.id) {
      const isDuplicate = await redisClient.isWebhookProcessed(event.id);
      if (isDuplicate) {
        console.log("Duplicate webhook received:", event.id);
        res.json({ received: true, status: "duplicate" });
        return;
      }
    }

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        // console.log("Payment Intent ID:", paymentIntent.id);

        const order =
          process.env.NODE_ENV === "production"
            ? await Order.findOne({ paymentIntentId: paymentIntent.id })
            : await Order.findOne().sort({ createdAt: -1 });

        if (!order) {
          console.log("No orders found in the system");
          res.json({ received: true });
          return;
        }

        // console.log("Processing most recent order:", order._id);

        if (order.paymentStatus === "paid") {
          console.log("Order already processed:", order._id);
          res.json({ received: true, status: "already_processed" });
          return;
        }

        order.paymentStatus = "paid";
        order.orderStatus = OrderStatus.CONFIRMED;
        await order.save();

        // console.log("Order status updated to:", order.orderStatus);

        const session = await Order.startSession();
        try {
          await session.withTransaction(async () => {
            for (const item of order.items) {
              const product = await Product.findById(item.product);
              if (!product || product.stock < item.quantity) {
                throw new Error(
                  `Insufficient stock for product ${item.product}`
                );
              }
              product.stock -= item.quantity;
              await product.save();
              await redisClient.invalidateProduct(item.product.toString());
            }

            // Send emails
            const user = await User.findById(order.user);
            if (user) {
              // console.log("Attempting to send emails to:", user.email);
              try {
                await Promise.all([
                  emailService.sendOrderConfirmation(order, user),
                  emailService.sendPaymentConfirmation(order, user),
                ]);
                // console.log("Payment & Order confirmation email sent");
              } catch (emailError) {
                console.error("Email sending error:", emailError);
              }
              await redisClient.invalidateCart(user._id.toString());
            }
            await redisClient.invalidateSearchCache();
          });
        } finally {
          await session.endSession();
        }

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const order = await Order.findOne({
          paymentIntentId: paymentIntent.id,
        });
        if (order) {
          order.paymentStatus = "failed";
          await order.save();
          const user = await User.findById(order.user);
          if (user) {
            await redisClient.invalidateCart(user._id.toString());
          }
        }
        break;
      }
    }

    res.json({ received: true, status: "processed" });
  } catch (error) {
    console.error("Webhook Error:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }

    try {
      await redisClient.invalidateSearchCache();
    } catch (cacheError) {
      console.error("Cache invalidation error:", cacheError);
    }

    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Webhook Error",
    });
  }
};
