import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema";
import { MULTI_TENANT } from "@/lib/auth/env";
import { canDeleteWorkspaces, canManageWorkspaces } from "@/lib/auth/admin";
import { getValidatedAdminUser, isErrorResponse } from "@/lib/auth/admin-helpers";
import { rateLimit } from "@/lib/rate-limiter";
import { logAdminAction, type WorkspaceDeletedMetadata, type WorkspaceRenamedMetadata, type WorkspaceSlugChangedMetadata } from "@/lib/audit-log";
import { changeDefaultWorkspaceSlug, deleteWorkspace, renameWorkspace } from "@/lib/workspace-admin";
import { DEFAULT_WORKSPACE_ID } from "@/lib/workspace";
import { busyResponse } from "@/lib/workspace-access";

type Params = { params: Promise<{ id: string }> };

async function guard(request: NextRequest, destructive: boolean) {
  if (!MULTI_TENANT) return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  const admin = await getValidatedAdminUser(request);
  if (isErrorResponse(admin)) return admin;
  const allowed = destructive ? canDeleteWorkspaces(admin) : canManageWorkspaces(admin);
  if (!allowed) return NextResponse.json({ error: "Admin access required", code: "forbidden" }, { status: 403 });
  const limited = rateLimit(request, admin.id, destructive ? "workspace-delete" : "admin-user-mutations");
  if (limited) return limited;
  return { admin };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = await guard(request, false);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { name?: unknown; slug?: unknown } | null;
  const hasName = body?.name !== undefined;
  const hasSlug = body?.slug !== undefined;
  if ((!hasName && !hasSlug) || (hasName && typeof body?.name !== "string")) {
    return NextResponse.json({ error: "Invalid name", code: "invalid_name" }, { status: 400 });
  }
  if (hasSlug && id !== DEFAULT_WORKSPACE_ID) {
    return NextResponse.json({ error: "Slug is immutable", code: "slug_immutable" }, { status: 400 });
  }
  if (hasSlug && typeof body?.slug !== "string") {
    return NextResponse.json({ error: "Invalid slug", code: "invalid" }, { status: 400 });
  }
  const before = await db.query.organization.findFirst({ where: eq(organization.id, id), columns: { name: true } });
  if (!before) return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });

  let name = before.name;
  if (hasName) {
    const renamed = await renameWorkspace(id, body!.name as string);
    if (!renamed.ok) {
      return NextResponse.json({ error: renamed.reason, code: renamed.reason }, { status: renamed.reason === "not_found" ? 404 : 400 });
    }
    name = renamed.workspace.name;
    if (name !== before.name) {
      void logAdminAction<WorkspaceRenamedMetadata>({
        action: "workspace.rename",
        userId: ctx.admin.id,
        resourceType: "workspace",
        resourceId: id,
        workspaceId: id,
        metadata: { from: before.name, to: name },
        request,
      });
    }
  }

  let slug: string | undefined;
  if (hasSlug) {
    const changed = await changeDefaultWorkspaceSlug((body!.slug as string).trim().toLowerCase());
    if (!changed.ok) {
      const status = changed.reason === "taken" ? 409 : changed.reason === "not_found" ? 404 : 400;
      return NextResponse.json({ error: changed.reason, code: changed.reason }, { status });
    }
    slug = changed.to;
    if (changed.changed) {
      void logAdminAction<WorkspaceSlugChangedMetadata>({
        action: "workspace.slug_change",
        userId: ctx.admin.id,
        resourceType: "workspace",
        resourceId: id,
        workspaceId: id,
        metadata: { from: changed.from, to: changed.to },
        request,
      });
    }
  }
  return NextResponse.json({ ok: true, name, ...(slug ? { slug } : {}) });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const ctx = await guard(request, true);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { confirmSlug?: unknown } | null;
  const workspace = await db.query.organization.findFirst({ where: eq(organization.id, id), columns: { slug: true } });
  if (!workspace) return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  if (body?.confirmSlug !== workspace.slug) {
    return NextResponse.json({ error: "Confirmation does not match", code: "confirmation_mismatch" }, { status: 400 });
  }
  let result;
  try {
    result = await deleteWorkspace(id);
  } catch (error) {
    return busyResponse(error);
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.reason, code: result.reason }, { status: result.reason === "default" ? 409 : 404 });
  }
  // workspaceId null keeps the entry: the workspace's own audit rows are deleted with it.
  void logAdminAction<WorkspaceDeletedMetadata>({
    action: "workspace.delete",
    userId: ctx.admin.id,
    resourceType: "workspace",
    resourceId: id,
    workspaceId: null,
    metadata: {
      slug: result.workspace.slug,
      name: result.workspace.name,
      members: result.counts.members,
      calendars: result.counts.calendars,
      byInstanceAdmin: true,
    },
    request,
  });
  return NextResponse.json({ ok: true });
}
