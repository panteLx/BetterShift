import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { member, organization, user } from "@/lib/db/schema";
import { MULTI_TENANT } from "@/lib/auth/env";
import { canEditUser, canManageWorkspaceMemberships } from "@/lib/auth/admin";
import { getValidatedAdminUser, isErrorResponse } from "@/lib/auth/admin-helpers";
import { rateLimit } from "@/lib/rate-limiter";
import { logAdminAction, type AdminWorkspaceMembershipMetadata } from "@/lib/audit-log";
import { endMembership, listWorkspaceMembers } from "@/lib/workspace-membership-end";
import { busyResponse } from "@/lib/workspace-access";

type Params = { params: Promise<{ id: string }> };
const notFound = (code = "not_found") => NextResponse.json({ error: "Not found", code }, { status: 404 });

async function guard(request: NextRequest, params: Params["params"], mutation: boolean) {
  if (!MULTI_TENANT) return notFound();
  const admin = await getValidatedAdminUser(request);
  if (isErrorResponse(admin)) return admin;
  if (!canManageWorkspaceMemberships(admin)) {
    return NextResponse.json({ error: "Admin access required", code: "forbidden" }, { status: 403 });
  }
  if (mutation) {
    const limited = rateLimit(request, admin.id, "admin-user-mutations");
    if (limited) return limited;
  }
  const workspace = await db.query.organization.findFirst({
    where: eq(organization.id, (await params).id),
    columns: { id: true, slug: true },
  });
  if (!workspace) return notFound("workspace_not_found");
  return { admin, workspace };
}

export async function GET(request: NextRequest, { params }: Params) {
  const ctx = await guard(request, params, false);
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ members: await listWorkspaceMembers(ctx.workspace.id) });
}

export async function POST(request: NextRequest, { params }: Params) {
  const ctx = await guard(request, params, true);
  if (ctx instanceof NextResponse) return ctx;
  const body = (await request.json().catch(() => null)) as { email?: unknown; role?: unknown } | null;
  const role = body?.role;
  if (role !== "member" && role !== "admin") {
    return NextResponse.json({ error: "Invalid role", code: "invalid_role" }, { status: 400 });
  }
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return NextResponse.json({ error: "Invalid email", code: "invalid_email" }, { status: 400 });
  const [target] = await db.select().from(user).where(sql`lower(${user.email}) = ${email}`).limit(1);
  if (!target) return notFound("user_not_found");
  if (!canEditUser(ctx.admin, target)) {
    return NextResponse.json({ error: "Insufficient permissions for this user", code: "forbidden" }, { status: 403 });
  }

  const existing = await db.query.member.findFirst({
    where: and(eq(member.organizationId, ctx.workspace.id), eq(member.userId, target.id)),
    columns: { id: true },
  });
  if (existing) return NextResponse.json({ error: "Already a member", code: "already_member" }, { status: 409 });
  try {
    await db.insert(member).values({ id: crypto.randomUUID(), organizationId: ctx.workspace.id, userId: target.id, role });
  } catch (error) {
    // Concurrent POSTs can both pass the pre-check; the unique index is the real guard.
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed: member.organization_id, member.user_id")) {
      return NextResponse.json({ error: "Already a member", code: "already_member" }, { status: 409 });
    }
    throw error;
  }
  void logAdminAction<AdminWorkspaceMembershipMetadata>({
    action: "admin.workspace_member_add",
    userId: ctx.admin.id,
    resourceType: "user",
    resourceId: target.id,
    workspaceId: ctx.workspace.id,
    metadata: { targetUser: target.email, workspaceSlug: ctx.workspace.slug, role },
    request,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const ctx = await guard(request, params, true);
  if (ctx instanceof NextResponse) return ctx;
  const userId = request.nextUrl.searchParams.get("userId") ?? "";
  const [target] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!target) return notFound("user_not_found");
  if (!canEditUser(ctx.admin, target)) {
    return NextResponse.json({ error: "Insufficient permissions for this user", code: "forbidden" }, { status: 403 });
  }
  let result;
  try {
    result = endMembership(ctx.workspace.id, target.id);
  } catch (error) {
    return busyResponse(error);
  }
  if (!result.ok) {
    const status = result.reason === "not_member" ? 404 : 409;
    return NextResponse.json({ error: `Cannot remove: ${result.reason}`, code: result.reason }, { status });
  }
  void logAdminAction<AdminWorkspaceMembershipMetadata>({
    action: "admin.workspace_member_remove",
    userId: ctx.admin.id,
    resourceType: "user",
    resourceId: target.id,
    workspaceId: ctx.workspace.id,
    metadata: { targetUser: target.email, workspaceSlug: ctx.workspace.slug, calendarsTransferred: result.calendarsTransferred },
    request,
  });
  return NextResponse.json({ calendarsTransferred: result.calendarsTransferred });
}
