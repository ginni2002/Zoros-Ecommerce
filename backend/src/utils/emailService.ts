import nodemailer from "nodemailer";
import { IOrder } from "../types/order.types";
import { IUser } from "../types/user.types";
import { ISeller } from "../types/seller.types";

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

export const testEmail = async () => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    await transporter.verify();
    console.log("Email configuration is valid");

    const info = await transporter.sendMail({
      from: `"Zoros-ecom" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: "Test Email",
      text: "Test email message.",
    });
    console.log("Test email sent:", info.messageId);
  } catch (error) {
    console.error("Email configuration error:", error);
  }
};

const createSellerVerificationTemplate = (
  seller: ISeller,
  verificationToken: string
): EmailTemplate => {
  const verificationLink = `${process.env.FRONTEND_URL}/api/sellerAuth/verify-email?token=${verificationToken}`;

  return {
    subject: "Verify Your Seller Account - Zoros-Ecom",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a1a1a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">Verify Your Seller Account</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f8f8f8;">
          <h2 style="color: #333333;">Hello ${seller.businessDetails.businessName},</h2>
          <p>Thank you for registering as a seller on Zoros-Ecom. Please verify your email address to continue with the registration process.</p>
          
          <div style="background-color: #ffffff; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
            <p>Click the button below to verify your email address:</p>
            <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 10px 0;">Verify Email</a>
            <p style="font-size: 12px; color: #666666;">This link will expire in 24 hours</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 20px; border-radius: 5px;">
            <h3 style="color: #333333; margin-top: 0;">Business Details</h3>
            <p><strong>Business Name:</strong> ${seller.businessDetails.businessName}</p>
            <p><strong>GST Number:</strong> ${seller.businessDetails.gstNumber}</p>
          </div>
        </div>
      </div>
    `,
  };
};

const createSellerApprovalTemplate = (seller: ISeller): EmailTemplate => {
  return {
    subject: "Seller Account Approved - Zoros-Ecom",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a1a1a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">Account Approved</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f8f8f8;">
          <h2 style="color: #333333;">Hello ${seller.businessDetails.businessName},</h2>
          <p>Congratulations! Your seller account has been approved. You can now start listing your products on Zoros-Ecom.</p>
          
          <div style="background-color: #ffffff; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
            <a href="${process.env.FRONTEND_URL}/seller/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 10px 0;">Go to Dashboard</a>
          </div>
        </div>
      </div>
    `,
  };
};

const createSellerRejectionTemplate = (
  seller: ISeller,
  reason: string
): EmailTemplate => {
  return {
    subject: "Seller Account Application Status - Zoros-Ecom",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a1a1a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">Application Status Update</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f8f8f8;">
          <h2 style="color: #333333;">Hello ${seller.businessDetails.businessName},</h2>
          <p>We have reviewed your seller account application. Unfortunately, we are unable to approve your application at this time.</p>
          
          <div style="background-color: #ffffff; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #333333; margin-top: 0;">Reason for Rejection</h3>
            <p>${reason}</p>
          </div>
          
          <p>If you believe this was a mistake or would like to provide additional information, please contact our support team.</p>
        </div>
      </div>
    `,
  };
};

export const sendSellerVerificationEmail = async (
  seller: ISeller,
  verificationToken: string
): Promise<void> => {
  const template = createSellerVerificationTemplate(seller, verificationToken);
  await sendEmail(seller.businessDetails.businessEmail, template);
};

export const sendSellerApprovalEmail = async (
  seller: ISeller
): Promise<void> => {
  const template = createSellerApprovalTemplate(seller);
  await sendEmail(seller.businessDetails.businessEmail, template);
};

export const sendSellerRejectionEmail = async (
  seller: ISeller,
  reason: string
): Promise<void> => {
  const template = createSellerRejectionTemplate(seller, reason);
  await sendEmail(seller.businessDetails.businessEmail, template);
};

const createAdminOTPTemplate = (
  adminName: string,
  otp: string
): EmailTemplate => {
  return {
    subject: "Admin Login Verification - Zoros-Ecom",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #1a1a1a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">Admin Login Verification</h1>
        </div>
        
        <div style="padding: 20px; background-color: #f8f8f8;">
          <h2 style="color: #333333;">Hello ${adminName},</h2>
          <p>Your OTP for admin login verification is:</p>
          
          <div style="background-color: #ffffff; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
            <h1 style="color: #333333; margin: 0; letter-spacing: 5px;">${otp}</h1>
          </div>
          
          <p style="color: #666666; font-size: 14px;">This OTP will expire in 5 minutes.</p>
          <p style="color: #666666; font-size: 14px;">If you didn't request this OTP, please ignore this email.</p>
        </div>
        
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center;">
          <p style="margin: 0; color: #666666;">Secure Admin Access - Zoros-Ecom</p>
        </div>
      </div>
    `,
  };
};

export const sendAdminOTP = async (
  email: string,
  name: string,
  otp: string
): Promise<void> => {
  const template = createAdminOTPTemplate(name, otp);
  await sendEmail(email, template);
};

export default {
  sendOrderConfirmation,
  sendPaymentConfirmation,
  sendOrderStatusUpdate,
  sendSellerVerificationEmail,
  sendSellerApprovalEmail,
  sendSellerRejectionEmail,
  sendAdminOTP,
};
