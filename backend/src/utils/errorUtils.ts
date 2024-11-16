import { ZodError } from "zod";

export const formatZodError = (error: ZodError) => {
  return error.errors.reduce((acc, curr) => {
    const path = curr.path.join(".");
    if (!acc[path]) {
      acc[path] = [];
    }
    acc[path].push(curr.message);
    return acc;
  }, {} as Record<string, string[]>);
};

export const formatSellerValidationError = (
  error: any
): Record<string, string[]> => {
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return {
      [field]: [
        `This ${field.replace("businessDetails.", "")} is already registered`,
      ],
    };
  }

  const errors: Record<string, string[]> = {};
  Object.keys(error.errors || {}).forEach((key) => {
    errors[key] = [error.errors[key].message];
  });

  return errors;
};

export const handleSellerAuthError = (
  error: any
): { message: string; errors?: Record<string, string[]> } => {
  if (error.code === 11000) {
    return {
      message: "Business already registered",
      errors: formatSellerValidationError(error),
    };
  }

  if (error.name === "ValidationError") {
    return {
      message: "Validation failed",
      errors: formatSellerValidationError(error),
    };
  }

  return {
    message: error.message || "Something went wrong",
  };
};
