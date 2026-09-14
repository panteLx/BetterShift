/**
 * CRUD for owner-defined permission bundles (Stufe 2 of
 * .LOCAL/calendar-permission-bundles-plan.md, section 7.3). Enforcement
 * itself lives in lib/auth/permissions.ts — this file only manages the
 * bundles a calendar owns.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendars,
  calendarShares,
  calendarAccessTokens,
  calendarPermissionBundles,
  type CalendarPermissionBundle,
} from "@/lib/db/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { hasCapability } from "@/lib/auth/permissions";
import { getSessionUser } from "@/lib/auth/sessions";
import {
  isGuestEligible,
  normalizeCapabilities,
  sanitizeBundle,
  type BundleSeedKey,
  type Capability,
} from "@/lib/permission-bundles";
import deMessages from "@/messages/de.json";
import enMessages from "@/messages/en.json";
import esMessages from "@/messages/es.json";
import frMessages from "@/messages/fr.json";
import itMessages from "@/messages/it.json";
import csMessages from "@/messages/cs.json";

/** Carries an HTTP status alongside the message so routes can map it directly. */
export class PermissionBundleServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "PermissionBundleServiceError";
  }
}

export interface BundleUsage {
  shareCount: number;
  tokenCount: number;
  isGuestBundle: boolean;
}

export type BundleWithUsage = CalendarPermissionBundle & { usage: BundleUsage };

// Every locale's seed labels, used only to keep a custom bundle name from
// colliding (case-insensitively) with a seeded bundle's *displayed* name in
// some other locale than the one the current request happens to be in.
const SEED_LABEL_SOURCES = [
  deMessages,
  enMessages,
  esMessages,
  frMessages,
  itMessages,
  csMessages,
] as const;

function seedLabelsFor(seedKey: BundleSeedKey): string[] {
  return SEED_LABEL_SOURCES.map(
    (messages) => messages.permissionBundles.seed[seedKey]
  );
}

/** Requires manageShares on the calendar; returns the caller's userId or a ready 401/403 response. */
export async function requireManageShares(
  request: NextRequest,
  calendarId: string
): Promise<{ userId: string } | NextResponse> {
  const user = await getSessionUser(request.headers);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasPermission = await hasCapability(user.id, calendarId, "manageShares");
  if (!hasPermission) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }
  return { userId: user.id };
}

