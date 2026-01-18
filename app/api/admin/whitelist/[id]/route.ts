import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrationWhitelist } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { isSuperAdmin } from "@/lib/auth/whitelist";

/**
 * DELETE /api/admin/whitelist/[id]
 * Remove a whitelist entry (superadmin only)
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const sessionUser = await getSessionUser(request.headers);

        if (!sessionUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const hasAccess = await isSuperAdmin(sessionUser.id);
        if (!hasAccess) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Check if entry exists
        const [existing] = await db
            .select()
            .from(registrationWhitelist)
            .where(eq(registrationWhitelist.id, id))
            .limit(1);

        if (!existing) {
            return NextResponse.json(
                { error: "Whitelist entry not found" },
                { status: 404 }
            );
        }

        // Delete the entry
        await db
            .delete(registrationWhitelist)
            .where(eq(registrationWhitelist.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete whitelist entry:", error);
        return NextResponse.json(
            { error: "Failed to delete whitelist entry" },
            { status: 500 }
        );
    }
}
