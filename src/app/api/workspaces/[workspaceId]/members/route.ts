import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { addMemberSchema } from "@/lib/validations/member";
import { Role } from "@prisma/client";
import { logActivity } from "@/lib/activity";

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

    // 3. Verify caller's membership
    const currentMembership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId,
        },
      },
      select: { role: true },
    });

    if (!currentMembership) {
      return NextResponse.json(
        { error: "Forbidden: You are not a member of this workspace" },
        { status: 403 }
      );
    }

    // 4. List all members belonging to the workspace
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        { role: "asc" }, // ADMINs first
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json(
      {
        workspace,
        callerRole: currentMembership.role,
        callerId: user.id,
        members,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get workspace members error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching workspace members" },
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

    const { workspaceId } = await context.params;

    // 2. Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // 3. Verify caller is an ADMIN
    const currentMembership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId,
        },
      },
      select: { role: true },
    });

    if (!currentMembership || currentMembership.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden: Only workspace admins can invite or add members" },
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

    const result = addMemberSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, role } = result.data;

    // 5. Look up user by email
    const targetUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, createdAt: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: `User with email '${email}' was not found. They must register first.` },
        { status: 404 }
      );
    }

    // 6. Check if already a member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: targetUser.id,
          workspaceId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "This user is already a member of this workspace" },
        { status: 409 }
      );
    }

    // 7. Create member
    const newMember = await prisma.workspaceMember.create({
      data: {
        userId: targetUser.id,
        workspaceId,
        role: role as Role,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    // 8. Log activity
    await logActivity({
      workspaceId,
      actorId: user.id,
      action: "MEMBER_ADDED",
      description: `Added ${targetUser.email} to workspace as ${role}`,
    });

    return NextResponse.json(newMember, { status: 201 });
  } catch (error) {
    console.error("Add workspace member error:", error);
    return NextResponse.json(
      { error: "Internal server error adding workspace member" },
      { status: 500 }
    );
  }
}
