import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarCustomFields } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability } from "@/lib/auth/permissions";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type CustomFieldCreatedMetadata } from "@/lib/audit-log";
import { getCalendarCustomFields } from "@/lib/shift-custom-fields";
import { sanitizeDefinitionInput } from "@/lib/custom-fields";
import { getCalendarName } from "@/lib/auth/permission-bundles-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: calendarId } = await params;
    const user = await getSessionUser(request.headers);

    // Read-only users need the catalog to label the values they can see.
    if (!(await hasCapability(user?.id, calendarId, "viewShifts"))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    return NextResponse.json(await getCalendarCustomFields(calendarId));
  } catch (error) {
    console.error("Failed to fetch custom fields:", error);
    return NextResponse.json({ error: "Failed to fetch custom fields" }, { status: 500 });
  }
}

export async function POST(
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

    const input = sanitizeDefinitionInput(await request.json());
    if (!input || !input.key) {
      return NextResponse.json({ error: "Invalid custom field" }, { status: 400 });
    }

    const [existing] = await db
      .select({ id: calendarCustomFields.id })
      .from(calendarCustomFields)
      .where(
        and(
          eq(calendarCustomFields.calendarId, calendarId),
          eq(calendarCustomFields.key, input.key)
        )
      );
    if (existing) {
      return NextResponse.json({ error: "KEY_IN_USE" }, { status: 409 });
    }

    const [{ maxOrder }] = await db
      .select({ maxOrder: sql<number>`coalesce(max(${calendarCustomFields.order}), -1)` })
      .from(calendarCustomFields)
      .where(eq(calendarCustomFields.calendarId, calendarId));

    const [created] = await db
      .insert(calendarCustomFields)
      .values({
        calendarId,
        key: input.key,
        label: input.label,
        type: input.type,
        options: input.options,
        required: input.required,
        showInCalendar: input.showInCalendar,
        order: maxOrder + 1,
        createdBy: user?.id ?? null,
      })
      .returning();

    await logUserAction<CustomFieldCreatedMetadata>({
      userId: user?.id,
      action: "calendar.customField.created",
      request,
      metadata: {
        calendarId,
        calendarName: await getCalendarName(calendarId),
        fieldKey: created.key,
        fieldLabel: created.label,
        fieldType: created.type,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create custom field:", error);
    return NextResponse.json({ error: "Failed to create custom field" }, { status: 500 });
  }
}
