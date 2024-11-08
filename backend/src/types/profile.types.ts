import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  phone: z
    .string()
    .regex(/^[0-9]{10}$/, "Invalid phone number")
    .optional(),
  email: z.string().email("Invalid email address").optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      "Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character"
    ),
});

export const addressSchema = z.object({
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().regex(/^[0-9]{6}$/, "Invalid pincode"),
  isDefault: z.boolean().default(false),
});

export type UpdateProfileType = z.infer<typeof updateProfileSchema>;
export type ChangePasswordType = z.infer<typeof changePasswordSchema>;
export type AddressType = z.infer<typeof addressSchema>;
