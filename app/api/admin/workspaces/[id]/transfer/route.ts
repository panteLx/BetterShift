import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { member, organization, user } from "@/lib/db/schema";
import { MULTI_TENANT } from "@/lib/auth/env";
import { canEditUser, canManageWorkspaces } from "@/lib/auth/admin";
import { getValidatedAdminUser, isErrorResponse } from "@/lib/auth/admin-helpers";
import { rateLimit } from "@/lib/rate-limiter";
import { logAdminAction, type WorkspaceOwnerTransferredMetadata } from "@/lib/audit-log";
import { assignOwner, transferOwnership } from "@/lib/workspace-admin";
import { busyResponse } from "@/lib/workspace-access";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  if (!MULTI_TENANT) return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  const admin = await getValidatedAdminUser(request);
  if (isErrorResponse(admin)) return admin;
  if (!canManageWorkspaces(admin)) {
    return NextResponse.json({ error: "Admin access required", code: "forbidden" }, { status: 403 });
  }
  const limited = rateLimit(request, admin.id, "admin-user-mutations");
  if (limited) return limited;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { userId?: unknown; email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId && !email) return NextResponse.json({ error: "Invalid user", code: "invalid" }, { status: 400 });
  const workspace = await db.query.organization.findFirst({ where: eq(organization.id, id), columns: { id: true } });
  if (!workspace) return NextResponse.json({ error: "Workspace not found", code: "workspace_not_found" }, { status: 404 });
  const owner = await db.query.member.findFirst({
    where: and(eq(member.organizationId, id), eq(member.role, "owner")),
    columns: { userId: true },
  });

  if (!owner) {
    // Ownerless workspace (e.g. the default one after enabling MULTI_TENANT): the target becomes its first owner.
    const [target] = userId
      ? await db.select().from(user).where(eq(user.id, userId)).limit(1)
      : await db.select().from(user).where(sql`lower(${user.email}) = ${email}`).limit(1);
    if (!target) return NextResponse.json({ error: "User not found", code: "user_not_found" }, { status: 404 });
    if (!canEditUser(admin, target)) {
      return NextResponse.json({ error: "Insufficient permissions for this user", code: "forbidden" }, { status: 403 });
    }
    let assigned;
    try {
      assigned = assignOwner(id, target.id);
    } catch (error) {
      return busyResponse(error);
    }
    if (!assigned.ok) return NextResponse.json({ error: "Workspace has an owner", code: "has_owner" }, { status: 409 });
    void logAdminAction<WorkspaceOwnerTransferredMetadata>({
      action: "workspace.owner_transfer",
      userId: admin.id,
      resourceType: "workspace",
      resourceId: id,
      workspaceId: null,
      metadata: { fromUser: null, toUser: target.id, byInstanceAdmin: true },
      request,
    });
    return NextResponse.json({ ok: true });
  }

  // Demoting the owner is an edit of that user, so a plain admin cannot touch a superadmin owner.
  const ownerUser = await db.query.user.findFirst({ where: eq(user.id, owner.userId) });
  if (!canEditUser(admin, ownerUser)) {
    return NextResponse.json({ error: "Insufficient permissions for this user", code: "forbidden" }, { status: 403 });
  }
  let targetId = userId;
  if (!targetId) {
    const [target] = await db.select({ id: user.id }).from(user).where(sql`lower(${user.email}) = ${email}`).limit(1);
    if (!target) return NextResponse.json({ error: "User not found", code: "user_not_found" }, { status: 404 });
    targetId = target.id;
  }

  let result;
  try {
    result = transferOwnership(id, owner.userId, targetId, { exemptFromLimit: true });
  } catch (error) {
    return busyResponse(error);
  }
  if (!result.ok) {
    const status = { self: 409, not_member: 404, not_owner: 409 }[result.reason as "self" | "not_member" | "not_owner"] ?? 409;
    return NextResponse.json({ error: result.reason, code: result.reason }, { status });
  }
  // Instance-level entry, like a delete: admin actions are not part of the workspace's own log.
  void logAdminAction<WorkspaceOwnerTransferredMetadata>({
    action: "workspace.owner_transfer",
    userId: admin.id,
    resourceType: "workspace",
    resourceId: id,
    workspaceId: null,
    metadata: { fromUser: owner.userId, toUser: targetId, byInstanceAdmin: true },
    request,
  });
  return NextResponse.json({ ok: true });
}
