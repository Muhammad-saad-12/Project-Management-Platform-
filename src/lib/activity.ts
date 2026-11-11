import prisma from "@/lib/prisma";

export interface LogActivityParams {
  workspaceId: string;
  actorId?: string | null;
  action:
    | "TASK_CREATED"
    | "STATUS_CHANGED"
    | "TASK_UPDATED"
    | "TASK_DELETED"
    | "PROJECT_CREATED"
    | "MEMBER_ADDED"
    | "ROLE_UPDATED"
    | "MEMBER_REMOVED"
    | string;
  description: string;
}

/**
 * Persists an activity event for a workspace without throwing errors if logging fails
 */
export async function logActivity({
  workspaceId,
  actorId,
  action,
  description,
}: LogActivityParams) {
  try {
    return await prisma.activityLog.create({
      data: {
        workspaceId,
        actorId: actorId ?? null,
        action,
        description,
      },
    });
  } catch (error) {
    console.error("Failed to record activity log:", error);
    return null;
  }
}
