import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";
import { ApiResponse } from "../types/api.types";
import {
  UploadedFile,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  FILE_SIZE_LIMITS,
} from "../types/file.types";
import fileUpload from "express-fileupload";

declare module "express" {
  interface Request {
    files?: fileUpload.FileArray | null;
  }
}

export const validateRequest = (schema: AnyZodObject) => {
  return async (
    req: Request,
    res: Response<ApiResponse<null>>,
    next: NextFunction
  ) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors: Record<string, string[]> = {};
        error.errors.forEach((err) => {
          const path = err.path.join(".");
          if (!formattedErrors[path]) {
            formattedErrors[path] = [];
          }
          formattedErrors[path].push(err.message);
        });

        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: formattedErrors,
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: { general: ["An unexpected error occurred"] },
        });
      }
    }
  };
};

export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const sanitize = (obj: Record<string, any>): void => {
    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === "string") {
        obj[key] = obj[key].replace(/<[^>]*>/g, "").trim();
        if (key.startsWith("$")) {
          delete obj[key];
        }
      } else if (obj[key] && typeof obj[key] === "object") {
        sanitize(obj[key]);
      }
    });
  };

  sanitize(req.body || {});
  sanitize(req.query || {});
  sanitize(req.params || {});

  next();
};

interface FileValidationOptions {
  allowedTypes: string[];
  maxSize: number;
  required?: boolean;
  maxFiles?: number;
}

export const validateFileUpload = (options: FileValidationOptions) => {
  return (
    req: Request,
    res: Response<ApiResponse<null>>,
    next: NextFunction
  ): void => {
    try {
      if (!req.files) {
        if (options.required) {
          res.status(400).json({
            success: false,
            message: "File upload is required",
          });
          return;
        }
        next();
        return;
      }

      const files = Object.values(req.files).flat();

      if (options.maxFiles && files.length > options.maxFiles) {
        res.status(400).json({
          success: false,
          message: `Maximum ${options.maxFiles} files allowed`,
        });
        return;
      }

      for (const file of files) {
        if (!options.allowedTypes.includes(file.mimetype)) {
          res.status(400).json({
            success: false,
            message: `Invalid file type. Allowed types: ${options.allowedTypes.join(
              ", "
            )}`,
          });
          return;
        }

        if (file.size > options.maxSize) {
          res.status(400).json({
            success: false,
            message: `File too large. Maximum size: ${(
              options.maxSize /
              (1024 * 1024)
            ).toFixed(2)}MB`,
          });
          return;
        }
      }

      next();
    } catch (error) {
      console.error("File validation error:", error);
      res.status(500).json({
        success: false,
        message: "Error processing file upload",
      });
    }
  };
};

export const validateImageUpload = validateFileUpload({
  allowedTypes: [...ALLOWED_IMAGE_TYPES],
  maxSize: FILE_SIZE_LIMITS.IMAGE,
  maxFiles: 5,
});

export const validateDocumentUpload = validateFileUpload({
  allowedTypes: [...ALLOWED_DOCUMENT_TYPES],
  maxSize: FILE_SIZE_LIMITS.DOCUMENT,
  maxFiles: 1,
});
