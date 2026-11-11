import { z } from "zod";

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "Task title is required" })
    .max(255, { message: "Task title must be at most 255 characters long" }),
  description: z
    .string()
    .trim()
    .max(5000, { message: "Description must be at most 5000 characters long" })
    .optional()
    .nullable(),
  status: z
    .enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"], {
      errorMap: () => ({ message: "Status must be TODO, IN_PROGRESS, REVIEW, or DONE" }),
    })
    .optional()
    .default("TODO"),
  priority: z
    .enum(["LOW", "MEDIUM", "HIGH", "URGENT"], {
      errorMap: () => ({ message: "Priority must be LOW, MEDIUM, HIGH, or URGENT" }),
    })
    .optional()
    .default("MEDIUM"),
  dueDate: z
    .union([
      z.string().refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Invalid date format",
      }),
      z.date(),
    ])
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  assigneeId: z.string().trim().min(1).optional().nullable(),
  position: z.number().int().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
