import { getSystemSettings, updateSystemSettings } from "@/lib/system-settings";
import { resolveTelemetryEnabled } from "@/lib/telemetry/config";

/**
 * Mints the instance id on first use when telemetry resolves to on, including
 * when it is forced by env. Never mints while off: a declining instance must
 * hold no identifier at all.
 */
export async function ensureTelemetryInstanceId(): Promise<string | null> {
  const settings = await getSystemSettings();
  if (!resolveTelemetryEnabled(settings.telemetryEnabled)) return null;
  if (settings.telemetryInstanceId) return settings.telemetryInstanceId;

  const { after } = await updateSystemSettings({
    telemetryInstanceId: crypto.randomUUID(),
  });
  return after.telemetryInstanceId;
}
