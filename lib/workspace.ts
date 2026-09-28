import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organization, member } from "@/lib/db/schema";
import {
  AUTH_ENABLED,
  BETTER_AUTH_URL,
  MULTI_TENANT,
  TENANT_BASE_DOMAIN,
} from "@/lib/auth/env";

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

// Pure (no DB) so the isolation harness can check it without a server.
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
// ":" never appears in a valid slug, so this key can't collide with one.
const DEFAULT_CACHE_KEY = "id:default";

async function cachedWorkspace(
  key: string,
  where: ReturnType<typeof eq>
): Promise<Workspace | null> {
  const cached = slugCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const row = await db.query.organization.findFirst({
    where,
    columns: { id: true, name: true, slug: true },
  });
  const value = row ?? null;
  slugCache.set(key, {
    value,
    expiresAt: Date.now() + (value ? HIT_TTL_MS : MISS_TTL_MS),
  });
  return value;
}

function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  return cachedWorkspace(slug, eq(organization.slug, slug));
}

/** Call after any change that could make a cached slug stale (e.g. a workspace is deleted). */
export function invalidateWorkspaceCache(slug: string): void {
  slugCache.delete(slug);
}

// Never throws: proxy.ts fails closed on a non-null result instead of serving without isolation.
export function getTenancyConfigError(): string | null {
  if (!MULTI_TENANT) return null;
  if (!AUTH_ENABLED) return "MULTI_TENANT=true requires AUTH_ENABLED=true";
  if (!TENANT_BASE_DOMAIN)
    return "MULTI_TENANT=true requires TENANT_BASE_DOMAIN to be set";
  if (!URL.canParse(BETTER_AUTH_URL))
    return "MULTI_TENANT=true requires BETTER_AUTH_URL to be a valid URL";
  return null;
}

export async function resolveWorkspaceFromHost(
  hostHeader: string | null
): Promise<WorkspaceResolution> {
  if (!MULTI_TENANT) {
    // By id, not slug, so a renamed default workspace can't take the instance down.
    const workspace = await cachedWorkspace(
      DEFAULT_CACHE_KEY,
      eq(organization.id, DEFAULT_WORKSPACE_ID)
    );
    return workspace ? { kind: "workspace", workspace } : { kind: "unknown" };
  }
  if (getTenancyConfigError()) return { kind: "unknown" };

  const parsed = parseWorkspaceHost(hostHeader, TENANT_BASE_DOMAIN);
  if (parsed.kind === "apex") return { kind: "apex" };
  if (parsed.kind === "invalid") return { kind: "unknown" };

  const workspace = await getWorkspaceBySlug(parsed.slug);
  return workspace ? { kind: "workspace", workspace } : { kind: "unknown" };
}

// Throws outside a request on purpose: background callers must pass a workspace explicitly.
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

// Single-tenant: always true, since the fire-and-forget default membership insert may have failed.
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
