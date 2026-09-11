import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/sessions";
import { sanitizePersonalViewSettings } from "@/lib/view-settings";

// GET the signed-in user's personal view (null until first saved)
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request.headers);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const row = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, user.id),
    });
    return NextResponse.json({
      viewSettings: row?.viewSettings
        ? sanitizePersonalViewSettings(row.viewSettings)
        : null,
    });
  } catch (error) {
    console.error("Failed to fetch view settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch view settings" },
      { status: 500 }
    );
  }
}

// PUT merges the given keys into the stored view
export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser(request.headers);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const patch = body?.viewSettings;
    if (typeof patch !== "object" || patch === null || Array.isArray(patch)) {
      return NextResponse.json(
        { error: "viewSettings object is required" },
        { status: 400 }
      );
    }

    // Synchronous transaction so concurrent partial PUTs cannot drop each other's keys
    const viewSettings = db.transaction((tx) => {
      const row = tx
        .select({ viewSettings: userPreferences.viewSettings })
        .from(userPreferences)
        .where(eq(userPreferences.userId, user.id))
        .get();
      const next = sanitizePersonalViewSettings({
        ...(row?.viewSettings ?? {}),
        ...patch,
      });
      tx.insert(userPreferences)
        .values({ userId: user.id, viewSettings: next, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: userPreferences.userId,
          set: { viewSettings: next, updatedAt: new Date() },
        })
        .run();
      return next;
    });

    return NextResponse.json({ viewSettings });
  } catch (error) {
    console.error("Failed to update view settings:", error);
    return NextResponse.json(
      { error: "Failed to update view settings" },
      { status: 500 }
    );
  }
}
