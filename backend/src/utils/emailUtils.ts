import nodemailer from "nodemailer";
import { IOrder } from "../types/order.types";

if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
  throw new Error("Email credentials are not defined in environment variables");
}

//  Gmail transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD, // This should be your app password, not your regular Gmail password
  },
});

// Verify transporter
transporter.verify((error, success) => {
  if (error) {
    console.error("Email transporter verification failed:", error);
  } else {
    console.log("Email transporter is ready to send emails");
  }
});

export const sendOrderConfirmationEmail = async (
  order: IOrder,
  userEmail: string
): Promise<void> => {
  try {
    const itemsList = order.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">${
            item.name
          }</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">₹${item.price.toLocaleString(
            "en-IN"
          )}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">${
            item.quantity
          }</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">₹${(
            item.price * item.quantity
          ).toLocaleString("en-IN")}</td>
        </tr>
      `
      )
      .join("");

    const mailOptions = {
      from: `"Gaming Store" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `Order Confirmed #${order._id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #000; padding: 20px; text-align: center;">
            <h1 style="color: #fff; margin: 0;">Order Confirmed</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f9f9f9;">
            <h2 style="color: #333;">Thank you for your order!</h2>
            <p>Your order has been confirmed and is being processed.</p>
            
            <div style="background-color: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Order Details</h3>
              <p><strong>Order ID:</strong> ${order._id}</p>
              <p><strong>Order Date:</strong> ${new Date(
                order.createdAt
              ).toLocaleDateString()}</p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                  <tr style="background-color: #f5f5f5;">
                    <th style="padding: 10px; text-align: left;">Product</th>
                    <th style="padding: 10px; text-align: left;">Price</th>
                    <th style="padding: 10px; text-align: left;">Quantity</th>
                    <th style="padding: 10px; text-align: left;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsList}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="padding: 10px; text-align: right;"><strong>Total Amount:</strong></td>
                    <td style="padding: 10px;"><strong>₹${order.totalAmount.toLocaleString(
                      "en-IN"
                    )}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <div style="background-color: #fff; padding: 20px; border-radius: 5px;">
              <h3 style="color: #333; margin-top: 0;">Shipping Address</h3>
              <p style="margin: 5px 0;">
                ${order.shippingAddress.street}<br>
                ${order.shippingAddress.city}<br>
                ${order.shippingAddress.state} - ${
        order.shippingAddress.pincode
      }
              </p>
            </div>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 14px;">
            <p style="margin: 0;">We'll send you another email when your order ships.</p>
            <p style="margin: 10px 0 0;">Thank you for shopping with Gaming Store!</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Order confirmation email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending order confirmation email:", error);
  }
};

// order status updates
export const sendOrderStatusEmail = async (
  order: IOrder,
  userEmail: string
): Promise<void> => {
  try {
    const statusMessages = {
      PROCESSING: "Your order is being processed",
      CONFIRMED: "Your order has been confirmed",
      SHIPPED: "Your order has been shipped",
      DELIVERED: "Your order has been delivered",
    };

    const mailOptions = {
      from: `"Gaming Store" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `Order Status Update #${order._id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #000; padding: 20px; text-align: center;">
            <h1 style="color: #fff; margin: 0;">Order Status Update</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f9f9f9;">
            <h2 style="color: #333;">Hello!</h2>
            <p>Your order status has been updated.</p>
            
            <div style="background-color: #fff; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Order ID:</strong> ${order._id}</p>
              <p><strong>New Status:</strong> ${order.orderStatus}</p>
              <p>${
                statusMessages[
                  order.orderStatus as keyof typeof statusMessages
                ] || "Your order status has been updated"
              }</p>
            </div>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 14px;">
            <p style="margin: 0;">Thank you for shopping with Gaming Store!</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Order status update email sent to ${userEmail}`);
  } catch (error) {
    console.error("Error sending order status update email:", error);
  }
};
