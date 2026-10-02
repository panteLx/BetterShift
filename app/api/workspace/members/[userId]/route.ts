import { NextRequest, NextResponse } from "next/server";
import { MANAGER_ROLES, busyResponse, requireWorkspaceMember } from "@/lib/workspace-access";
import { canChangeRole, canRemoveMember, isWorkspaceRole } from "@/lib/auth/workspace-permissions";
import { changeMemberRole } from "@/lib/workspace-admin";
import { endMembership } from "@/lib/workspace-membership-end";
import { getWorkspaceRole } from "@/lib/workspace";
import { rateLimit } from "@/lib/rate-limiter";
import {
  logUserAction,
  type WorkspaceMembershipEndedMetadata,
  type WorkspaceRoleChangedMetadata,
} from "@/lib/audit-log";

type Params = { params: Promise<{ userId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = await requireWorkspaceMember(request, MANAGER_ROLES);
  if (ctx instanceof NextResponse) return ctx;
  const limited = rateLimit(request, ctx.user.id, "workspace-mutation");
  if (limited) return limited;
  const { userId } = await params;
  const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
  const next = body?.role;
  if (next !== "admin" && next !== "member") {
    return NextResponse.json({ error: "Invalid role", code: "invalid_role" }, { status: 400 });
  }
  const targetRole = await getWorkspaceRole(userId, ctx.workspace.id);
  if (!isWorkspaceRole(targetRole)) {
    return NextResponse.json({ error: "Not found", code: "not_member" }, { status: 404 });
  }
  if (targetRole === "owner") {
    return NextResponse.json({ error: "Cannot change the owner", code: "owner" }, { status: 409 });
  }
  if (!canChangeRole(ctx.role, targetRole, next)) {
    return NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403 });
  }
  let result;
  try {
    result = changeMemberRole(ctx.workspace.id, userId, next);
  } catch (error) {
    return busyResponse(error);
  }
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, code: result.reason },
      { status: result.reason === "owner" ? 409 : 404 }
    );
  }
  if (result.changed) {
    void logUserAction<WorkspaceRoleChangedMetadata>({
      action: "workspace.role_change",
      userId: ctx.user.id,
      resourceType: "user",
      resourceId: userId,
      workspaceId: ctx.workspace.id,
      metadata: { targetUser: userId, from: result.from, to: next },
      request,
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const ctx = await requireWorkspaceMember(request, MANAGER_ROLES);
  if (ctx instanceof NextResponse) return ctx;
  const { userId } = await params;
  if (userId === ctx.user.id) {
    return NextResponse.json({ error: "Use leave to remove yourself", code: "self" }, { status: 400 });
  }
  const targetRole = await getWorkspaceRole(userId, ctx.workspace.id);
  if (!isWorkspaceRole(targetRole)) {
    return NextResponse.json({ error: "Not found", code: "not_member" }, { status: 404 });
  }
  if (targetRole === "owner") {
    return NextResponse.json({ error: "Cannot remove the owner", code: "owner" }, { status: 409 });
  }
  if (!canRemoveMember(ctx.role, targetRole)) {
    return NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403 });
  }
  let result;
  try {
    result = endMembership(ctx.workspace.id, userId);
  } catch (error) {
    return busyResponse(error);
  }
  if (!result.ok) {
    const status = result.reason === "not_member" ? 404 : 409;
    return NextResponse.json({ error: `Cannot remove member: ${result.reason}`, code: result.reason }, { status });
  }
  void logUserAction<WorkspaceMembershipEndedMetadata>({
    action: "workspace.member_remove",
    userId: ctx.user.id,
    resourceType: "user",
    resourceId: userId,
    workspaceId: ctx.workspace.id,
    metadata: { targetUser: userId, calendarsTransferred: result.calendarsTransferred, removedBy: "workspace" },
    request,
  });
  return NextResponse.json({ calendarsTransferred: result.calendarsTransferred });
}
