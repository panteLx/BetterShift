import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { ALLOW_GUEST_ACCESS } from "@/lib/auth/env";

const SETTINGS_ID = "default";

export type UpdateBannerVisibility = "all" | "admins";

export interface SystemSettings {
  updateCheckEnabled: boolean;
  updateBannerVisibility: UpdateBannerVisibility;
  allowGuestAccess: boolean;
}

// The DB row doesn't exist until the first admin write, so this fallback has
// to mirror ALLOW_GUEST_ACCESS -- otherwise every self-hosted instance would
// silently lose guest access on upgrade until an admin re-enables it here.
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  updateCheckEnabled: true,
  updateBannerVisibility: "all",
  allowGuestAccess: ALLOW_GUEST_ACCESS,
};

// Settings are read on every /api/version request; a short cache avoids a DB
// round trip per request while still picking up admin changes within ~10s.
let cachedSettings: SystemSettings | null = null;
let cachedSettingsExpiresAt = 0;
const CACHE_DURATION = 10 * 1000; // 10 seconds

/** Reads the singleton settings row, falling back to defaults before it is ever written. */
export async function getSystemSettings(): Promise<SystemSettings> {
  if (cachedSettings && Date.now() < cachedSettingsExpiresAt) {
    return cachedSettings;
  }

  const [row] = await db
    .select({
      updateCheckEnabled: systemSettings.updateCheckEnabled,
      updateBannerVisibility: systemSettings.updateBannerVisibility,
      allowGuestAccess: systemSettings.allowGuestAccess,
    })
    .from(systemSettings)
    .where(eq(systemSettings.id, SETTINGS_ID))
    .limit(1);

  cachedSettings = row ?? DEFAULT_SYSTEM_SETTINGS;
  cachedSettingsExpiresAt = Date.now() + CACHE_DURATION;
  return cachedSettings;
}

/** Merges a partial patch into the singleton row, creating it on first write. */
export async function updateSystemSettings(
  patch: Partial<SystemSettings>
): Promise<{ before: SystemSettings; after: SystemSettings }> {
  const before = await getSystemSettings();
  const after = { ...before, ...patch };

  await db
    .insert(systemSettings)
    .values({ id: SETTINGS_ID, ...after })
    .onConflictDoUpdate({
      target: systemSettings.id,
      set: { ...after, updatedAt: new Date() },
    });

  cachedSettings = after;
  cachedSettingsExpiresAt = Date.now() + CACHE_DURATION;

  return { before, after };
}
