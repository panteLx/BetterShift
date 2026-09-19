// Wire format version. Bump only for removed fields or changed meanings —
// adding a field is backwards compatible and needs no bump.
export const TELEMETRY_SCHEMA_VERSION = 1;

export const BUCKETS = ["0", "1-5", "6-20", "21-100", "101-500", "500+"] as const;
export type Bucket = (typeof BUCKETS)[number];

// Exact counts make a small instance recognisable; buckets answer the same
// questions without doing so.
export function toBucket(count: number): Bucket {
  if (count <= 0) return "0";
  if (count <= 5) return "1-5";
  if (count <= 20) return "6-20";
  if (count <= 100) return "21-100";
  if (count <= 500) return "101-500";
  return "500+";
}

export type TelemetryProfile = "telemetry" | "diagnostics";

export interface TelemetryPayload {
  schemaVersion: number;
  instanceId: string | null;
  sentAt: string;
  app: { version: string; isDev: boolean; migrations: number };
  runtime: {
    node: string;
    arch: string;
    platform: string;
    sqlite: string;
    timezone: string;
  };
  config: {
    authEnabled: boolean;
    guestAccess: boolean;
    registrationOpen: boolean;
    defaultLocale: string;
    updateCheckEnabled: boolean;
    rateLimitOverrides: number;
  };
  scale: {
    users: Bucket;
    calendars: Bucket;
    shifts: Bucket;
    presets: Bucket;
    notes: Bucket;
    bundles: Bucket;
    shares: Bucket;
    accessTokens: Bucket;
    signups: Bucket;
  };
  features: {
    externalSyncs: Bucket;
    calendarViewOverrides: Bucket;
    customFields: { count: Bucket; types: string[] };
    archivedPresets: boolean;
    splitShifts: boolean;
  };
  health: { uptimeHours: number; syncRuns24h: number; syncFailures24h: number };
}

// Admin-triggered export for GitHub issues. Exact counts are acceptable here
// because the admin actively presses copy and chooses what to paste.
export interface DiagnosticsPayload
  extends Omit<TelemetryPayload, "scale" | "features"> {
  scale: Record<keyof TelemetryPayload["scale"], number>;
  features: {
    externalSyncs: number;
    calendarViewOverrides: number;
    customFields: { count: number; types: string[] };
    archivedPresets: boolean;
    splitShifts: boolean;
  };
  envFlags: Record<string, string>;
  migrationList: string[];
}
