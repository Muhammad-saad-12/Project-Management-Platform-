import { z } from "zod";

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Project name is required" })
    .max(100, { message: "Project name must be at most 100 characters long" }),
  description: z
    .string()
    .trim()
    .max(500, { message: "Description must be at most 500 characters long" })
    .optional()
    .nullable(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
