import { Request, Response } from "express";

import {
  UpdateProfileType,
  ChangePasswordType,
  AddressType,
  updateProfileSchema,
  changePasswordSchema,
  addressSchema,
} from "../types/profile.types";
import User from "../models/userSchema";
import { formatZodError } from "../utils/errorUtils";

// Get profile
export const getProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: user,
      message: "Profile retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getProfile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve profile",
    });
  }
};

// Update profile
export const updateProfile = async (
  req: Request<{}, {}, UpdateProfileType>,
  res: Response
): Promise<void> => {
  try {
    const validationResult = updateProfileSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const { email, phone } = validationResult.data;

    if (email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.user._id },
      });

      if (existingUser) {
        res.status(400).json({
          success: false,
          message: "Email already in use",
        });
        return;
      }
    }

    if (phone) {
      const existingUser = await User.findOne({
        phone,
        _id: { $ne: req.user._id },
      });

      if (existingUser) {
        res.status(400).json({
          success: false,
          message: "Phone number already in use",
        });
        return;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      validationResult.data,
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: updatedUser,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Error in updateProfile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

// Change password

export const changePassword = async (
  req: Request<{}, {}, ChangePasswordType>,
  res: Response
): Promise<void> => {
  try {
    const validationResult = changePasswordSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const { currentPassword, newPassword } = validationResult.data;

    if (currentPassword === newPassword) {
      res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
      return;
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const isPasswordMatch = await user.comparePassword(currentPassword);
    if (!isPasswordMatch) {
      res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
      return;
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Error in changePassword:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  }
};

// Add/Update address
export const updateAddress = async (
  req: Request<{ addressId?: string }, {}, AddressType>,
  res: Response
): Promise<void> => {
  try {
    const validationResult = addressSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: formatZodError(validationResult.error),
      });
      return;
    }

    const addressData = validationResult.data;
    const user = await User.findById(req.user._id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (addressData.isDefault) {
      user.addresses.forEach((addr) => (addr.isDefault = false));
    }

    if (req.params.addressId) {
      const addressIndex = user.addresses.findIndex(
        (addr) => addr._id.toString() === req.params.addressId
      );

      if (addressIndex === -1) {
        res.status(404).json({
          success: false,
          message: "Address not found",
        });
        return;
      }

      user.addresses[addressIndex] = {
        ...user.addresses[addressIndex],
        ...addressData,
      };
    } else {
      if (user.addresses.length === 0) {
        addressData.isDefault = true;
      }
      user.addresses.push(addressData as any);
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: user.addresses,
      message: req.params.addressId
        ? "Address updated successfully"
        : "Address added successfully",
    });
  } catch (error) {
    console.error("Error in updateAddress:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update address",
    });
  }
};

// Delete address
export const deleteAddress = async (
  req: Request<{ addressId: string }>,
  res: Response
): Promise<void> => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const addressIndex = user.addresses.findIndex(
      (addr) => addr._id.toString() === req.params.addressId
    );

    if (addressIndex === -1) {
      res.status(404).json({
        success: false,
        message: "Address not found",
      });
      return;
    }

    const wasDefault = user.addresses[addressIndex].isDefault;
    user.addresses.splice(addressIndex, 1);

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: user.addresses,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteAddress:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete address",
    });
  }
};
