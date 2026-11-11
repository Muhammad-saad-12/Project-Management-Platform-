import { z } from "zod";

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, { message: "Comment content cannot be empty" })
    .max(2000, { message: "Comment cannot exceed 2000 characters" }),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
