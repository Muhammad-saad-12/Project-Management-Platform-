import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { createTaskSchema } from "@/lib/validations/task";
import { logActivity } from "@/lib/activity";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: You must be logged in to create a task" },
        { status: 401 }
      );
    }

    const { projectId } = await context.params;

    // 2. Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // 3. Verify user has access to the workspace containing the project
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: project.workspaceId,
        },
      },
      select: { role: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this project's workspace" },
        { status: 403 }
      );
    }

    // 4. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const result = createTaskSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { title, description, status, priority, dueDate, assigneeId, position } =
      result.data;

    // 5. If assigneeId provided, ensure user exists
    if (assigneeId) {
      const assigneeExists = await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { id: true },
      });

      if (!assigneeExists) {
        return NextResponse.json(
          { error: "Assignee user not found" },
          { status: 400 }
        );
      }
    }

    // 6. Calculate position if omitted
    let taskPosition = position;
    if (taskPosition === undefined) {
      const maxPositionTask = await prisma.task.findFirst({
        where: { projectId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      taskPosition = maxPositionTask ? maxPositionTask.position + 1 : 0;
    }

    // 7. Create task
    const task = await prisma.task.create({
      data: {
        title,
        description: description ?? null,
        status,
        priority,
        position: taskPosition,
        dueDate: dueDate ?? null,
        projectId,
        assigneeId: assigneeId ?? null,
      },
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Record activity log
    await logActivity({
      workspaceId: project.workspaceId,
      actorId: user.id,
      action: "TASK_CREATED",
      description: `Created task "${task.title}"`,
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json(
      { error: "Internal server error creating task" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { projectId } = await context.params;

    // 2. Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // 3. Verify user has access to workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: project.workspaceId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this project's workspace" },
        { status: 403 }
      );
    }

    // 4. List all tasks associated with project, including assignee details
    const tasks = await prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: [
        { position: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(tasks, { status: 200 });
  } catch (error) {
    console.error("Get tasks error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching tasks" },
      { status: 500 }
    );
  }
}
