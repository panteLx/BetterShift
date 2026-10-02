import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workspaceSettings, type WorkspaceSettings } from "@/lib/db/schema";
import { getSystemSettings } from "@/lib/system-settings";

export type { WorkspaceSettings };

// Same short cache as lib/system-settings.ts: allowGuestAccess() runs on
// most anonymous requests (proxy guest gate, permission checks).
const CACHE_DURATION = 10 * 1000; // 10 seconds
const cache = new Map<string, { value: WorkspaceSettings; expiresAt: number }>();

function defaultSettings(workspaceId: string): WorkspaceSettings {
  return { workspaceId, allowGuestAccess: null, updatedAt: new Date(0) };
}

/** Reads a workspace's settings row, falling back to defaults before it is ever written. */
export async function getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings> {
  const cached = cache.get(workspaceId);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const [row] = await db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId))
    .limit(1);

  const value = row ?? defaultSettings(workspaceId);
  cache.set(workspaceId, { value, expiresAt: Date.now() + CACHE_DURATION });
  return value;
}

/** Merges a partial patch into the workspace's row, creating it on first write. */
export async function updateWorkspaceSettings(
  workspaceId: string,
  patch: Partial<Pick<WorkspaceSettings, "allowGuestAccess">>
): Promise<{ before: WorkspaceSettings; after: WorkspaceSettings }> {
  const before = await getWorkspaceSettings(workspaceId);
  const after: WorkspaceSettings = { ...before, ...patch, workspaceId, updatedAt: new Date() };

  await db
    .insert(workspaceSettings)
    .values(after)
    .onConflictDoUpdate({
      target: workspaceSettings.workspaceId,
      set: { allowGuestAccess: after.allowGuestAccess, updatedAt: after.updatedAt },
    });

  cache.set(workspaceId, { value: after, expiresAt: Date.now() + CACHE_DURATION });
  return { before, after };
}

/** A workspace without its own value follows the instance default from the system settings. */
export async function effectiveAllowGuestAccess(settings: WorkspaceSettings): Promise<boolean> {
  return settings.allowGuestAccess ?? (await getSystemSettings()).allowGuestAccess;
}
