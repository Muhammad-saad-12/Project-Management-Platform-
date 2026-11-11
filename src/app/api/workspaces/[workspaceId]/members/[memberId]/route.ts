import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { updateMemberRoleSchema } from "@/lib/validations/member";
import { Role } from "@prisma/client";
import { logActivity } from "@/lib/activity";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
    memberId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate caller
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId, memberId } = await context.params;

    // 2. Verify caller is an ADMIN in this workspace
    const callerMembership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId,
        },
      },
      select: { role: true },
    });

    if (!callerMembership || callerMembership.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden: Only workspace admins can update member roles" },
        { status: 403 }
      );
    }

    // 3. Find target member
    const targetMember = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
    });

    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: "Member not found in this workspace" },
        { status: 404 }
      );
    }

    // 4. Validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const result = updateMemberRoleSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { role } = result.data;

    // 5. Prevent demoting the last ADMIN in the workspace
    if (targetMember.role === Role.ADMIN && role !== Role.ADMIN) {
      const adminCount = await prisma.workspaceMember.count({
        where: {
          workspaceId,
          role: Role.ADMIN,
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the only administrator in this workspace" },
          { status: 400 }
        );
      }
    }

    // 6. Update member role
    const updatedMember = await prisma.workspaceMember.update({
      where: { id: memberId },
      data: { role: role as Role },
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

    // 7. Log activity
    await logActivity({
      workspaceId,
      actorId: user.id,
      action: "ROLE_UPDATED",
      description: `Updated ${updatedMember.user.email}'s role to ${role}`,
    });

    return NextResponse.json(updatedMember, { status: 200 });
  } catch (error) {
    console.error("Update member role error:", error);
    return NextResponse.json(
      { error: "Internal server error updating member role" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate caller
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId, memberId } = await context.params;

    // 2. Retrieve caller membership
    const callerMembership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId,
        },
      },
      select: { id: true, role: true },
    });

    if (!callerMembership) {
      return NextResponse.json(
        { error: "Forbidden: You are not a member of this workspace" },
        { status: 403 }
      );
    }

    // 3. Find target member
    const targetMember = await prisma.workspaceMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: { email: true },
        },
      },
    });

    if (!targetMember || targetMember.workspaceId !== workspaceId) {
      return NextResponse.json(
        { error: "Member not found in this workspace" },
        { status: 404 }
      );
    }

    // 4. Permissions check: Only ADMINs can remove others (users can remove themselves)
    const isRemovingSelf = targetMember.userId === user.id;
    if (!isRemovingSelf && callerMembership.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden: Only workspace admins can remove members" },
        { status: 403 }
      );
    }

    // 5. If target is an ADMIN, ensure workspace has at least one other ADMIN
    if (targetMember.role === Role.ADMIN) {
      const adminCount = await prisma.workspaceMember.count({
        where: {
          workspaceId,
          role: Role.ADMIN,
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the only administrator in this workspace" },
          { status: 400 }
        );
      }
    }

    // 6. Delete member record
    await prisma.workspaceMember.delete({
      where: { id: memberId },
    });

    // 7. Log activity
    await logActivity({
      workspaceId,
      actorId: user.id,
      action: "MEMBER_REMOVED",
      description: isRemovingSelf
        ? `${targetMember.user.email} left the workspace`
        : `Removed ${targetMember.user.email} from workspace`,
    });

    return NextResponse.json(
      { message: "Member removed from workspace successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Remove workspace member error:", error);
    return NextResponse.json(
      { error: "Internal server error removing workspace member" },
      { status: 500 }
    );
  }
}
