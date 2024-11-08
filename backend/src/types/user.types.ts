import { z } from "zod";
import { Document, Types } from "mongoose";

export const UserRole = {
  USER: "USER",
  ADMIN: "ADMIN",
} as const;

const phoneRegex = /^[0-9]{10}$/;
const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const addressSchema = z.object({
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().regex(/^[0-9]{6}$/, "Invalid pincode"),
  isDefault: z.boolean().default(false),
});

export const userSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .regex(
      passwordRegex,
      "Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character"
    ),
  phone: z.string().regex(phoneRegex, "Invalid phone number"),
  role: z
    .enum(Object.values(UserRole) as [string, ...string[]], {
      required_error: "Role is required",
    })
    .default(UserRole.USER),
  addresses: z.array(addressSchema).default([]),
  isEmailVerified: z.boolean().default(false),
  isPhoneVerified: z.boolean().default(false),
  passwordResetToken: z.string().optional(),
  passwordResetExpires: z.date().optional(),
});

export const signupSchema = userSchema.omit({
  role: true,
  isEmailVerified: true,
  isPhoneVerified: true,
  passwordResetToken: true,
  passwordResetExpires: true,
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type UserType = z.infer<typeof userSchema>;
export type SignupType = z.infer<typeof signupSchema>;
export type LoginType = z.infer<typeof loginSchema>;
export type AddressType = z.infer<typeof addressSchema>;

export interface IAddress extends AddressType {
  _id: Types.ObjectId;
}

export interface IUser extends Omit<UserType, "addresses">, Document {
  _id: Types.ObjectId;
  addresses: IAddress[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
}
