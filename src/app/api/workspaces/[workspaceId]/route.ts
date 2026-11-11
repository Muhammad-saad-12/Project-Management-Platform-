import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { updateWorkspaceSchema } from "@/lib/validations/workspace";
import { logActivity } from "@/lib/activity";
import { Role } from "@prisma/client";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await context.params;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true },
            },
          },
        },
        projects: true,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Verify caller is a member
    const isMember = workspace.members.some((m) => m.userId === user.id);
    if (!isMember) {
      return NextResponse.json(
        { error: "Forbidden: You are not a member of this workspace" },
        { status: 403 }
      );
    }

    return NextResponse.json(workspace, { status: 200 });
  } catch (error) {
    console.error("Get workspace error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching workspace" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await context.params;

    // 2. Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // 3. Verify user is an ADMIN in this workspace
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId,
        },
      },
    });

    if (!membership || membership.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden: Only workspace admins can update workspace details" },
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

    const result = updateWorkspaceSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, slug } = result.data;

    // 5. Check slug uniqueness if slug is being changed
    if (slug && slug !== workspace.slug) {
      const existing = await prisma.workspace.findUnique({
        where: { slug },
      });

      if (existing && existing.id !== workspaceId) {
        return NextResponse.json(
          { error: "Slug is already taken by another workspace" },
          { status: 409 }
        );
      }
    }

    // 6. Update workspace
    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
      },
      include: {
        members: true,
      },
    });

    // 7. Log activity
    const changes: string[] = [];
    if (name && name !== workspace.name) changes.push(`name to "${name}"`);
    if (slug && slug !== workspace.slug) changes.push(`slug to "/${slug}"`);
    const changeDescription = changes.length > 0 ? changes.join(" and ") : "settings";

    await logActivity({
      workspaceId,
      actorId: user.id,
      action: "WORKSPACE_UPDATED",
      description: `Updated workspace ${changeDescription}`,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("Update workspace error:", error);
    return NextResponse.json(
      { error: "Internal server error updating workspace" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await context.params;

    // 2. Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // 3. Verify user is an ADMIN
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId,
        },
      },
    });

    if (!membership || membership.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden: Only workspace admins can delete a workspace" },
        { status: 403 }
      );
    }

    // 4. Delete workspace (cascades automatically in DB schema to projects, tasks, comments, members, activity logs)
    await prisma.workspace.delete({
      where: { id: workspaceId },
    });

    return NextResponse.json(
      {
        message: "Workspace deleted successfully",
        id: workspaceId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete workspace error:", error);
    return NextResponse.json(
      { error: "Internal server error deleting workspace" },
      { status: 500 }
    );
  }
}
