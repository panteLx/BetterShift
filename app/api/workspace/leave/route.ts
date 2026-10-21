import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { endMembership } from "@/lib/workspace-membership-end";
import { logUserAction, type WorkspaceMembershipEndedMetadata } from "@/lib/audit-log";

export async function POST(request: NextRequest) {
  const ctx = await requireWorkspaceMember(request);
  if (ctx instanceof NextResponse) return ctx;
  const result = endMembership(ctx.workspace.id, ctx.user.id);
  if (!result.ok) {
    return NextResponse.json({ error: `Cannot leave: ${result.reason}`, code: result.reason }, { status: 409 });
  }
  void logUserAction<WorkspaceMembershipEndedMetadata>({
    action: "workspace.leave",
    userId: ctx.user.id,
    resourceType: "workspace",
    resourceId: ctx.workspace.id,
    workspaceId: ctx.workspace.id,
    metadata: { targetUser: ctx.user.id, calendarsTransferred: result.calendarsTransferred, removedBy: "self" },
    request,
  });
  return NextResponse.json({ calendarsTransferred: result.calendarsTransferred });
}
