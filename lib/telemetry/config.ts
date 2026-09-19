export const DEFAULT_TELEMETRY_ENDPOINT = "https://telemetry.bettershift.app/";

/** Tri-state, mirroring the nullable column: unset means the instance decides. */
function envOverride(): boolean | null {
  const raw = process.env.TELEMETRY_ENABLED;
  if (raw === undefined || raw === "") return null;
  // Only the literal "true" enables: anything else ("1", "yes", "TRUE") is a
  // forced off, so a typo fails closed instead of silently opting an instance in.
  return raw === "true";
}

export function isTelemetryForcedByEnv(): boolean {
  return envOverride() !== null;
}

/** A set env var always wins over the database, in both directions. */
export function resolveTelemetryEnabled(stored: boolean | null): boolean {
  return envOverride() ?? stored === true;
}

export function getTelemetryEndpoint(): string {
  return process.env.TELEMETRY_ENDPOINT || DEFAULT_TELEMETRY_ENDPOINT;
}
