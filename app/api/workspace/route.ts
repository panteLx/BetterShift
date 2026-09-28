import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessions";
import { getRequestWorkspace, getWorkspaceRole } from "@/lib/workspace";
import { MULTI_TENANT } from "@/lib/auth/env";

export async function GET(request: NextRequest) {
  try {
    const workspace = await getRequestWorkspace();
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const user = await getSessionUser(request.headers);
    const role = user ? await getWorkspaceRole(user.id, workspace.id) : null;

    return NextResponse.json({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role,
      multiTenant: MULTI_TENANT,
    });
  } catch (error) {
    console.error("[API] GET /api/workspace error:", error);
    return NextResponse.json({ error: "Failed to resolve workspace" }, { status: 500 });
  }
}
