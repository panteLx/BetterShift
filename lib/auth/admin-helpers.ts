import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import type { User } from "@/lib/auth";

export type AdminUser = User;

/**
 * Get the current admin user from request headers.
 * Returns null if not authenticated.
 */
export async function getAdminUser(
  headers: Headers
): Promise<AdminUser | null> {
  const sessionUser = await getSessionUser(headers);
  if (!sessionUser) {
    return null;
  }

  const [currentUser] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, sessionUser.id))
    .limit(1);

  return currentUser || null;
}

/**
 * Get and validate the current admin user from request.
 * Returns NextResponse with error if not authenticated or user not found.
 * Returns the admin user object if successful.
 */
export async function getValidatedAdminUser(
  request: NextRequest
): Promise<AdminUser | NextResponse> {
  const currentUser = await getAdminUser(request.headers);

  if (!currentUser) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  return currentUser;
}

/**
 * Get and validate a target user by ID.
 * Returns NextResponse with error if not found.
 * Returns the user object if successful.
 */
export async function getValidatedTargetUser(
  userId: string
): Promise<AdminUser | NextResponse> {
  const [targetUser] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return targetUser;
}

/**
 * Type guard to check if result is a NextResponse (error)
 */
export function isErrorResponse(
  result: AdminUser | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
