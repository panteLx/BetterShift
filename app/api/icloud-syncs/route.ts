import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { icloudSyncs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Validates iCloud calendar URL to prevent SSRF vulnerabilities
 * @param url - The URL to validate
 * @returns true if valid, false otherwise
 */
function isValidICloudUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    // Check if protocol is webcal or https
    if (!["webcal:", "https:"].includes(parsedUrl.protocol)) {
      return false;
    }

    // Check if hostname is from iCloud domain
    const hostname = parsedUrl.hostname.toLowerCase();
    if (!hostname.endsWith(".icloud.com") && hostname !== "icloud.com") {
      return false;
    }

    return true;
  } catch {
    // Invalid URL format
    return false;
  }
}

// GET all iCloud syncs for a calendar
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get("calendarId");

    if (!calendarId) {
      return NextResponse.json(
        { error: "Calendar ID is required" },
        { status: 400 }
      );
    }

    const syncs = await db
      .select()
      .from(icloudSyncs)
      .where(eq(icloudSyncs.calendarId, calendarId))
      .orderBy(icloudSyncs.createdAt);

    return NextResponse.json(syncs);
  } catch (error) {
    console.error("Failed to fetch iCloud syncs:", error);
    return NextResponse.json(
      { error: "Failed to fetch iCloud syncs" },
      { status: 500 }
    );
  }
}

// POST create new iCloud sync
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { calendarId, name, icloudUrl, color } = body;

    if (!calendarId || !name || !icloudUrl) {
      return NextResponse.json(
        { error: "Calendar ID, name, and iCloud URL are required" },
        { status: 400 }
      );
    }

    // Validate iCloud URL to prevent SSRF
    if (!isValidICloudUrl(icloudUrl)) {
      return NextResponse.json(
        {
          error:
            "Invalid iCloud URL. URL must use webcal:// or https:// protocol and be from icloud.com domain",
        },
        { status: 400 }
      );
    }

    const [icloudSync] = await db
      .insert(icloudSyncs)
      .values({
        id: crypto.randomUUID(),
        calendarId,
        name,
        icloudUrl,
        color: color || "#3b82f6",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json(icloudSync, { status: 201 });
  } catch (error) {
    console.error("Failed to create iCloud sync:", error);
    return NextResponse.json(
      { error: "Failed to create iCloud sync" },
      { status: 500 }
    );
  }
}
