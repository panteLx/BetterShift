import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { member, organization } from "@/lib/db/schema";
import { TENANT_MAX_WORKSPACES_PER_USER } from "@/lib/auth/env";
import { invalidateWorkspaceCache, type Workspace } from "@/lib/workspace";
import { isReservedSlug, isValidSlugFormat } from "@/lib/workspace-slugs";

export interface MyWorkspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export async function listMyWorkspaces(userId: string): Promise<MyWorkspace[]> {
  return db
    .select({ id: organization.id, name: organization.name, slug: organization.slug, role: member.role })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(asc(member.createdAt));
}

export async function countOwnedWorkspaces(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.role, "owner")));
  return row?.n ?? 0;
}

export type SlugAvailability = "available" | "taken" | "reserved" | "invalid";

export async function checkSlugAvailability(slug: string): Promise<SlugAvailability> {
  if (!isValidSlugFormat(slug)) return "invalid";
  if (isReservedSlug(slug)) return "reserved";
  const row = await db.query.organization.findFirst({
    where: eq(organization.slug, slug),
    columns: { id: true },
  });
  return row ? "taken" : "available";
}

export type CreateWorkspaceResult =
  | { ok: true; workspace: Workspace }
  | { ok: false; reason: "invalid_name" | "invalid" | "reserved" | "taken" | "limit" };

export const WORKSPACE_NAME_MAX_LENGTH = 64;

export function createWorkspace(
  userId: string,
  input: { name: string; slug: string },
  opts: { exemptFromLimit: boolean }
): CreateWorkspaceResult {
  const name = input.name.trim();
  const slug = input.slug;
  if (!name || name.length > WORKSPACE_NAME_MAX_LENGTH) return { ok: false, reason: "invalid_name" };
  if (!isValidSlugFormat(slug)) return { ok: false, reason: "invalid" };
  if (isReservedSlug(slug)) return { ok: false, reason: "reserved" };

  let result: CreateWorkspaceResult;
  try {
    result = db.transaction((tx) => {
      if (!opts.exemptFromLimit) {
        const [owned] = tx
          .select({ n: count() })
          .from(member)
          .where(and(eq(member.userId, userId), eq(member.role, "owner")))
          .all();
        if ((owned?.n ?? 0) >= TENANT_MAX_WORKSPACES_PER_USER) return { ok: false, reason: "limit" } as const;
      }
      const existing = tx.select({ id: organization.id }).from(organization).where(eq(organization.slug, slug)).get();
      if (existing) return { ok: false, reason: "taken" } as const;

      const id = crypto.randomUUID();
      tx.insert(organization).values({ id, name, slug }).run();
      tx.insert(member).values({ id: crypto.randomUUID(), organizationId: id, userId, role: "owner" }).run();
      return { ok: true, workspace: { id, name, slug } } as const;
    });
  } catch (error) {
    // The unique index on organization.slug is the real guard against a concurrent create.
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed: organization.slug")) {
      return { ok: false, reason: "taken" };
    }
    throw error;
  }
  if (result.ok) invalidateWorkspaceCache(slug);
  return result;
}

export async function myWorkspacesPayload(userId: string) {
  const [workspaces, ownedCount] = await Promise.all([listMyWorkspaces(userId), countOwnedWorkspaces(userId)]);
  return { workspaces, ownedCount, maxOwned: TENANT_MAX_WORKSPACES_PER_USER };
}
