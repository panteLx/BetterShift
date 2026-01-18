import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessions";
import { isSuperAdmin } from "@/lib/auth/whitelist";
import { getRegistrationMode, setRegistrationMode, RegistrationMode } from "@/lib/settings";

/**
 * GET /api/admin/settings
 * Get current system settings (superadmin only)
 */
export async function GET(request: Request) {
    try {
        const sessionUser = await getSessionUser(request.headers);

        if (!sessionUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const hasAccess = await isSuperAdmin(sessionUser.id);
        if (!hasAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const registrationMode = await getRegistrationMode();

        return NextResponse.json({
            registrationMode,
        });
    } catch (error) {
        console.error("Failed to fetch settings:", error);
        return NextResponse.json(
            { error: "Failed to fetch settings" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/admin/settings
 * Update system settings (superadmin only)
 */
export async function PATCH(request: Request) {
    try {
        const sessionUser = await getSessionUser(request.headers);

        if (!sessionUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const hasAccess = await isSuperAdmin(sessionUser.id);
        if (!hasAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { registrationMode } = body;

        // Validate registration mode
        if (registrationMode !== undefined) {
            const validModes: RegistrationMode[] = ["open", "whitelist", "closed"];
            if (!validModes.includes(registrationMode)) {
                return NextResponse.json(
                    { error: "Invalid registration mode. Must be 'open', 'whitelist', or 'closed'" },
                    { status: 400 }
                );
            }

            await setRegistrationMode(registrationMode, sessionUser.id);
        }

        // Return updated settings
        const updatedMode = await getRegistrationMode();

        return NextResponse.json({
            registrationMode: updatedMode,
        });
    } catch (error) {
        console.error("Failed to update settings:", error);
        return NextResponse.json(
            { error: "Failed to update settings" },
            { status: 500 }
        );
    }
}
