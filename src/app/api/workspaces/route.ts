import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { createWorkspaceSchema } from "@/lib/validations/workspace";
import { generateUniqueWorkspaceSlug } from "@/lib/slug";
import { Role } from "@prisma/client";

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: You must be logged in to create a workspace" },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const result = createWorkspaceSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: result.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name } = result.data;

    // 3. Generate a unique slug for the workspace
    const slug = await generateUniqueWorkspaceSlug(name);

    // 4. Create Workspace and WorkspaceMember record linking user as ADMIN
    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        members: {
          create: {
            userId: user.id,
            role: Role.ADMIN,
          },
        },
      },
      include: {
        members: {
          select: {
            id: true,
            role: true,
            userId: true,
            workspaceId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    // 5. Return created workspace
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    console.error("Create workspace error:", error);
    return NextResponse.json(
      { error: "Internal server error creating workspace" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: user.id,
          },
        },
      },
      include: {
        members: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(workspaces, { status: 200 });
  } catch (error) {
    console.error("Get workspaces error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching workspaces" },
      { status: 500 }
    );
  }
}
