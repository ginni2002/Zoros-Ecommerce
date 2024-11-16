import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ISeller, SellerStatus } from "../types/seller.types";
import Seller from "../models/sellerSchema";

interface SellerJWTPayload {
  sellerId: string;
  status: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      seller?: ISeller;
      sellerToken?: string;
    }
  }
}

export const authenticateSeller = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Seller authentication token is missing",
      });
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as SellerJWTPayload;

    const seller = await Seller.findById(decoded.sellerId).select("-password");
    if (!seller) {
      res.status(401).json({
        success: false,
        message: "Seller not found",
      });
      return;
    }

    if (seller.status !== SellerStatus.APPROVED) {
      res.status(403).json({
        success: false,
        message: "Seller account is not approved",
      });
      return;
    }

    req.seller = seller;
    req.sellerToken = token;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Please authenticate as a seller",
    });
  }
};

export const checkSellerEmailVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.seller) {
    res.status(401).json({
      success: false,
      message: "Seller not found",
    });
    return;
  }

  if (!req.seller.isEmailVerified) {
    res.status(403).json({
      success: false,
      message: "Please verify your email first",
    });
    return;
  }
  next();
};

export const checkSellerStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.seller) {
    res.status(401).json({
      success: false,
      message: "Seller not found",
    });
    return;
  }

  switch (req.seller.status) {
    case SellerStatus.PENDING:
      res.status(403).json({
        success: false,
        message: "Your seller account is pending approval",
      });
      return;
    case SellerStatus.REJECTED:
      res.status(403).json({
        success: false,
        message: "Your seller account application was rejected",
      });
      return;
    case SellerStatus.APPROVED:
      next();
      return;
    default:
      res.status(403).json({
        success: false,
        message: "Invalid seller status",
      });
      return;
  }
};

export const canManageProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.seller) {
      res.status(401).json({
        success: false,
        message: "Seller not found",
      });
      return;
    }

    if (!req.seller.isEmailVerified) {
      res.status(403).json({
        success: false,
        message: "Email verification required to manage products",
      });
      return;
    }

    if (req.seller.status !== SellerStatus.APPROVED) {
      res.status(403).json({
        success: false,
        message: "Account approval required to manage products",
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking seller permissions",
    });
  }
};

export const requireVerifiedSeller = [
  authenticateSeller,
  checkSellerEmailVerification,
  checkSellerStatus,
];

export const requireSellerWithProductAccess = [
  authenticateSeller,
  checkSellerEmailVerification,
  checkSellerStatus,
  canManageProducts,
];
