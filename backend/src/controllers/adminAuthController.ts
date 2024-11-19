import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { ApiResponse } from "../types/api.types";
import {
  AdminResponse,
  AdminRegistrationType,
  AdminLoginType,
  OTPVerificationType,
} from "../types/admin.types";
import {
  adminRegistrationSchema,
  adminLoginSchema,
  otpVerificationSchema,
} from "../types/admin.types";
import Admin from "../models/adminSchema";
import { formatZodError } from "../utils/errorUtils";
import { sendAdminOTP } from "../utils/emailService";
import {
  generateOTP,
  saveOTP,
  verifyOTP,
  deleteOTP,
} from "../utils/redisOtpService";

const sanitizeAdminResponse = (admin: any, token?: string): AdminResponse => {
  const adminObject = admin.toObject();
  const { password, __v, ...sanitizedAdmin } = adminObject;
  return token ? { ...sanitizedAdmin, token } : sanitizedAdmin;
};

export const registerAdmin = async (
  req: Request<{}, ApiResponse<AdminResponse>, AdminRegistrationType>,
  res: Response<ApiResponse<AdminResponse>>
): Promise<void> => {
  try {
    const validationResult = adminRegistrationSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const { name, email, password, phone } = validationResult.data;

    const existingAdmin = await Admin.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingAdmin) {
      res.status(400).json({
        success: false,
        message: "Email or phone number already registered",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = new Admin({
      name,
      email,
      password: hashedPassword,
      phone,
      isEmailVerified: true,
    });

    await admin.save();

    res.status(201).json({
      success: true,
      data: sanitizeAdminResponse(admin),
      message: "Admin registered successfully",
    });
  } catch (error) {
    console.error("Error in registerAdmin:", error);
    res.status(500).json({
      success: false,
      message: "Failed to register admin",
    });
  }
};

export const login = async (
  req: Request<{}, ApiResponse<{ email: string }>, AdminLoginType>,
  res: Response<ApiResponse<{ email: string }>>
): Promise<void> => {
  try {
    const validationResult = adminLoginSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const { email, password } = validationResult.data;

    const admin = await Admin.findOne({ email });
    if (!admin) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const isPasswordMatch = await admin.comparePassword(password);
    if (!isPasswordMatch) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const otp = generateOTP();
    await saveOTP(email, otp);
    await sendAdminOTP(email, admin.name, otp);

    res.status(200).json({
      success: true,
      data: { email },
      message: "OTP sent to your email",
    });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

export const verifyOTPAndLogin = async (
  req: Request<{}, ApiResponse<AdminResponse>, OTPVerificationType>,
  res: Response<ApiResponse<AdminResponse>>
): Promise<void> => {
  try {
    const validationResult = otpVerificationSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const { email, otp } = validationResult.data;

    const isValid = await verifyOTP(email, otp);
    if (!isValid) {
      res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
      return;
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      res.status(404).json({
        success: false,
        message: "Admin not found",
      });
      return;
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = admin.generateAuthToken();

    res.status(200).json({
      success: true,
      data: sanitizeAdminResponse(admin, token),
      message: "Logged in successfully",
    });
  } catch (error) {
    console.error("Error in verifyOTPAndLogin:", error);
    res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
};
