import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^254[17]\d{8}$/, "Phone must be in the format 2547XXXXXXXX or 2541XXXXXXXX");

export const registerSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required").max(60),
  lastName: z.string().trim().min(2, "Last name is required").max(60),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: phoneSchema,
  idNumber: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/, "ID number must be 6-10 digits"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  referralCode: z.string().trim().max(16).optional().or(z.literal("")),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(4, "Enter your ID number or phone number").max(255),
  password: z.string().min(1, "Password is required").max(72),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const setupSchema = z.object({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(255),
  phone: phoneSchema,
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  businessName: z.string().trim().min(2, "Business name is required").max(120),
  businessLocation: z.string().trim().min(2, "Business location is required").max(160),
  supportEmail: z.string().trim().email().max(255).optional().or(z.literal("")),
  supportPhone: z.string().trim().max(20).optional().or(z.literal("")),
  mpesaShortcode: z.string().trim().max(12).optional().or(z.literal("")),
  mpesaAccountNumber: z.string().trim().max(40).optional().or(z.literal("")),
  mpesaEnvironment: z.enum(["sandbox", "production"]).optional().default("sandbox"),
  mpesaCallbackUrl: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .max(300)
    .optional()
    .or(z.literal("")),
});

export type SetupInput = z.infer<typeof setupSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required").max(60),
  lastName: z.string().trim().min(2, "Last name is required").max(60),
  idNumber: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/, "ID number must be 6-10 digits"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(72, "New password must be at most 72 characters")
      .regex(/[A-Z]/, "Password must include at least one uppercase letter (A-Z)")
      .regex(/[a-z]/, "Password must include at least one lowercase letter (a-z)")
      .regex(/\d/, "Password must include at least one number (0-9)")
      .regex(/[^A-Za-z0-9]/, "Password must include at least one special character (!@#$%^&*)"),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password cannot be the same as your current password",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const phoneChangeRequestSchema = z.object({
  requestedPhone: phoneSchema,
  reason: z.string().trim().min(5, "Reason must be at least 5 characters").max(300),
});

export type PhoneChangeRequestInput = z.infer<typeof phoneChangeRequestSchema>;
