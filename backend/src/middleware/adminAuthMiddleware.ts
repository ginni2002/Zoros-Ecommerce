import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import Admin from "../models/adminSchema";
import { AdminRole } from "../types/admin.types";

interface AdminJWTPayload {
  adminId: string;
  role: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      admin?: any;
      adminToken?: string;
    }
  }
}

export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Admin authentication token is missing",
      });
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as AdminJWTPayload;

    const admin = await Admin.findById(decoded.adminId).select("-password");
    if (!admin) {
      res.status(401).json({
        success: false,
        message: "Admin not found",
      });
      return;
    }

    req.admin = admin;
    req.adminToken = token;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Please authenticate as admin",
    });
  }
};

export const authorizeSuperAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
    res.status(403).json({
      success: false,
      message: "Super Admin access required",
    });
    return;
  }
  next();
};

export const requireSuperAdmin = [authenticateAdmin, authorizeSuperAdmin];
