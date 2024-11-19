import { z } from "zod";
import { Document } from "mongoose";

export const AdminRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
} as const;

export interface IAdmin extends Document {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: keyof typeof AdminRole;
  isEmailVerified: boolean;
  lastLogin?: Date;

  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
}

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"
  );

export const adminRegistrationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  phone: z.string().regex(/^[0-9]{10}$/, "Invalid phone number"),
});

export const adminLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const otpVerificationSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().regex(/^[0-9]{6}$/, "Invalid OTP"),
});

export type AdminRegistrationType = z.infer<typeof adminRegistrationSchema>;
export type AdminLoginType = z.infer<typeof adminLoginSchema>;
export type OTPVerificationType = z.infer<typeof otpVerificationSchema>;

export interface AdminResponse {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isEmailVerified: boolean;
  lastLogin?: Date;
  token?: string;
}

export interface RateLimitInfo {
  remaining: number;
  total: number;
  resetIn: string;
}

export interface DetailedRateLimitInfo {
  ip: string;
  limits: {
    api: RateLimitInfo;
    auth: RateLimitInfo;
    search: RateLimitInfo;
    order: RateLimitInfo;
  };
}

export interface ClearLimitInfo {
  cleared: number;
}
