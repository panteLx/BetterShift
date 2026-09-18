import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendarCustomFields,
  presetCustomFieldValues,
  shiftCustomFieldValues,
} from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability } from "@/lib/auth/permissions";
import { rateLimit } from "@/lib/rate-limiter";
import {
  logUserAction,
  type CustomFieldDeletedMetadata,
  type CustomFieldUpdatedMetadata,
} from "@/lib/audit-log";
import { sanitizeDefinitionInput } from "@/lib/custom-fields";
import { getCalendarName } from "@/lib/auth/permission-bundles-service";

async function loadField(calendarId: string, fieldId: string) {
  const [field] = await db
    .select()
    .from(calendarCustomFields)
    .where(
      and(
        eq(calendarCustomFields.id, fieldId),
        eq(calendarCustomFields.calendarId, calendarId)
      )
    );
  return field ?? null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  try {
    const { id: calendarId, fieldId } = await params;
    const user = await getSessionUser(request.headers);

    if (!(await hasCapability(user?.id, calendarId, "manageCustomFields"))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const limited = rateLimit(request, user?.id, "custom-field-mutations", calendarId);
    if (limited) return limited;

    const field = await loadField(calendarId, fieldId);
    if (!field) {
      return NextResponse.json({ error: "Custom field not found" }, { status: 404 });
    }

    const body = await request.json();
    // key and type are immutable: re-sanitise against the stored type so a
    // client cannot change either by sending them.
    const input = sanitizeDefinitionInput({ ...body, type: field.type });
    if (!input) {
      return NextResponse.json({ error: "Invalid custom field" }, { status: 400 });
    }

    const [updated] = await db
      .update(calendarCustomFields)
      .set({
        label: input.label,
        options: input.options,
        required: input.required,
        showInCalendar: input.showInCalendar,
      })
      .where(eq(calendarCustomFields.id, fieldId))
      .returning();

    await logUserAction<CustomFieldUpdatedMetadata>({
      userId: user?.id,
      action: "calendar.customField.updated",
      request,
      metadata: {
        calendarId,
        calendarName: await getCalendarName(calendarId),
        fieldKey: updated.key,
        fieldLabel: updated.label,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update custom field:", error);
    return NextResponse.json({ error: "Failed to update custom field" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  try {
    const { id: calendarId, fieldId } = await params;
    const user = await getSessionUser(request.headers);

    if (!(await hasCapability(user?.id, calendarId, "manageCustomFields"))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const limited = rateLimit(request, user?.id, "custom-field-mutations", calendarId);
    if (limited) return limited;

    const field = await loadField(calendarId, fieldId);
    if (!field) {
      return NextResponse.json({ error: "Custom field not found" }, { status: 404 });
    }

    // Counted before the delete; the rows go away with it via ON DELETE CASCADE.
    const [{ shiftCount }] = await db
      .select({ shiftCount: sql<number>`count(*)` })
      .from(shiftCustomFieldValues)
      .where(eq(shiftCustomFieldValues.fieldId, fieldId));
    const [{ presetCount }] = await db
      .select({ presetCount: sql<number>`count(*)` })
      .from(presetCustomFieldValues)
      .where(eq(presetCustomFieldValues.fieldId, fieldId));

    await db.delete(calendarCustomFields).where(eq(calendarCustomFields.id, fieldId));

    await logUserAction<CustomFieldDeletedMetadata>({
      userId: user?.id,
      action: "calendar.customField.deleted",
      request,
      metadata: {
        calendarId,
        calendarName: await getCalendarName(calendarId),
        fieldKey: field.key,
        fieldLabel: field.label,
        affectedShifts: shiftCount,
        affectedPresets: presetCount,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete custom field:", error);
    return NextResponse.json({ error: "Failed to delete custom field" }, { status: 500 });
  }
}
