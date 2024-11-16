import { z } from "zod";
import { Types, Document } from "mongoose";
import { addressSchema } from "./user.types";

export const SellerStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export interface IBusinessDetails {
  businessName: string;
  gstNumber: string;
  businessAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  businessPhone: string;
  businessEmail: string;
}

export interface ISeller extends Document {
  user: Types.ObjectId;
  businessDetails: IBusinessDetails;
  status: keyof typeof SellerStatus;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  storeDescription?: string;
  password: string;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  monthlyRevenue: Map<string, number>; // Format: "YYYY-MM" -> revenue

  verificationStatus: string;

  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
  generateVerificationToken(): string;
  verifyEmail(token: string): Promise<boolean>;
}

export const businessDetailsSchema = z.object({
  businessName: z
    .string()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name must not exceed 100 characters"),
  gstNumber: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GST number"
    ),
  businessAddress: addressSchema,
  businessPhone: z.string().regex(/^[0-9]{10}$/, "Invalid phone number"),
  businessEmail: z.string().email("Invalid email address"),
});

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character"
  );

export const sellerRegistrationSchema = z.object({
  businessDetails: businessDetailsSchema,
  storeDescription: z
    .string()
    .min(20, "Store description must be at least 20 characters")
    .max(500, "Store description must not exceed 500 characters")
    .optional(),
  password: passwordSchema,
});

export const sellerLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type SellerRegistrationType = z.infer<typeof sellerRegistrationSchema>;
export type SellerLoginType = z.infer<typeof sellerLoginSchema>;

export interface SellerResponse {
  _id: string;
  businessDetails: IBusinessDetails;
  status: string;
  isEmailVerified: boolean;
  storeDescription?: string;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  verificationStatus: string;
}

export interface ISellerProduct extends Document {
  seller: Types.ObjectId;
  baseProduct: Types.ObjectId;
  price: number;
  stock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const sellerProductSchema = z.object({
  baseProduct: z.string(),
  price: z.number().min(0, "Price cannot be negative"),
  stock: z.number().min(0, "Stock cannot be negative"),
  isActive: z.boolean().default(true),
});

export type SellerProductType = z.infer<typeof sellerProductSchema>;
