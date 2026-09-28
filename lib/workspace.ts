import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, member } from "@/lib/db/schema";
import { AUTH_ENABLED, MULTI_TENANT, TENANT_BASE_DOMAIN } from "@/lib/auth/env";

export const DEFAULT_WORKSPACE_ID = "default";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export type HostParseResult =
  | { kind: "apex" }
  | { kind: "workspace"; slug: string }
  | { kind: "invalid" };

/**
 * Pure host → {apex, workspace slug, invalid} classification. No DB access,
 * so it's directly unit-checkable by scripts/tenant-isolation-check.ts
 * without a running server. Strips the port, lowercases, and requires
 * exactly one label left after stripping the base domain.
 */
export function parseWorkspaceHost(
  hostHeader: string | null,
  baseDomain: string
): HostParseResult {
  if (!hostHeader || !baseDomain) return { kind: "invalid" };
  const host = hostHeader.split(":")[0].toLowerCase();
  const base = baseDomain.toLowerCase();
  if (host === base) return { kind: "apex" };
  if (!host.endsWith(`.${base}`)) return { kind: "invalid" };
  const slug = host.slice(0, -(base.length + 1));
  if (slug.length === 0 || slug.includes(".")) return { kind: "invalid" };
  return { kind: "workspace", slug };
}

export type WorkspaceResolution =
  | { kind: "workspace"; workspace: Workspace }
  | { kind: "apex" }
  | { kind: "unknown" };

interface CacheEntry {
  value: Workspace | null;
  expiresAt: number;
}

const HIT_TTL_MS = 30_000;
const MISS_TTL_MS = 5_000;
const slugCache = new Map<string, CacheEntry>();

async function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  const cached = slugCache.get(slug);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const row = await db.query.organization.findFirst({
    where: eq(organization.slug, slug),
    columns: { id: true, name: true, slug: true },
  });
  const value = row ?? null;
  slugCache.set(slug, {
    value,
    expiresAt: Date.now() + (value ? HIT_TTL_MS : MISS_TTL_MS),
  });
  return value;
}

/** Call after any change that could make a cached slug stale (e.g. a workspace is deleted). */
export function invalidateWorkspaceCache(slug: string): void {
  slugCache.delete(slug);
}

/**
 * MULTI_TENANT=true requires AUTH_ENABLED=true and a non-empty
 * TENANT_BASE_DOMAIN. Never throws — instrumentation.ts logs this as a
 * startup warning, and proxy.ts treats a non-null result like an unhealthy
 * database (redirect everything to /system-unavailable), because failing
 * open here would let the AUTH_ENABLED=false "everyone is owner" path leak
 * across workspaces.
 */
export function getTenancyConfigError(): string | null {
  if (!MULTI_TENANT) return null;
  if (!AUTH_ENABLED) return "MULTI_TENANT=true requires AUTH_ENABLED=true";
  if (!TENANT_BASE_DOMAIN)
    return "MULTI_TENANT=true requires TENANT_BASE_DOMAIN to be set";
  return null;
}

/**
 * Resolves the workspace for a given Host header value. With MULTI_TENANT
 * off, or when tenancy is misconfigured, this always fails closed to
 * "unknown" except the single-tenant default-workspace lookup.
 */
export async function resolveWorkspaceFromHost(
  hostHeader: string | null
): Promise<WorkspaceResolution> {
  if (!MULTI_TENANT) {
    const workspace = await getWorkspaceBySlug(DEFAULT_WORKSPACE_ID);
    return workspace ? { kind: "workspace", workspace } : { kind: "unknown" };
  }
  if (getTenancyConfigError()) return { kind: "unknown" };

  const parsed = parseWorkspaceHost(hostHeader, TENANT_BASE_DOMAIN);
  if (parsed.kind === "apex") return { kind: "apex" };
  if (parsed.kind === "invalid") return { kind: "unknown" };

  const workspace = await getWorkspaceBySlug(parsed.slug);
  return workspace ? { kind: "workspace", workspace } : { kind: "unknown" };
}

/**
 * Request-scoped workspace lookup via next/headers (Next 16: headers() is
 * async). Throws when called outside a request (no headers() context) — a
 * background caller that forgets to pass a workspace explicitly must fail
 * loudly, not silently see every workspace. Route handlers holding a
 * `request` may call resolveWorkspaceFromHost(request.headers.get("host"))
 * directly instead.
 */
export async function getRequestWorkspace(): Promise<Workspace | null> {
  const headersList = await headers();
  const result = await resolveWorkspaceFromHost(headersList.get("host"));
  return result.kind === "workspace" ? result.workspace : null;
}

export class WorkspaceNotFoundError extends Error {
  constructor() {
    super("Workspace not found for this request");
    this.name = "WorkspaceNotFoundError";
  }
}

export async function requireRequestWorkspace(): Promise<Workspace> {
  const workspace = await getRequestWorkspace();
  if (!workspace) throw new WorkspaceNotFoundError();
  return workspace;
}

/**
 * Single-tenant instances have exactly one workspace, so membership always
 * holds even if a fire-and-forget membership insert (handleSingleTenantMembership)
 * failed — a missing `member` row must not hide an otherwise valid user.
 */
export async function isWorkspaceMember(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  if (!MULTI_TENANT) return true;

  const row = await db.query.member.findFirst({
    where: and(eq(member.userId, userId), eq(member.organizationId, workspaceId)),
    columns: { id: true },
  });
  return !!row;
}

export async function getWorkspaceRole(
  userId: string,
  workspaceId: string
): Promise<string | null> {
  const row = await db.query.member.findFirst({
    where: and(eq(member.userId, userId), eq(member.organizationId, workspaceId)),
    columns: { role: true },
  });
  return row?.role ?? null;
}
