import { NextRequest, NextResponse } from "next/server";
import { MANAGER_ROLES, requireWorkspaceMember } from "@/lib/workspace-access";
import { endMembership } from "@/lib/workspace-membership-end";
import { logUserAction, type WorkspaceMembershipEndedMetadata } from "@/lib/audit-log";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const ctx = await requireWorkspaceMember(request, MANAGER_ROLES);
  if (ctx instanceof NextResponse) return ctx;
  const { userId } = await params;
  if (userId === ctx.user.id) {
    return NextResponse.json({ error: "Use leave to remove yourself", code: "self" }, { status: 400 });
  }
  const result = endMembership(ctx.workspace.id, userId);
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
