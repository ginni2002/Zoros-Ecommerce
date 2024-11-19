import { Request, Response } from "express";
import { ApiResponse } from "../types/api.types";
import { ISeller, SellerStatus } from "../types/seller.types";
import Seller from "../models/sellerSchema";
import {
  sendSellerApprovalEmail,
  sendSellerRejectionEmail,
} from "../utils/emailService";
import { z } from "zod";

const sellerActionSchema = z.object({
  sellerId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid seller ID"),
  reason: z.string().optional(),
});

type SellerActionType = z.infer<typeof sellerActionSchema>;

export const getAllSellers = async (
  req: Request,
  res: Response<ApiResponse<{ sellers: ISeller[]; total: number }>>
): Promise<void> => {
  try {
    const { status, page = "1", limit = "10" } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const query: any = {};
    if (status) {
      query.status = status;
    }

    const [sellers, total] = await Promise.all([
      Seller.find(query)
        .skip(skip)
        .limit(parseInt(limit as string))
        .select("-password -emailVerificationToken -emailVerificationExpires"),
      Seller.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        sellers,
        total,
      },
      message: "Sellers retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getAllSellers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve sellers",
    });
  }
};

export const getPendingSellers = async (
  req: Request,
  res: Response<ApiResponse<{ sellers: ISeller[]; total: number }>>
): Promise<void> => {
  try {
    const { page = "1", limit = "10" } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const query = {
      status: SellerStatus.PENDING,
      isEmailVerified: true,
    };

    const [sellers, total] = await Promise.all([
      Seller.find(query)
        .skip(skip)
        .limit(parseInt(limit as string))
        .select("-password -emailVerificationToken -emailVerificationExpires"),
      Seller.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        sellers,
        total,
      },
      message: "Pending sellers retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getPendingSellers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve pending sellers",
    });
  }
};

export const getSellerById = async (
  req: Request<{ id: string }>,
  res: Response<ApiResponse<ISeller>>
): Promise<void> => {
  try {
    const seller = await Seller.findById(req.params.id).select(
      "-password -emailVerificationToken -emailVerificationExpires"
    );

    if (!seller) {
      res.status(404).json({
        success: false,
        message: "Seller not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: seller,
      message: "Seller details retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getSellerById:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve seller details",
    });
  }
};

export const approveSeller = async (
  req: Request<{}, {}, SellerActionType>,
  res: Response<ApiResponse<ISeller>>
): Promise<void> => {
  try {
    const validation = sellerActionSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid input",
      });
      return;
    }

    const { sellerId } = validation.data;

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      res.status(404).json({
        success: false,
        message: "Seller not found",
      });
      return;
    }

    if (!seller.isEmailVerified) {
      res.status(400).json({
        success: false,
        message: "Seller email is not verified",
      });
      return;
    }

    if (seller.status === SellerStatus.APPROVED) {
      res.status(400).json({
        success: false,
        message: "Seller is already approved",
      });
      return;
    }

    seller.status = SellerStatus.APPROVED;
    await seller.save();

    await sendSellerApprovalEmail(seller);

    res.status(200).json({
      success: true,
      data: seller,
      message: "Seller approved successfully",
    });
  } catch (error) {
    console.error("Error in approveSeller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve seller",
    });
  }
};

export const rejectSeller = async (
  req: Request<{}, {}, SellerActionType>,
  res: Response<ApiResponse<ISeller>>
): Promise<void> => {
  try {
    const validation = sellerActionSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Invalid input",
      });
      return;
    }

    const { sellerId, reason } = validation.data;

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      res.status(404).json({
        success: false,
        message: "Seller not found",
      });
      return;
    }

    seller.status = SellerStatus.REJECTED;
    await seller.save();

    await sendSellerRejectionEmail(
      seller,
      reason || "Your application does not meet our current requirements."
    );

    res.status(200).json({
      success: true,
      data: seller,
      message: "Seller rejected successfully",
    });
  } catch (error) {
    console.error("Error in rejectSeller:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject seller",
    });
  }
};

export const getSellerStatistics = async (
  req: Request,
  res: Response<
    ApiResponse<{
      total: number;
      pending: number;
      approved: number;
      rejected: number;
      emailVerified: number;
    }>
  >
): Promise<void> => {
  try {
    const [total, pending, approved, rejected, emailVerified] =
      await Promise.all([
        Seller.countDocuments(),
        Seller.countDocuments({ status: SellerStatus.PENDING }),
        Seller.countDocuments({ status: SellerStatus.APPROVED }),
        Seller.countDocuments({ status: SellerStatus.REJECTED }),
        Seller.countDocuments({ isEmailVerified: true }),
      ]);

    res.status(200).json({
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
        emailVerified,
      },
      message: "Seller statistics retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getSellerStatistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve seller statistics",
    });
  }
};
