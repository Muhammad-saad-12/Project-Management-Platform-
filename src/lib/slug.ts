import crypto from "crypto";
import prisma from "@/lib/prisma";

/**
 * Convert string to URL-safe slug
 */
export function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || "workspace";
}

/**
 * Generate a unique workspace slug, appending a random hex suffix if collision occurs
 */
export async function generateUniqueWorkspaceSlug(name: string): Promise<string> {
  const baseSlug = slugify(name);
  let candidate = baseSlug;

  const existing = await prisma.workspace.findUnique({
    where: { slug: candidate },
    select: { id: true },
  });

  if (!existing) {
    return candidate;
  }

  while (true) {
    const suffix = crypto.randomBytes(3).toString("hex");
    candidate = `${baseSlug}-${suffix}`;
    const match = await prisma.workspace.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!match) {
      return candidate;
    }
  }
}
