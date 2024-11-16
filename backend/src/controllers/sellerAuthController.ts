import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { ApiResponse } from "../types/api.types";
import {
  ISeller,
  SellerStatus,
  SellerRegistrationType,
  SellerResponse,
  SellerLoginType,
} from "../types/seller.types";
import { formatZodError, handleSellerAuthError } from "../utils/errorUtils";
import {
  sellerRegistrationSchema,
  sellerLoginSchema,
} from "../types/seller.types";
import Seller from "../models/sellerSchema";
import {
  sendSellerVerificationEmail,
  sendSellerApprovalEmail,
  sendSellerRejectionEmail,
} from "../utils/emailService";

const saltRounds = 10;

const sanitizeSellerResponse = (
  seller: ISeller,
  token?: string
): SellerResponse => {
  const sellerObject = seller.toObject();
  const {
    emailVerificationToken,
    emailVerificationExpires,
    ...sanitizedSeller
  } = sellerObject;
  return token ? { ...sanitizedSeller, token } : sanitizedSeller;
};

export const registerSeller = async (
  req: Request<
    {},
    ApiResponse<SellerResponse>,
    SellerRegistrationType & { password: string }
  >,
  res: Response<ApiResponse<SellerResponse>>
): Promise<void> => {
  try {
    const validationResult = sellerRegistrationSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const { businessDetails, storeDescription, password } =
      validationResult.data;

    if (!password || password.length < 8) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
      return;
    }

    const existingSeller = await Seller.findOne({
      $or: [
        { "businessDetails.businessEmail": businessDetails.businessEmail },
        { "businessDetails.gstNumber": businessDetails.gstNumber },
      ],
    });

    if (existingSeller) {
      res.status(400).json({
        success: false,
        message: "Business email or GST number already registered",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const seller = new Seller({
      businessDetails,
      storeDescription,
      password: hashedPassword,
      status: SellerStatus.PENDING,
      isEmailVerified: false,
    });

    const verificationToken = seller.generateVerificationToken();
    await seller.save();

    await sendSellerVerificationEmail(seller, verificationToken);

    res.status(201).json({
      success: true,
      data: sanitizeSellerResponse(seller),
      message: "Seller registration successful. Please verify your email.",
    });
  } catch (error) {
    console.error("Error in registerSeller:", error);
    const errorResponse = handleSellerAuthError(error);
    res.status(500).json({
      success: false,
      ...errorResponse,
    });
  }
};

export const verifyEmail = async (
  req: Request<{}, ApiResponse<SellerResponse>, { token: string }>,
  res: Response<ApiResponse<SellerResponse>>
): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
      return;
    }

    const seller = await Seller.findOne({
      emailVerificationToken: crypto
        .createHash("sha256")
        .update(token)
        .digest("hex"),
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!seller) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
      return;
    }

    seller.isEmailVerified = true;
    seller.emailVerificationToken = undefined;
    seller.emailVerificationExpires = undefined;
    await seller.save();

    res.status(200).json({
      success: true,
      data: sanitizeSellerResponse(seller),
      message: "Email verified successfully. Waiting for admin approval.",
    });
  } catch (error) {
    console.error("Error in verifyEmail:", error);
    res.status(500).json({
      success: false,
      message: "Email verification failed",
    });
  }
};

export const login = async (
  req: Request<{}, ApiResponse<SellerResponse>, SellerLoginType>,
  res: Response<ApiResponse<SellerResponse>>
): Promise<void> => {
  try {
    const validationResult = sellerLoginSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const { email, password } = validationResult.data;

    const seller = await Seller.findOne({
      "businessDetails.businessEmail": email,
    });
    if (!seller) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const isPasswordMatch = await bcrypt.compare(password, seller.password);
    if (!isPasswordMatch) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    if (!seller.isEmailVerified) {
      res.status(403).json({
        success: false,
        message: "Please verify your email first",
      });
      return;
    }

    if (seller.status !== SellerStatus.APPROVED) {
      res.status(403).json({
        success: false,
        message: "Your account is pending approval or has been rejected",
      });
      return;
    }

    const token = seller.generateAuthToken();

    res.status(200).json({
      success: true,
      data: sanitizeSellerResponse(seller, token),
      message: "Logged in successfully",
    });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

export const getCurrentSeller = async (
  req: Request,
  res: Response<ApiResponse<SellerResponse>>
): Promise<void> => {
  try {
    if (!req.seller) {
      res.status(401).json({
        success: false,
        message: "Seller not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: sanitizeSellerResponse(req.seller),
      message: "Seller profile retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getCurrentSeller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve seller profile",
    });
  }
};

export const resendVerificationEmail = async (
  req: Request<{}, ApiResponse<{ sent: boolean }>, { email: string }>,
  res: Response<ApiResponse<{ sent: boolean }>>
): Promise<void> => {
  try {
    const { email } = req.body;

    const seller = await Seller.findOne({
      "businessDetails.businessEmail": email,
    });
    if (!seller) {
      res.status(404).json({
        success: false,
        message: "Seller not found",
      });
      return;
    }

    if (seller.isEmailVerified) {
      res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
      return;
    }

    const verificationToken = seller.generateVerificationToken();
    await seller.save();

    await sendSellerVerificationEmail(seller, verificationToken);

    res.status(200).json({
      success: true,
      data: { sent: true },
      message: "Verification email sent successfully",
    });
  } catch (error) {
    console.error("Error in resendVerificationEmail:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend verification email",
    });
  }
};
