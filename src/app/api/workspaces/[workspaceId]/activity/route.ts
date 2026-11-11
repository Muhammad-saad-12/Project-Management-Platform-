import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
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
      select: { id: true, name: true, slug: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // 3. Verify user has access to this workspace
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

    // Parse limit parameter if provided (default 50, max 100)
    const { searchParams } = new URL(request.url);
    const limitQuery = parseInt(searchParams.get("limit") || "50", 10);
    const limit = isNaN(limitQuery) || limitQuery <= 0 ? 50 : Math.min(limitQuery, 100);

    // 4. Fetch activity logs ordered by createdAt DESC
    const activities = await prisma.activityLog.findMany({
      where: { workspaceId },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return NextResponse.json(
      {
        workspace,
        activities,
        total: activities.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get workspace activity error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching workspace activity" },
      { status: 500 }
    );
  }
}
