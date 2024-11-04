import { Request, Response } from "express";
import { SignupType, LoginType, IUser } from "../types/user.types";
import { ApiResponse } from "../types/api.types";
import { signupSchema, loginSchema } from "../types/user.types";
import User from "../models/userSchema";
import { formatZodError } from "../utils/errorUtils";

interface UserResponse {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  addresses: Array<{
    street: string;
    city: string;
    state: string;
    pincode: string;
    isDefault: boolean;
  }>;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  token?: string;
}

const sanitizeUser = (user: IUser, token?: string): UserResponse => {
  const userObject = user.toObject();
  const { password, __v, ...sanitizedUser } = userObject;
  return token ? { ...sanitizedUser, token } : sanitizedUser;
};

export const signup = async (
  req: Request<{}, ApiResponse<UserResponse>, SignupType>,
  res: Response<ApiResponse<UserResponse>>
): Promise<void> => {
  try {
    const validationResult = signupSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const { email, phone } = validationResult.data;

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: "User already exists with this email or phone",
      });
      return;
    }

    const user = new User(validationResult.data);
    await user.save();

    const token = user.generateAuthToken();

    res.status(201).json({
      success: true,
      data: sanitizeUser(user, token),
      message: "User created successfully",
    });
  } catch (error) {
    console.error("Error in signup:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create user",
    });
  }
};

export const login = async (
  req: Request<{}, ApiResponse<UserResponse>, LoginType>,
  res: Response<ApiResponse<UserResponse>>
): Promise<void> => {
  try {
    const validationResult = loginSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const { email, password } = validationResult.data;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const token = user.generateAuthToken();

    res.status(200).json({
      success: true,
      data: sanitizeUser(user, token),
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

export const getCurrentUser = async (
  req: Request,
  res: Response<ApiResponse<UserResponse>>
): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      data: sanitizeUser(req.user),
      message: "User profile retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getCurrentUser:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve user profile",
    });
  }
};
