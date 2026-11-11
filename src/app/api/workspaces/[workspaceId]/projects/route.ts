import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { createProjectSchema } from "@/lib/validations/project";
import { logActivity } from "@/lib/activity";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: You must be logged in to create a project" },
        { status: 401 }
      );
    }

    const { workspaceId } = await context.params;

    // 2. Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // 3. Verify user is a member of the workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId,
        },
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden: You are not a member of this workspace" },
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

    const result = createProjectSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, description } = result.data;

    // 5. Create new Project associated with the workspace
    const project = await prisma.project.create({
      data: {
        name,
        description: description ?? null,
        workspaceId,
      },
    });

    // Record activity log
    await logActivity({
      workspaceId,
      actorId: user.id,
      action: "PROJECT_CREATED",
      description: `Created project "${project.name}"`,
    });

    // 6. Return created project with 201 status
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Create project error:", error);
    return NextResponse.json(
      { error: "Internal server error creating project" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { workspaceId } = await context.params;

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden: You are not a member of this workspace" },
        { status: 403 }
      );
    }

    const projects = await prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects, { status: 200 });
  } catch (error) {
    console.error("Get projects error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching projects" },
      { status: 500 }
    );
  }
}
