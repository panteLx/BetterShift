/**
 * Capability catalog for calendar permission bundles.
 *
 * Replaces the old fixed read/write/admin ladder: an owner defines what a
 * named bundle means per calendar by ticking capabilities, instead of the
 * app hard-coding what "write" bundles together. See docs/PERMISSIONS.md
 * for the full design.
 */

export const CAPABILITIES = [
  // View
  "viewShifts",
  "viewNotesEvents",
  "viewStats",
  "viewMembers",
  // Shifts
  "stampPreset",
  "createShift",
  "editOwnShift",
  "editAnyShift",
  "deleteOwnShift",
  "deleteAnyShift",
  // Notes & events
  "manageOwnNotesEvents",
  "manageAnyNotesEvents",
  // Signups
  "signUpSelf",
  "signUpOthers",
  // Presets
  "createPreset",
  "manageOwnPresets",
  "manageAnyPresets",
  // External sync
  "manageExternalSync",
  "deleteSyncLogs",
  // Administrative — never assignable to a guest/link source, see isGuestEligible()
  "manageShares",
  "manageGuestAccess",
  "manageCalendarSettings",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export type CapabilityGroupKey =
  | "view"
  | "shifts"
  | "notesEvents"
  | "signups"
  | "presets"
  | "externalSync"
  | "administration";

/** Groups CAPABILITIES for display (Bundle editor, 5.1) — order matches the catalog above. */
export const CAPABILITY_GROUPS: ReadonlyArray<{
  key: CapabilityGroupKey;
  capabilities: readonly Capability[];
}> = [
  { key: "view", capabilities: ["viewShifts", "viewNotesEvents", "viewStats", "viewMembers"] },
  {
    key: "shifts",
    capabilities: [
      "stampPreset",
      "createShift",
      "editOwnShift",
      "editAnyShift",
      "deleteOwnShift",
      "deleteAnyShift",
    ],
  },
  { key: "notesEvents", capabilities: ["manageOwnNotesEvents", "manageAnyNotesEvents"] },
  { key: "signups", capabilities: ["signUpSelf", "signUpOthers"] },
  { key: "presets", capabilities: ["createPreset", "manageOwnPresets", "manageAnyPresets"] },
  { key: "externalSync", capabilities: ["manageExternalSync", "deleteSyncLogs"] },
  {
    key: "administration",
    capabilities: ["manageShares", "manageGuestAccess", "manageCalendarSettings"],
  },
];

const CAPABILITY_SET: ReadonlySet<string> = new Set(CAPABILITIES);

/**
 * Capabilities a bundle may never hold if it's reachable by a guest/link
 * source (access token, or calendars.guestBundleId) — enforced both when
 * offering bundles for assignment and again in hasCapability() itself.
 * manageExternalSync/deleteSyncLogs joined this set alongside the three
 * original administrative capabilities: external sync touches credentials
 * and URLs, which is a deliberate behavior change for pre-existing
 * guest/link access at the "write" level (see the Stufe-1b data migration).
 */
const GUEST_INELIGIBLE: ReadonlySet<Capability> = new Set([
  "manageShares",
  "manageGuestAccess",
  "manageCalendarSettings",
  "manageExternalSync",
  "deleteSyncLogs",
]);

export function isGuestEligible(capabilities: readonly Capability[]): boolean {
  return capabilities.every((c) => !GUEST_INELIGIBLE.has(c));
}

export function isAdminOnlyCapability(capability: Capability): boolean {
  return GUEST_INELIGIBLE.has(capability);
}

/** Whitelists a JSON value down to known capability keys, deduped. Unknown/malformed input yields []. */
export function sanitizeCapabilities(input: unknown): Capability[] {
  if (!Array.isArray(input)) return [];
  const result = new Set<Capability>();
  for (const value of input) {
    if (typeof value === "string" && CAPABILITY_SET.has(value)) {
      result.add(value as Capability);
    }
  }
  return Array.from(result);
}

/** Applies sanitizeCapabilities() to a bundle row read straight from the DB. */
export function sanitizeBundle<T extends { capabilities: unknown }>(
  bundle: T
): T & { capabilities: Capability[] } {
  return { ...bundle, capabilities: sanitizeCapabilities(bundle.capabilities) };
}

/**
 * Capability dependencies (S3 — enforced server-side, the UI just reflects
 * them by ticking the dependency visibly). Applied to a fixed point by
 * normalizeCapabilities() below, so listing a capability once here is
 * enough even if the dependency chain is more than one hop.
 */
const CAPABILITY_DEPENDENCIES: Partial<Record<Capability, Capability[]>> = {
  stampPreset: ["viewShifts"],
  createShift: ["viewShifts"],
  editOwnShift: ["viewShifts"],
  editAnyShift: ["editOwnShift"],
  deleteOwnShift: ["viewShifts"],
  deleteAnyShift: ["deleteOwnShift"],
  manageOwnNotesEvents: ["viewNotesEvents"],
  manageAnyNotesEvents: ["manageOwnNotesEvents"],
  signUpSelf: ["viewShifts"],
  signUpOthers: ["viewMembers", "viewShifts"],
  createPreset: ["viewShifts"],
  manageOwnPresets: ["viewShifts"],
  manageAnyPresets: ["manageOwnPresets"],
  manageExternalSync: ["viewShifts"],
};

/**
 * Sanitizes a raw capability list and expands it to satisfy every
 * dependency in CAPABILITY_DEPENDENCIES (S3). Use this instead of
 * sanitizeCapabilities() whenever a bundle's capabilities are being saved;
 * use plain sanitizeCapabilities() for read-only display where dependencies
 * are already guaranteed to hold.
 */
export function normalizeCapabilities(input: unknown): Capability[] {
  const result = new Set<Capability>(sanitizeCapabilities(input));
  let changed = true;
  while (changed) {
    changed = false;
    for (const capability of result) {
      for (const dependency of CAPABILITY_DEPENDENCIES[capability] ?? []) {
        if (!result.has(dependency)) {
          result.add(dependency);
          changed = true;
        }
      }
    }
  }
  return CAPABILITIES.filter((c) => result.has(c));
}

export type BundleSeedKey = "read" | "contribute" | "manage" | "admin";

export interface BundleDefinition {
  name: string;
  seedKey: BundleSeedKey;
  capabilities: Capability[];
}

const READ_BASE: Capability[] = [
  "viewShifts",
  "viewNotesEvents",
  "viewStats",
  // E5: new calendars' Read bundle grants self-signup out of the box,
  // matching the old default of allowSelfSignup = true.
  "signUpSelf",
];
const CONTRIBUTE_BASE: Capability[] = [
  ...READ_BASE,
  "stampPreset",
  "createShift",
  "createPreset",
  "editOwnShift",
  "deleteOwnShift",
  "manageOwnPresets",
  "manageOwnNotesEvents",
];
const MANAGE_BASE: Capability[] = [
  ...CONTRIBUTE_BASE,
  "editAnyShift",
  "deleteAnyShift",
  "manageAnyPresets",
  "manageAnyNotesEvents",
  "signUpOthers",
  "viewMembers",
];
const ADMIN_BASE: Capability[] = [
  ...MANAGE_BASE,
  "manageExternalSync",
  "deleteSyncLogs",
  "manageShares",
  "manageGuestAccess",
  "manageCalendarSettings",
];

/**
 * Recommended defaults for a newly created calendar (5.4): creating shifts
 * and presets stays available at Contribute, editing/deleting someone
 * else's entry requires Manage, and external sync config/sync-log deletion
 * require Admin (touches external credentials/URLs).
 */
export function defaultBundleDefinitionsForNewCalendar(): BundleDefinition[] {
  return [
    { name: "Read", seedKey: "read", capabilities: [...READ_BASE] },
    {
      name: "Contribute",
      seedKey: "contribute",
      capabilities: [...CONTRIBUTE_BASE],
    },
    { name: "Manage", seedKey: "manage", capabilities: [...MANAGE_BASE] },
    { name: "Admin", seedKey: "admin", capabilities: [...ADMIN_BASE] },
  ];
}

// Existing-calendar migration bundles are hand-written directly into
// drizzle/0020_backfill_permission_bundles.sql (a frozen, one-time SQL
// snapshot of an earlier version of this same shape) rather than generated
// from this file at migration time — see that file's header comment for
// why. The Own/Any rename and guest lockout for pre-existing bundles is a
// second, equally frozen snapshot in
// drizzle/0023_permission_bundles_own_any.sql.
