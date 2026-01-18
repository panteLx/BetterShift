import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrationWhitelist, user } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { isSuperAdmin, getPatternType, validateWhitelistPattern } from "@/lib/auth/whitelist";

/**
 * GET /api/admin/whitelist
 * List all whitelist entries (superadmin only)
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

        // Fetch all whitelist entries with user info
        const entries = await db
            .select({
                id: registrationWhitelist.id,
                pattern: registrationWhitelist.pattern,
                patternType: registrationWhitelist.patternType,
                addedBy: registrationWhitelist.addedBy,
                usedAt: registrationWhitelist.usedAt,
                usedByUserId: registrationWhitelist.usedByUserId,
                createdAt: registrationWhitelist.createdAt,
            })
            .from(registrationWhitelist)
            .orderBy(desc(registrationWhitelist.createdAt));

        // Get user info for addedBy and usedByUserId
        const userIds = [
            ...new Set([
                ...entries.map((e) => e.addedBy).filter(Boolean),
                ...entries.map((e) => e.usedByUserId).filter(Boolean),
            ]),
        ] as string[];

        const users =
            userIds.length > 0
                ? await db
                    .select({ id: user.id, name: user.name, email: user.email })
                    .from(user)
                : [];

        const userMap = new Map(users.map((u) => [u.id, u]));

        const enrichedEntries = entries.map((entry) => ({
            ...entry,
            addedByUser: entry.addedBy ? userMap.get(entry.addedBy) : null,
            usedByUser: entry.usedByUserId ? userMap.get(entry.usedByUserId) : null,
        }));

        return NextResponse.json(enrichedEntries);
    } catch (error) {
        console.error("Failed to fetch whitelist:", error);
        return NextResponse.json(
            { error: "Failed to fetch whitelist" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/whitelist
 * Add email/domain to whitelist (superadmin only)
 */
export async function POST(request: Request) {
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
        const { pattern } = body;

        if (!pattern || typeof pattern !== "string") {
            return NextResponse.json(
                { error: "Pattern is required" },
                { status: 400 }
            );
        }

        const normalizedPattern = pattern.trim().toLowerCase();

        // Validate pattern
        const validation = validateWhitelistPattern(normalizedPattern);
        if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        // Check if pattern already exists
        const existing = await db
            .select()
            .from(registrationWhitelist)
            .where(eq(registrationWhitelist.pattern, normalizedPattern))
            .limit(1);

        if (existing.length > 0) {
            return NextResponse.json(
                { error: "This pattern already exists in the whitelist" },
                { status: 409 }
            );
        }

        // Insert new entry
        const patternType = getPatternType(normalizedPattern);
        const [newEntry] = await db
            .insert(registrationWhitelist)
            .values({
                pattern: normalizedPattern,
                patternType,
                addedBy: sessionUser.id,
            })
            .returning();

        return NextResponse.json(newEntry, { status: 201 });
    } catch (error) {
        console.error("Failed to add to whitelist:", error);
        return NextResponse.json(
            { error: "Failed to add to whitelist" },
            { status: 500 }
        );
    }
}
