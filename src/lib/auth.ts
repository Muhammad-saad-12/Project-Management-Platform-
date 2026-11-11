import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";

export const AUTH_COOKIE_NAME = "auth_token";
const JWT_SECRET = process.env.JWT_SECRET || "default-insecure-secret-change-in-env";

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface SafeUser {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Hash a plaintext password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

/**
 * Compare plaintext password with hashed password
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a signed JWT token
 */
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Extract auth token from Request headers or cookies
 */
export function getAuthTokenFromRequest(request: Request): string | null {
  // 1. Check Authorization header: Bearer <token>
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // 2. Check Cookie header
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    const authCookie = cookies.find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
    if (authCookie) {
      return decodeURIComponent(authCookie.substring(AUTH_COOKIE_NAME.length + 1));
    }
  }

  return null;
}

/**
 * Retrieve authenticated user from token
 */
export async function getAuthenticatedUser(request: Request): Promise<SafeUser | null> {
  const token = getAuthTokenFromRequest(request);
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload || !payload.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}
