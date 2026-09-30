import { NextRequest, NextResponse } from "next/server";
import { MANAGER_ROLES, requireWorkspaceMember } from "@/lib/workspace-access";
import { renameWorkspace } from "@/lib/workspace-admin";
import { effectiveAllowGuestAccess, getWorkspaceSettings, updateWorkspaceSettings } from "@/lib/workspace-settings";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type WorkspaceRenamedMetadata, type WorkspaceSettingsMetadata } from "@/lib/audit-log";

export async function GET(request: NextRequest) {
  const ctx = await requireWorkspaceMember(request, MANAGER_ROLES);
  if (ctx instanceof NextResponse) return ctx;
  const settings = await getWorkspaceSettings(ctx.workspace.id);
  return NextResponse.json({
    name: ctx.workspace.name,
    slug: ctx.workspace.slug,
    allowGuestAccess: effectiveAllowGuestAccess(settings),
    inheritedGuestAccess: settings.allowGuestAccess === null,
  });
}

export async function PATCH(request: NextRequest) {
  const ctx = await requireWorkspaceMember(request, ["owner"]);
  if (ctx instanceof NextResponse) return ctx;
  const limited = rateLimit(request, ctx.user.id, "workspace-mutation");
  if (limited) return limited;
  const body = (await request.json().catch(() => null)) as { name?: unknown; allowGuestAccess?: unknown } | null;
  if (!body || (body.name === undefined && body.allowGuestAccess === undefined)) {
    return NextResponse.json({ error: "Nothing to update", code: "invalid" }, { status: 400 });
  }
  if (body.name !== undefined && typeof body.name !== "string") {
    return NextResponse.json({ error: "Invalid name", code: "invalid_name" }, { status: 400 });
  }
  if (body.allowGuestAccess !== undefined && typeof body.allowGuestAccess !== "boolean") {
    return NextResponse.json({ error: "Invalid value", code: "invalid" }, { status: 400 });
  }
  if (typeof body.name === "string") {
    const renamed = await renameWorkspace(ctx.workspace.id, body.name);
    if (!renamed.ok) return NextResponse.json({ error: renamed.reason, code: renamed.reason }, { status: 400 });
    if (renamed.workspace.name !== ctx.workspace.name) {
      void logUserAction<WorkspaceRenamedMetadata>({
        action: "workspace.rename",
        userId: ctx.user.id,
        resourceType: "workspace",
        resourceId: ctx.workspace.id,
        workspaceId: ctx.workspace.id,
        metadata: { from: ctx.workspace.name, to: renamed.workspace.name },
        request,
      });
    }
  }
  if (typeof body.allowGuestAccess === "boolean") {
    await updateWorkspaceSettings(ctx.workspace.id, { allowGuestAccess: body.allowGuestAccess });
    void logUserAction<WorkspaceSettingsMetadata>({
      action: "workspace.settings_update",
      userId: ctx.user.id,
      resourceType: "workspace",
      resourceId: ctx.workspace.id,
      workspaceId: ctx.workspace.id,
      metadata: { allowGuestAccess: body.allowGuestAccess },
      request,
    });
  }
  return NextResponse.json({ ok: true });
}
