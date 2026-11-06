import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { calendars, member, organization, user } from "@/lib/db/schema";
import { MULTI_TENANT } from "@/lib/auth/env";
import { canManageWorkspaces } from "@/lib/auth/admin";
import { getValidatedAdminUser, isErrorResponse } from "@/lib/auth/admin-helpers";

/** GET /api/admin/workspaces: every workspace with owner and counts. 404 unless multi-tenant. */
export async function GET(request: NextRequest) {
  if (!MULTI_TENANT) return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  try {
    const admin = await getValidatedAdminUser(request);
    if (isErrorResponse(admin)) return admin;
    if (!canManageWorkspaces(admin)) {
      return NextResponse.json({ error: "Admin access required", code: "forbidden" }, { status: 403 });
    }
    const rows = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
        ownerId: user.id,
        ownerName: user.name,
        ownerEmail: user.email,
        memberCount: sql<number>`(select count(*) from ${member} m where m.organization_id = ${organization.id})`,
        calendarCount: sql<number>`(select count(*) from ${calendars} c where c.workspace_id = ${organization.id})`,
      })
      .from(organization)
      .leftJoin(member, and(eq(member.organizationId, organization.id), eq(member.role, "owner")))
      .leftJoin(user, eq(member.userId, user.id))
      .orderBy(asc(organization.name), asc(organization.id));
    return NextResponse.json({
      workspaces: rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        createdAt: r.createdAt,
        owner: r.ownerId ? { id: r.ownerId, name: r.ownerName, email: r.ownerEmail } : null,
        memberCount: Number(r.memberCount),
        calendarCount: Number(r.calendarCount),
      })),
    });
  } catch (error) {
    console.error("[Admin Workspaces API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch workspaces" }, { status: 500 });
  }
}
