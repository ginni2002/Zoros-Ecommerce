import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { formatZodError } from "../utils/errorUtils";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err);

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: formatZodError(err),
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    errors: { general: [err.message] },
  });
};
