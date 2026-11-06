import { NextRequest, NextResponse } from "next/server";
import { MANAGER_ROLES, requireWorkspaceMember } from "@/lib/workspace-access";
import { getWorkspaceCounts } from "@/lib/workspace-admin";

export async function GET(request: NextRequest) {
  const ctx = await requireWorkspaceMember(request, MANAGER_ROLES);
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json(await getWorkspaceCounts(ctx.workspace.id));
}