/** Maps a PermissionBundleServiceError to its HTTP shape, or falls back to a 500 for anything else. */
export function handleBundleServiceError(
  error: unknown,
  fallbackMessage: string
): NextResponse {
  if (error instanceof PermissionBundleServiceError) {
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: error.status }
    );
  }
  console.error(fallbackMessage, error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

/** Calendar name for audit-log metadata — "Unknown" if the calendar was deleted concurrently. */
export async function getCalendarName(calendarId: string): Promise<string> {
  const calendar = await db.query.calendars.findFirst({
    where: eq(calendars.id, calendarId),
    columns: { name: true },
  });
  return calendar?.name ?? "Unknown";
}

/**
 * Loads a bundle for the calendar and rejects it (400, with the forbidden
 * capabilities listed) if it isn't guest-eligible (E7) — shared by every
 * route about to attach a bundle to a guest/link source
 * (calendars.guestBundleId, calendarAccessTokens.bundleId).
 */
export async function resolveGuestEligibleBundle(
  calendarId: string,
  bundleId: string,
  ineligibleMessage: string
): Promise<CalendarPermissionBundle | NextResponse> {
  const bundle = await getBundleForCalendar(calendarId, bundleId);
  if (!bundle) {
    return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  }
  if (!isGuestEligible(bundle.capabilities)) {
    return NextResponse.json(
      {
        error: ineligibleMessage,
        forbiddenCapabilities: bundle.capabilities.filter(
          (c) => !isGuestEligible([c])
        ),
      },
      { status: 400 }
    );
  }
  return bundle;
}

/** Loads a bundle only if it belongs to the given calendar — closes the cross-calendar gap noted in the plan. */
export async function getBundleForCalendar(
  calendarId: string,
  bundleId: string
): Promise<CalendarPermissionBundle | null> {
  const bundle = await db.query.calendarPermissionBundles.findFirst({
    where: and(
      eq(calendarPermissionBundles.id, bundleId),
      eq(calendarPermissionBundles.calendarId, calendarId)
    ),
  });
  return bundle ? sanitizeBundle(bundle) : null;
}

export async function getBundleUsage(bundleId: string): Promise<BundleUsage> {
  const [[shareRow], [tokenRow], guestCalendar] = await Promise.all([
    db
      .select({ total: count() })
      .from(calendarShares)
      .where(eq(calendarShares.bundleId, bundleId)),
    db
      .select({ total: count() })
      .from(calendarAccessTokens)
      .where(eq(calendarAccessTokens.bundleId, bundleId)),
    db.query.calendars.findFirst({
      where: eq(calendars.guestBundleId, bundleId),
      columns: { id: true },
    }),
  ]);
  return {
    shareCount: shareRow.total,
    tokenCount: tokenRow.total,
    isGuestBundle: !!guestCalendar,
  };
}

/** listPermissionBundles() from lib/auth/permissions.ts, with usage attached in one query (no N+1). */
export async function listBundlesWithUsage(
  calendarId: string
): Promise<BundleWithUsage[]> {
  const rows = await db
    .select({
      id: calendarPermissionBundles.id,
      calendarId: calendarPermissionBundles.calendarId,
      name: calendarPermissionBundles.name,
      seedKey: calendarPermissionBundles.seedKey,
      capabilities: calendarPermissionBundles.capabilities,
      createdAt: calendarPermissionBundles.createdAt,
      updatedAt: calendarPermissionBundles.updatedAt,
      // Correlated column must be qualified as a literal — a tagged-template
      // reference here renders unqualified and SQLite resolves it against the
      // subquery's own table instead of the correlated outer bundle row.
      shareCount: sql<number>`(select count(*) from ${calendarShares} where ${calendarShares.bundleId} = "calendar_permission_bundles"."id")`,
      tokenCount: sql<number>`(select count(*) from ${calendarAccessTokens} where ${calendarAccessTokens.bundleId} = "calendar_permission_bundles"."id")`,
      guestCount: sql<number>`(select count(*) from ${calendars} where ${calendars.guestBundleId} = "calendar_permission_bundles"."id")`,
    })
    .from(calendarPermissionBundles)
    .where(eq(calendarPermissionBundles.calendarId, calendarId))
    .orderBy(calendarPermissionBundles.createdAt);

  return rows.map(({ shareCount, tokenCount, guestCount, ...bundle }) => ({
    ...sanitizeBundle(bundle),
    usage: {
      shareCount: Number(shareCount),
      tokenCount: Number(tokenCount),
      isGuestBundle: Number(guestCount) > 0,
    },
  }));
}

/**
 * Case-insensitive uniqueness check within a calendar, against every other
 * bundle's literal name AND — for every other seeded bundle — that seedKey's
 * translated label in all six locales (so a German "Lesen" can't be created
 * alongside a seeded "read" bundle just because the request happens to run
 * in English).
 */
export async function isNameTaken(
  calendarId: string,
  name: string,
  excludeBundleId?: string
): Promise<boolean> {
  const target = name.trim().toLowerCase();
  const bundles = await db.query.calendarPermissionBundles.findMany({
    where: eq(calendarPermissionBundles.calendarId, calendarId),
    columns: { id: true, name: true, seedKey: true },
  });
  for (const bundle of bundles) {
    if (bundle.id === excludeBundleId) continue;
    if (bundle.name.trim().toLowerCase() === target) return true;
    if (bundle.seedKey) {
      const labels = seedLabelsFor(bundle.seedKey);
      if (labels.some((label) => label.trim().toLowerCase() === target)) {
        return true;
      }
    }
  }
  return false;
}

function assertValidName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new PermissionBundleServiceError("Name must not be empty", 400);
  }
  return trimmed;
}

/** E7: a bundle reachable by a guest/link source may never hold a guest-ineligible capability. */
function assertGuestEligibleIfNeeded(
  usage: BundleUsage,
  capabilities: Capability[]
): void {
  if (!usage.isGuestBundle && usage.tokenCount === 0) return;
  if (isGuestEligible(capabilities)) return;
  const forbidden = capabilities.filter((c) => !isGuestEligible([c]));
  throw new PermissionBundleServiceError(
    "Bundle is assigned to guest access or a link and cannot hold these capabilities",
    400,
    { forbiddenCapabilities: forbidden }
  );
}

