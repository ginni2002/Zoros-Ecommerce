import { Request, Response } from "express";
import stripe from "../utils/stripeUtils";
import Order from "../models/orderSchema";
import Product from "../models/productSchema";
import { OrderStatus } from "../types/order.types";
import emailService from "../utils/emailService";
import User from "../models/userSchema";

export const handleStripeWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sig = req.headers["stripe-signature"];

  if (!sig || typeof sig !== "string") {
    res.status(400).json({ success: false, message: "No signature found" });
    return;
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;

        const order = await Order.findOne({
          paymentIntentId: paymentIntent.id,
        });

        if (!order) {
          console.error(
            "Order not found for payment intent:",
            paymentIntent.id
          );
          res.status(400).json({ success: false, message: "Order not found" });
          return;
        }

        order.paymentStatus = "paid";
        order.orderStatus = OrderStatus.CONFIRMED;
        await order.save();

        for (const item of order.items) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stock: -item.quantity },
          });
        }

        // confirmation email
        const user = await User.findById(order.user);
        if (user) {
          await Promise.all([
            emailService.sendOrderConfirmation(order, user),
            emailService.sendPaymentConfirmation(order, user),
          ]);
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
        }

        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Webhook Error",
    });
  }
};
