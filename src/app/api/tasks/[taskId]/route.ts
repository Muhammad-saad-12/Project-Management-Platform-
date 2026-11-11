import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { z } from "zod";
import { logActivity } from "@/lib/activity";

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  position: z.number().int().optional(),
  dueDate: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  assigneeId: z.string().trim().min(1).optional().nullable(),
});

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = await context.params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: {
          select: { id: true, email: true },
        },
        project: {
          select: { id: true, name: true, workspaceId: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: task.project.workspaceId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this workspace" },
        { status: 403 }
      );
    }

    return NextResponse.json(task, { status: 200 });
  } catch (error) {
    console.error("Get task error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching task" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = await context.params;

    // Find task and its project workspace
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: { id: true, workspaceId: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: task.project.workspaceId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this workspace" },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const result = updateTaskSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation error", details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // If assigneeId is provided, verify user exists
    if (result.data.assigneeId) {
      const assigneeExists = await prisma.user.findUnique({
        where: { id: result.data.assigneeId },
        select: { id: true },
      });
      if (!assigneeExists) {
        return NextResponse.json(
          { error: "Assignee user not found" },
          { status: 400 }
        );
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: result.data,
      include: {
        assignee: {
          select: { id: true, email: true },
        },
        project: {
          select: { id: true, name: true, workspaceId: true },
        },
      },
    });

    // Record activity log
    if (result.data.status && result.data.status !== task.status) {
      await logActivity({
        workspaceId: task.project.workspaceId,
        actorId: user.id,
        action: "STATUS_CHANGED",
        description: `Changed status of "${updatedTask.title}" from ${task.status} to ${result.data.status}`,
      });
    } else {
      await logActivity({
        workspaceId: task.project.workspaceId,
        actorId: user.id,
        action: "TASK_UPDATED",
        description: `Updated task "${updatedTask.title}"`,
      });
    }

    return NextResponse.json(updatedTask, { status: 200 });
  } catch (error) {
    console.error("Update task error:", error);
    return NextResponse.json(
      { error: "Internal server error updating task" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = await context.params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: { workspaceId: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: task.project.workspaceId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this workspace" },
        { status: 403 }
      );
    }

    await prisma.task.delete({ where: { id: taskId } });

    // Record activity log
    await logActivity({
      workspaceId: task.project.workspaceId,
      actorId: user.id,
      action: "TASK_DELETED",
      description: `Deleted task "${task.title}"`,
    });

    return NextResponse.json({ message: "Task deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Delete task error:", error);
    return NextResponse.json(
      { error: "Internal server error deleting task" },
      { status: 500 }
    );
  }
}
