import { z } from "zod";

export const addMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Invalid email format" }),
  role: z
    .enum(["ADMIN", "MEMBER"], {
      errorMap: () => ({ message: "Role must be ADMIN or MEMBER" }),
    })
    .optional()
    .default("MEMBER"),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"], {
    errorMap: () => ({ message: "Role must be ADMIN or MEMBER" }),
  }),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
