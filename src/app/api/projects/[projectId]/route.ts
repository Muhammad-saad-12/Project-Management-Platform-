import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await context.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            members: {
              select: {
                id: true,
                role: true,
                user: {
                  select: { id: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

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
        { error: "Forbidden: You do not have access to this workspace" },
        { status: 403 }
      );
    }

    return NextResponse.json(project, { status: 200 });
  } catch (error) {
    console.error("Get project error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching project" },
      { status: 500 }
    );
  }
}
