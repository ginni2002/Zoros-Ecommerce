import nodemailer from "nodemailer";
import { IOrder } from "../types/order.types";
import { IUser } from "../types/user.types";

if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
  throw new Error("Email configuration is missing");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

// Verify transporter connection
transporter.verify((error) => {
  if (error) {
    console.error("Email service error:", error);
  } else {
    console.log("Email service is ready");
  }
});

interface EmailTemplate {
  subject: string;
  html: string;
}

const createOrderConfirmationTemplate = (
  order: IOrder,
  user: IUser
): EmailTemplate => {
  const itemsList = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #E0E0E0;">${
          item.name
        }</td>
        <td style="padding: 12px; border-bottom: 1px solid #E0E0E0;">₹${item.price.toLocaleString(
          "en-IN"
        )}</td>
        <td style="padding: 12px; border-bottom: 1px solid #E0E0E0;">${
          item.quantity
        }</td>
        <td style="padding: 12px; border-bottom: 1px solid #E0E0E0;">₹${(
          item.price * item.quantity
        ).toLocaleString("en-IN")}</td>
      </tr>
    `
    )
    .join("");

  return {
    subject: `Order Confirmed #${order._id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a1a1a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">Order Confirmed</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f8f8f8;">
          <h2 style="color: #333333;">Hello ${user.name},</h2>
          <p>Thank you for your order! We're currently processing it and will notify you once it ships.</p>
          
          <div style="background-color: #ffffff; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333333; margin-top: 0;">Order Summary</h3>
            <p><strong>Order ID:</strong> ${order._id}</p>
            <p><strong>Order Date:</strong> ${new Date(
              order.createdAt
            ).toLocaleString()}</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background-color: #f5f5f5;">
                  <th style="padding: 12px; text-align: left;">Product</th>
                  <th style="padding: 12px; text-align: left;">Price</th>
                  <th style="padding: 12px; text-align: left;">Quantity</th>
                  <th style="padding: 12px; text-align: left;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsList}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="padding: 12px; text-align: right;"><strong>Total Amount:</strong></td>
                  <td style="padding: 12px;"><strong>₹${order.totalAmount.toLocaleString(
                    "en-IN"
                  )}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div style="background-color: #ffffff; padding: 20px; border-radius: 5px;">
            <h3 style="color: #333333; margin-top: 0;">Shipping Details</h3>
            <p style="margin: 5px 0;">
              ${order.shippingAddress.street}<br>
              ${order.shippingAddress.city}<br>
              ${order.shippingAddress.state} - ${order.shippingAddress.pincode}
            </p>
          </div>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center;">
          <p style="margin: 0; color: #666666;">Questions? Contact our support team</p>
        </div>
      </div>
    `,
  };
};

const createPaymentConfirmationTemplate = (
  order: IOrder,
  user: IUser
): EmailTemplate => {
  return {
    subject: `Payment Received for Order #${order._id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a1a1a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">Payment Confirmed</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f8f8f8;">
          <h2 style="color: #333333;">Hello ${user.name},</h2>
          <p>We've received your payment of ₹${order.totalAmount.toLocaleString(
            "en-IN"
          )} for order #${order._id}.</p>
          <p>Your order is now being processed and will be shipped soon.</p>
          
          <div style="background-color: #ffffff; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
            <p style="font-size: 18px; color: #333333;">
              <strong>Amount Paid:</strong> ₹${order.totalAmount.toLocaleString(
                "en-IN"
              )}
            </p>
          </div>
        </div>
      </div>
    `,
  };
};

const createOrderStatusUpdateTemplate = (
  order: IOrder,
  user: IUser,
  status: string
): EmailTemplate => {
  let statusMessage = "";
  switch (status) {
    case "CONFIRMED":
      statusMessage = "Your order has been confirmed and is being processed.";
      break;
    case "SHIPPED":
      statusMessage = "Your order has been shipped and is on its way.";
      break;
    case "DELIVERED":
      statusMessage = "Your order has been delivered successfully.";
      break;
    default:
      statusMessage = `Your order status has been updated to ${status}.`;
  }

  return {
    subject: `Order Status Update: ${status} #${order._id}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a1a1a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">Order Status Update</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f8f8f8;">
          <h2 style="color: #333333;">Hello ${user.name},</h2>
          <p>${statusMessage}</p>
          
          <div style="background-color: #ffffff; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Order ID:</strong> ${order._id}</p>
            <p><strong>Current Status:</strong> ${status}</p>
          </div>
        </div>
      </div>
    `,
  };
};

export const sendEmail = async (
  to: string,
  template: EmailTemplate
): Promise<void> => {
  try {
    // console.log("Attempting to send email to:", to);
    // console.log("Email template:", {
    //   subject: template.subject,
    //   htmlPreview: template.html.substring(0, 100) + "...",
    // });

    const result = await transporter.sendMail({
      from: `"Zoros-Ecom" <${process.env.EMAIL_USER}>`,
      to,
      subject: template.subject,
      html: template.html,
    });

    console.log("Email sent successfully:", {
      messageId: result.messageId,
      response: result.response,
    });
  } catch (error) {
    console.error("Error sending email:", error);

    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }
  }
};

export const sendOrderConfirmation = async (
  order: IOrder,
  user: IUser
): Promise<void> => {
  const template = createOrderConfirmationTemplate(order, user);
  await sendEmail(user.email, template);
};

export const sendPaymentConfirmation = async (
  order: IOrder,
  user: IUser
): Promise<void> => {
  const template = createPaymentConfirmationTemplate(order, user);
  await sendEmail(user.email, template);
};

export const sendOrderStatusUpdate = async (
  order: IOrder,
  user: IUser,
  status: string
): Promise<void> => {
  const template = createOrderStatusUpdateTemplate(order, user, status);
  await sendEmail(user.email, template);
};

export default {
  sendOrderConfirmation,
  sendPaymentConfirmation,
  sendOrderStatusUpdate,
};
