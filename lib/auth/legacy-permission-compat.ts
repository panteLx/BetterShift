/**
 * Temporary compatibility bridge between the old read/write/admin enum and
 * the new capability-bundle system (lib/permission-bundles.ts).
 *
 * The bundle system is now the real source of truth for enforcement
 * (hasCapability in lib/auth/permissions.ts), but the owner-facing sharing
 * UI and the admin panel still speak the old three-value enum — building the
 * actual Bundle editor (owner ticks capabilities, assigns a 4th "Manage"
 * option, renames/clones bundles) is deliberately a separate follow-up.
 * Until that ships, every calendar always has exactly one bundle named
 * "Read", "Contribute", "Manage" and "Admin" (seeded at creation/migration
 * time — see lib/permission-bundles.ts), so old enum values can be resolved
 * to "that calendar's like-named bundle" and back. This lookup-by-name is
 * intentionally fragile — it breaks if a bundle is renamed — which is fine
 * only because nothing can rename a bundle yet. Delete this file once the
 * real Bundle editor ships and the UI starts sending bundle ids directly.
 */
import { db } from "@/lib/db";
import { calendarPermissionBundles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { sanitizeCapabilities, type Capability } from "@/lib/permission-bundles";

export type LegacyShareLevel = "read" | "write" | "admin";
export type LegacyGuestLevel = "none" | "read" | "write";

const WRITE_CAPABILITIES: readonly Capability[] = [
  "stampPreset",
  "createShift",
  "editShift",
  "deleteShift",
  "manageNotesEvents",
  "managePresets",
  "manageExternalSync",
  "deleteSyncLogs",
];

const ADMIN_CAPABILITIES: readonly Capability[] = [
  "manageShares",
  "manageGuestAccess",
  "manageCalendarSettings",
];

/** Collapses a capability set down to the closest old enum value, for display only. */
export function coarseLevelFromCapabilities(
  capabilities: readonly Capability[]
): LegacyShareLevel {
  if (ADMIN_CAPABILITIES.some((c) => capabilities.includes(c))) return "admin";
  if (WRITE_CAPABILITIES.some((c) => capabilities.includes(c))) return "write";
  return "read";
}

const SEED_NAME_FOR_LEVEL: Record<LegacyShareLevel, string> = {
  read: "Read",
  write: "Contribute",
  admin: "Admin",
};

/** Finds this calendar's seeded bundle matching an old enum value. */
export async function findSeededBundleId(
  calendarId: string,
  level: LegacyShareLevel
): Promise<string | null> {
  const bundle = await db.query.calendarPermissionBundles.findFirst({
    where: and(
      eq(calendarPermissionBundles.calendarId, calendarId),
      eq(calendarPermissionBundles.name, SEED_NAME_FOR_LEVEL[level])
    ),
    columns: { id: true },
  });
  return bundle?.id ?? null;
}

/** Same lookup for the guest/token surface, where "none" means "no bundle". */
export async function findSeededGuestBundleId(
  calendarId: string,
  level: LegacyGuestLevel
): Promise<string | null> {
  if (level === "none") return null;
  return findSeededBundleId(calendarId, level);
}

/**
 * Toggles one capability on a bundle in place, returning whether it actually
 * changed anything. Only used by the allowSelfSignup compat toggle
 * (calendar-wide "Read" bundle) — real bundle editing belongs to the
 * not-yet-built Bundle editor, not this shim.
 */
export async function setBundleCapability(
  bundleId: string,
  capability: Capability,
  enabled: boolean
): Promise<boolean> {
  const bundle = await db.query.calendarPermissionBundles.findFirst({
    where: eq(calendarPermissionBundles.id, bundleId),
    columns: { capabilities: true },
  });
  if (!bundle) return false;
  const current = sanitizeCapabilities(bundle.capabilities);
  if (current.includes(capability) === enabled) return false;
  const next = enabled
    ? [...current, capability]
    : current.filter((c) => c !== capability);
  await db
    .update(calendarPermissionBundles)
    .set({ capabilities: next })
    .where(eq(calendarPermissionBundles.id, bundleId));
  return true;
}

/** Coarse guest level for a calendar, given its current guestBundleId column. */
export async function getCoarseGuestLevel(
  guestBundleId: string | null
): Promise<LegacyGuestLevel> {
  if (!guestBundleId) return "none";
  const bundle = await db.query.calendarPermissionBundles.findFirst({
    where: eq(calendarPermissionBundles.id, guestBundleId),
    columns: { capabilities: true },
  });
  if (!bundle) return "none";
  const level = coarseLevelFromCapabilities(
    sanitizeCapabilities(bundle.capabilities)
  );
  // A guest bundle can never actually collapse to "admin" — the ceiling in
  // hasCapability() refuses admin-only capabilities for guest/token sources
  // — but the type doesn't know that, so fall back defensively.
  return level === "admin" ? "write" : level;
}
