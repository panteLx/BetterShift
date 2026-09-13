import { NextRequest, NextResponse } from "next/server";
import { getValidatedAdminUser, isErrorResponse } from "@/lib/auth/admin-helpers";
import { canManageSystemSettings } from "@/lib/auth/admin";
import {
  getSystemSettings,
  updateSystemSettings,
  type UpdateBannerVisibility,
} from "@/lib/system-settings";
import { logAdminAction } from "@/lib/audit-log";

const VISIBILITY_VALUES: UpdateBannerVisibility[] = ["all", "admins"];

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
    return NextResponse.json(settings);
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

    const patch: { updateCheckEnabled?: boolean; updateBannerVisibility?: UpdateBannerVisibility } = {};

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

    const { before, after } = await updateSystemSettings(patch);

    await logAdminAction({
      action: "admin.system_settings.update",
      userId: currentUser!.id,
      request,
      metadata: { before, after },
    });

    return NextResponse.json(after);
  } catch (error) {
    console.error("Failed to update system settings:", error);
    return NextResponse.json(
      { error: "Failed to update system settings" },
      { status: 500 }
    );
  }
}
