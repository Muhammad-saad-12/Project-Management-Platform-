import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { createCommentSchema } from "@/lib/validations/comment";
import { logActivity } from "@/lib/activity";

type RouteContext = {
  params: Promise<{
    taskId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = await context.params;

    // 2. Verify task exists and retrieve project workspace
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

    // 3. Verify workspace membership
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

    // 4. List comments with author details
    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(comments, { status: 200 });
  } catch (error) {
    console.error("Get comments error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching comments" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskId } = await context.params;

    // 2. Verify task exists and retrieve project workspace
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

    // 3. Verify workspace membership
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

    // 4. Parse & validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const result = createCommentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // 5. Create comment associated with task and authenticated author
    const comment = await prisma.comment.create({
      data: {
        content: result.data.content,
        taskId,
        authorId: user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // 6. Log activity
    await logActivity({
      workspaceId: task.project.workspaceId,
      actorId: user.id,
      action: "COMMENT_ADDED",
      description: `Commented on task "${task.title}"`,
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Create comment error:", error);
    return NextResponse.json(
      { error: "Internal server error creating comment" },
      { status: 500 }
    );
  }
}
