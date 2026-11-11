import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Workspace name is required" })
    .max(50, { message: "Workspace name must be at most 50 characters long" }),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "Workspace name must not be empty" })
      .max(50, { message: "Workspace name must be at most 50 characters long" })
      .optional(),
    slug: z
      .string()
      .trim()
      .min(3, { message: "Slug must be at least 3 characters long" })
      .max(50, { message: "Slug must be at most 50 characters long" })
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message:
          "Slug must contain only lowercase alphanumeric characters and single hyphens, without leading/trailing hyphens",
      })
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.slug !== undefined, {
    message: "At least one of name or slug must be provided",
  });

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
