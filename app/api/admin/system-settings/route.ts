import { NextRequest, NextResponse } from "next/server";
import { getValidatedAdminUser, isErrorResponse } from "@/lib/auth/admin-helpers";
import { canManageSystemSettings } from "@/lib/auth/admin";
import {
  getSystemSettings,
  updateSystemSettings,
  type SystemSettings,
  type UpdateBannerVisibility,
} from "@/lib/system-settings";
import {
  logAdminAction,
  type AdminSystemSettingsUpdatedMetadata,
  type AdminTelemetryConsentMetadata,
} from "@/lib/audit-log";
import {
  isTelemetryForcedByEnv,
  resolveTelemetryEnabled,
} from "@/lib/telemetry/config";
import { TELEMETRY_SCHEMA_VERSION } from "@/lib/telemetry/schema";

const VISIBILITY_VALUES: UpdateBannerVisibility[] = ["all", "admins"];

/** Enumerated, not spread: an audit log is exportable and must never carry the instance id. */
function forAudit(settings: SystemSettings): AdminSystemSettingsUpdatedMetadata["before"] {
  return {
    updateCheckEnabled: settings.updateCheckEnabled,
    updateBannerVisibility: settings.updateBannerVisibility,
    allowGuestAccess: settings.allowGuestAccess,
    telemetryEnabled: settings.telemetryEnabled,
    telemetryConsentedSchema: settings.telemetryConsentedSchema,
    telemetryDecidedAt: settings.telemetryDecidedAt,
  };
}

/**
 * Admin System Settings API
 *
 * GET  /api/admin/system-settings
 * PATCH /api/admin/system-settings
 *
 * Permission: Admin or Superadmin only
 */
async function requireSystemSettingsAccess(request: NextRequest) {
  const currentUser = await getValidatedAdminUser(request);
  if (isErrorResponse(currentUser)) {
    return { error: currentUser };
  }

  if (!canManageSystemSettings(currentUser)) {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }

  return { currentUser };
}

export async function GET(request: NextRequest) {
  try {
    const { error } = await requireSystemSettingsAccess(request);
    if (error) return error;

    const settings = await getSystemSettings();
    // Derived, never stored: the client can't read process.env itself, so the
    // panel would otherwise show the stored value while the env override sends.
    return NextResponse.json({
      ...settings,
      telemetryEnvManaged: isTelemetryForcedByEnv(),
      telemetryResolved: resolveTelemetryEnabled(settings.telemetryEnabled),
    });
  } catch (error) {
    console.error("Failed to fetch system settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch system settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { error, currentUser } = await requireSystemSettingsAccess(request);
    if (error) return error;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const patch: {
      updateCheckEnabled?: boolean;
      updateBannerVisibility?: UpdateBannerVisibility;
      allowGuestAccess?: boolean;
      telemetryEnabled?: boolean;
      telemetryDecidedAt?: Date;
      telemetryConsentedSchema?: number;
      telemetryInstanceId?: string;
    } = {};

    if ("updateCheckEnabled" in body) {
      if (typeof body.updateCheckEnabled !== "boolean") {
        return NextResponse.json({ error: "updateCheckEnabled must be a boolean" }, { status: 400 });
      }
      patch.updateCheckEnabled = body.updateCheckEnabled;
    }

    if ("updateBannerVisibility" in body) {
      if (!VISIBILITY_VALUES.includes(body.updateBannerVisibility)) {
        return NextResponse.json(
          { error: `updateBannerVisibility must be one of: ${VISIBILITY_VALUES.join(", ")}` },
          { status: 400 }
        );
      }
      patch.updateBannerVisibility = body.updateBannerVisibility;
    }

    if ("allowGuestAccess" in body) {
      if (typeof body.allowGuestAccess !== "boolean") {
        return NextResponse.json({ error: "allowGuestAccess must be a boolean" }, { status: 400 });
      }
      patch.allowGuestAccess = body.allowGuestAccess;
    }

    if ("telemetryEnabled" in body) {
      if (typeof body.telemetryEnabled !== "boolean") {
        return NextResponse.json({ error: "telemetryEnabled must be a boolean" }, { status: 400 });
      }
      if (isTelemetryForcedByEnv()) {
        return NextResponse.json(
          { error: "telemetryEnabled is managed by the TELEMETRY_ENABLED environment variable and cannot be changed here" },
          { status: 400 }
        );
      }
      patch.telemetryEnabled = body.telemetryEnabled;
      patch.telemetryDecidedAt = new Date();
      patch.telemetryConsentedSchema = TELEMETRY_SCHEMA_VERSION;
      if (body.telemetryEnabled) {
        const current = await getSystemSettings();
        // Created on first opt-in only, never at install time.
        patch.telemetryInstanceId = current.telemetryInstanceId ?? crypto.randomUUID();
      }
    }

    const { before, after } = await updateSystemSettings(patch);

    await logAdminAction<AdminSystemSettingsUpdatedMetadata>({
      action: "admin.system_settings.update",
      userId: currentUser!.id,
      request,
      metadata: { before: forAudit(before), after: forAudit(after) },
    });

    if ("telemetryEnabled" in patch) {
      await logAdminAction<AdminTelemetryConsentMetadata>({
        action: "admin.telemetry_consent",
        userId: currentUser!.id,
        resourceType: "system_settings",
        request,
        metadata: {
          before: before.telemetryEnabled,
          after: after.telemetryEnabled === true,
          schemaVersion: TELEMETRY_SCHEMA_VERSION,
        },
      });
    }

    return NextResponse.json(after);
  } catch (error) {
    console.error("Failed to update system settings:", error);
    return NextResponse.json(
      { error: "Failed to update system settings" },
      { status: 500 }
    );
  }
}
