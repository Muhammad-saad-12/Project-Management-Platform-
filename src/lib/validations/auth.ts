import { z } from "zod";

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Invalid email address format" }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters long" })
    .max(100, { message: "Password must be at most 100 characters long" }),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Invalid email address format" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
