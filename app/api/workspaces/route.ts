import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessions";
import { MULTI_TENANT } from "@/lib/auth/env";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type WorkspaceCreatedMetadata } from "@/lib/audit-log";
import { getAdminUser } from "@/lib/auth/admin-helpers";
import { isAdmin } from "@/lib/auth/admin";
import { createWorkspace, myWorkspacesPayload } from "@/lib/workspaces";

const STATUS_BY_REASON = { invalid_name: 400, invalid: 400, reserved: 400, taken: 409, limit: 403 } as const;

export async function GET(request: NextRequest) {
  if (!MULTI_TENANT) return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  const user = await getSessionUser(request.headers);
  if (!user) return NextResponse.json({ error: "Authentication required", code: "unauthorized" }, { status: 401 });
  return NextResponse.json(await myWorkspacesPayload(user.id));
}

export async function POST(request: NextRequest) {
  if (!MULTI_TENANT) return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  const user = await getSessionUser(request.headers);
  if (!user) return NextResponse.json({ error: "Authentication required", code: "unauthorized" }, { status: 401 });

  const limited = rateLimit(request, user.id, "workspace-create");
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as { name?: unknown; slug?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name : "";
  const slug = typeof body?.slug === "string" ? body.slug : "";

  const fullUser = await getAdminUser(request.headers);
  const result = createWorkspace(user.id, { name, slug }, { exemptFromLimit: isAdmin(fullUser) });
  if (!result.ok) {
    return NextResponse.json(
      { error: `Cannot create workspace: ${result.reason}`, code: result.reason },
      { status: STATUS_BY_REASON[result.reason] }
    );
  }

  void logUserAction<WorkspaceCreatedMetadata>({
    action: "workspace.create",
    userId: user.id,
    resourceType: "workspace",
    resourceId: result.workspace.id,
    workspaceId: result.workspace.id,
    metadata: { workspaceName: result.workspace.name, slug: result.workspace.slug },
    request,
  });
  return NextResponse.json({ workspace: result.workspace }, { status: 201 });
}
