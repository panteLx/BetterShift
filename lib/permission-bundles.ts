/**
 * Capability catalog for calendar permission bundles.
 *
 * Replaces the old fixed read/write/admin ladder: an owner defines what a
 * named bundle means per calendar by ticking capabilities, instead of the
 * app hard-coding what "write" bundles together. See
 * .LOCAL/calendar-permission-bundles-plan.md for the full design.
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
  "editShift",
  "deleteShift",
  // Notes & events
  "manageNotesEvents",
  // Signups
  "signUpSelf",
  "signUpOthers",
  // Presets
  "managePresets",
  // External sync
  "manageExternalSync",
  "deleteSyncLogs",
  // Administrative — never assignable to a guest/link source, see isGuestEligible()
  "manageShares",
  "manageGuestAccess",
  "manageCalendarSettings",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const CAPABILITY_SET: ReadonlySet<string> = new Set(CAPABILITIES);

/**
 * Capabilities a bundle may never hold if it's reachable by a guest/link
 * source (access token, or calendars.guestBundleId) — enforced both when
 * offering bundles for assignment and again in hasCapability() itself.
 */
const ADMIN_ONLY_CAPABILITIES: ReadonlySet<Capability> = new Set([
  "manageShares",
  "manageGuestAccess",
  "manageCalendarSettings",
]);

export function isGuestEligible(capabilities: readonly Capability[]): boolean {
  return capabilities.every((c) => !ADMIN_ONLY_CAPABILITIES.has(c));
}

export function isAdminOnlyCapability(capability: Capability): boolean {
  return ADMIN_ONLY_CAPABILITIES.has(capability);
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

export interface BundleDefinition {
  name: string;
  capabilities: Capability[];
}

const READ_BASE: Capability[] = ["viewShifts", "viewNotesEvents", "viewStats"];
const CONTRIBUTE_BASE: Capability[] = [
  ...READ_BASE,
  "stampPreset",
  "createShift",
  "deleteShift",
  "manageNotesEvents",
  "signUpSelf",
];
const MANAGE_BASE: Capability[] = [
  ...CONTRIBUTE_BASE,
  "editShift",
  "signUpOthers",
  "viewMembers",
  "managePresets",
  "manageExternalSync",
  "deleteSyncLogs",
];
const ADMIN_BASE: Capability[] = [
  ...MANAGE_BASE,
  "manageShares",
  "manageGuestAccess",
  "manageCalendarSettings",
];

/**
 * Recommended defaults for a newly created calendar. Reflects the audit
 * findings from the design doc: presets, shift editing, external sync config
 * and sync-log deletion require Manage, not just Contribute.
 */
export function defaultBundleDefinitionsForNewCalendar(): BundleDefinition[] {
  return [
    { name: "Read", capabilities: [...READ_BASE] },
    { name: "Contribute", capabilities: [...CONTRIBUTE_BASE] },
    { name: "Manage", capabilities: [...MANAGE_BASE] },
    { name: "Admin", capabilities: [...ADMIN_BASE] },
  ];
}

// Existing-calendar migration bundles are hand-written directly into
// drizzle/0020_backfill_permission_bundles.sql (a frozen, one-time SQL
// snapshot of this same shape) rather than generated from this file at
// migration time — see that file's header comment for why.
