import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarCustomFields } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability } from "@/lib/auth/permissions";
import { rateLimit } from "@/lib/rate-limiter";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: calendarId } = await params;
    const user = await getSessionUser(request.headers);

    if (!(await hasCapability(user?.id, calendarId, "manageCustomFields"))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const limited = rateLimit(request, user?.id, "custom-field-mutations", calendarId);
    if (limited) return limited;

    const { fieldIds } = await request.json();
    if (!Array.isArray(fieldIds) || fieldIds.some((id) => typeof id !== "string")) {
      return NextResponse.json({ error: "Invalid fieldIds" }, { status: 400 });
    }

    db.transaction((tx) => {
      fieldIds.forEach((fieldId: string, index: number) => {
        tx.update(calendarCustomFields)
          .set({ order: index })
          .where(
            and(
              eq(calendarCustomFields.id, fieldId),
              eq(calendarCustomFields.calendarId, calendarId)
            )
          )
          .run();
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder custom fields:", error);
    return NextResponse.json({ error: "Failed to reorder custom fields" }, { status: 500 });
  }
}
