import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/workspace-access";
import { listWorkspaceMembers } from "@/lib/workspace-membership-end";

export async function GET(request: NextRequest) {
  const ctx = await requireWorkspaceMember(request);
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({
    members: await listWorkspaceMembers(ctx.workspace.id),
    currentUserId: ctx.user.id,
    currentRole: ctx.role,
  });
}