export async function createPermissionBundle(
  calendarId: string,
  input: { name: string; capabilities: unknown }
): Promise<CalendarPermissionBundle> {
  const name = assertValidName(input.name);
  if (await isNameTaken(calendarId, name)) {
    throw new PermissionBundleServiceError(
      "A bundle with this name already exists",
      409
    );
  }
  const capabilities = normalizeCapabilities(input.capabilities);
  const [created] = await db
    .insert(calendarPermissionBundles)
    .values({ calendarId, name, seedKey: null, capabilities })
    .returning();
  return sanitizeBundle(created);
}

export async function updatePermissionBundle(
  calendarId: string,
  bundleId: string,
  input: { name?: string; capabilities?: unknown }
): Promise<CalendarPermissionBundle> {
  const existing = await getBundleForCalendar(calendarId, bundleId);
  if (!existing) {
    throw new PermissionBundleServiceError("Bundle not found", 404);
  }

  const patch: Partial<
    Pick<
      typeof calendarPermissionBundles.$inferInsert,
      "name" | "seedKey" | "capabilities"
    >
  > = {};

  if (input.name !== undefined) {
    const name = assertValidName(input.name);
    if (name !== existing.name) {
      if (await isNameTaken(calendarId, name, bundleId)) {
        throw new PermissionBundleServiceError(
          "A bundle with this name already exists",
          409
        );
      }
      patch.name = name;
      // 4.2: renaming a seeded bundle detaches it from the translated display name.
      patch.seedKey = null;
    }
  }

  if (input.capabilities !== undefined) {
    const capabilities = normalizeCapabilities(input.capabilities);
    const usage = await getBundleUsage(bundleId);
    assertGuestEligibleIfNeeded(usage, capabilities);
    patch.capabilities = capabilities;
  }

  if (Object.keys(patch).length === 0) {
    return existing;
  }

  const [updated] = await db
    .update(calendarPermissionBundles)
    .set(patch)
    .where(eq(calendarPermissionBundles.id, bundleId))
    .returning();
  return sanitizeBundle(updated);
}

export async function clonePermissionBundle(
  calendarId: string,
  bundleId: string,
  name: string
): Promise<CalendarPermissionBundle> {
  const source = await getBundleForCalendar(calendarId, bundleId);
  if (!source) {
    throw new PermissionBundleServiceError("Bundle not found", 404);
  }
  const trimmedName = assertValidName(name);
  if (await isNameTaken(calendarId, trimmedName)) {
    throw new PermissionBundleServiceError(
      "A bundle with this name already exists",
      409
    );
  }
  const [created] = await db
    .insert(calendarPermissionBundles)
    .values({
      calendarId,
      name: trimmedName,
      seedKey: null,
      capabilities: source.capabilities,
    })
    .returning();
  return sanitizeBundle(created);
}

export async function deletePermissionBundle(
  calendarId: string,
  bundleId: string
): Promise<void> {
  const existing = await getBundleForCalendar(calendarId, bundleId);
  if (!existing) {
    throw new PermissionBundleServiceError("Bundle not found", 404);
  }
  const usage = await getBundleUsage(bundleId);
  if (usage.shareCount > 0 || usage.tokenCount > 0 || usage.isGuestBundle) {
    throw new PermissionBundleServiceError(
      "Bundle is still in use and cannot be deleted",
      409,
      { usage }
    );
  }
  // Synchronous callback — better-sqlite3 transactions must not return a
  // promise (see seedPermissionBundles() in lib/auth/permissions.ts and the
  // Stufe 1b gotcha in commit b7fb903). Re-check usage inside the
  // transaction to close the race between the check above and the delete.
  db.transaction((tx) => {
    const stillUsed =
      tx
        .select({ total: count() })
        .from(calendarShares)
        .where(eq(calendarShares.bundleId, bundleId))
        .get()!.total > 0 ||
      tx
        .select({ total: count() })
        .from(calendarAccessTokens)
        .where(eq(calendarAccessTokens.bundleId, bundleId))
        .get()!.total > 0 ||
      !!tx
        .select({ id: calendars.id })
        .from(calendars)
        .where(eq(calendars.guestBundleId, bundleId))
        .get();
    if (stillUsed) {
      throw new PermissionBundleServiceError(
        "Bundle is still in use and cannot be deleted",
        409
      );
    }
    tx.delete(calendarPermissionBundles).where(
      eq(calendarPermissionBundles.id, bundleId)
    ).run();
  });
}
