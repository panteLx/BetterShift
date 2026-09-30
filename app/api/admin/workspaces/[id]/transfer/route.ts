import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";
import { MULTI_TENANT } from "@/lib/auth/env";
import { canManageWorkspaces } from "@/lib/auth/admin";
import { getValidatedAdminUser, isErrorResponse } from "@/lib/auth/admin-helpers";
import { rateLimit } from "@/lib/rate-limiter";
import { logAdminAction, type WorkspaceOwnerTransferredMetadata } from "@/lib/audit-log";
import { transferOwnership } from "@/lib/workspace-admin";
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
  const body = (await request.json().catch(() => null)) as { userId?: unknown } | null;
  if (typeof body?.userId !== "string" || !body.userId) {
    return NextResponse.json({ error: "Invalid user", code: "invalid" }, { status: 400 });
  }
  const owner = await db.query.member.findFirst({
    where: and(eq(member.organizationId, id), eq(member.role, "owner")),
    columns: { userId: true },
  });
  if (!owner) return NextResponse.json({ error: "Workspace has no owner", code: "no_owner" }, { status: 409 });

  let result;
  try {
    result = transferOwnership(id, owner.userId, body.userId, { exemptFromLimit: true });
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
    metadata: { fromUser: owner.userId, toUser: body.userId, byInstanceAdmin: true },
    request,
  });
  return NextResponse.json({ ok: true });
}
