import { db } from "@/lib/db";
import {
  calendarCustomFields,
  shiftCustomFieldValues,
  presetCustomFieldValues,
} from "@/lib/db/schema";
import { asc, eq, inArray } from "drizzle-orm";
import {
  parseValue,
  validateFieldValue,
  type CustomFieldDefinition,
  type CustomFieldInputValue,
} from "@/lib/custom-fields";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface CustomFieldValueRow {
  fieldId: string;
  value: string;
}

export async function getCalendarCustomFields(
  calendarId: string
): Promise<CustomFieldDefinition[]> {
  const rows = await db
    .select()
    .from(calendarCustomFields)
    .where(eq(calendarCustomFields.calendarId, calendarId))
    .orderBy(asc(calendarCustomFields.order));

  return rows.map((row) => ({
    id: row.id,
    calendarId: row.calendarId,
    key: row.key,
    label: row.label,
    type: row.type,
    options: row.options ?? null,
    required: row.required,
    showInCalendar: row.showInCalendar,
    order: row.order,
  }));
}

function groupByOwner(
  rows: { fieldId: string; value: string }[],
  ownerOf: (row: (typeof rows)[number]) => string,
  definitions: CustomFieldDefinition[]
): Map<string, Record<string, CustomFieldInputValue>> {
  const byId = new Map(definitions.map((d) => [d.id, d]));
  const result = new Map<string, Record<string, CustomFieldInputValue>>();
  for (const row of rows) {
    const definition = byId.get(row.fieldId);
    if (!definition) continue;
    const owner = ownerOf(row);
    const bucket = result.get(owner) ?? {};
    bucket[definition.key] = parseValue(definition.type, row.value);
    result.set(owner, bucket);
  }
  return result;
}

/** Attaches each shift's custom field values without N+1 queries. */
export async function withShiftCustomFields<T extends { id: string }>(
  rows: T[],
  definitions: CustomFieldDefinition[]
): Promise<(T & { customFields: Record<string, CustomFieldInputValue> })[]> {
  if (rows.length === 0) return [];
  if (definitions.length === 0) {
    return rows.map((row) => ({ ...row, customFields: {} }));
  }

  const values = await db
    .select()
    .from(shiftCustomFieldValues)
    .where(
      inArray(
        shiftCustomFieldValues.shiftId,
        rows.map((r) => r.id)
      )
    );

  const byShiftId = groupByOwner(
    values,
    (v) => (v as unknown as { shiftId: string }).shiftId,
    definitions
  );
  return rows.map((row) => ({ ...row, customFields: byShiftId.get(row.id) ?? {} }));
}

/** Attaches each preset's custom field values without N+1 queries. */
export async function withPresetCustomFields<T extends { id: string }>(
  rows: T[],
  definitions: CustomFieldDefinition[]
): Promise<(T & { customFields: Record<string, CustomFieldInputValue> })[]> {
  if (rows.length === 0) return [];
  if (definitions.length === 0) {
    return rows.map((row) => ({ ...row, customFields: {} }));
  }

  const values = await db
    .select()
    .from(presetCustomFieldValues)
    .where(
      inArray(
        presetCustomFieldValues.presetId,
        rows.map((r) => r.id)
      )
    );

  const byPresetId = groupByOwner(
    values,
    (v) => (v as unknown as { presetId: string }).presetId,
    definitions
  );
  return rows.map((row) => ({ ...row, customFields: byPresetId.get(row.id) ?? {} }));
}

/**
 * Turns a `{ key: value }` body into rows to persist. Unknown keys are dropped
 * rather than rejected, so a client holding a stale catalog can still save.
 * Returns an error only for a value that fails its own definition.
 */
export function resolveCustomFieldValues(
  definitions: CustomFieldDefinition[],
  input: unknown
): { values: CustomFieldValueRow[] } | { error: string } {
  const src =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  const values: CustomFieldValueRow[] = [];
  for (const definition of definitions) {
    const result = validateFieldValue(definition, src[definition.key]);
    if (!result.ok) return { error: result.error };
    if (result.value !== null) {
      values.push({ fieldId: definition.id, value: result.value });
    }
  }
  return { values };
}

/** Replaces every custom field value of one shift (delete-then-insert), inside an existing transaction. */
export function replaceShiftCustomFieldValues(
  tx: Tx,
  shiftId: string,
  values: CustomFieldValueRow[]
): void {
  tx.delete(shiftCustomFieldValues).where(eq(shiftCustomFieldValues.shiftId, shiftId)).run();
  if (values.length > 0) {
    tx.insert(shiftCustomFieldValues)
      .values(values.map((v) => ({ shiftId, fieldId: v.fieldId, value: v.value })))
      .run();
  }
}

/** Replaces every custom field value of one preset (delete-then-insert), inside an existing transaction. */
export function replacePresetCustomFieldValues(
  tx: Tx,
  presetId: string,
  values: CustomFieldValueRow[]
): void {
  tx.delete(presetCustomFieldValues).where(eq(presetCustomFieldValues.presetId, presetId)).run();
  if (values.length > 0) {
    tx.insert(presetCustomFieldValues)
      .values(values.map((v) => ({ presetId, fieldId: v.fieldId, value: v.value })))
      .run();
  }
}

/** Raw values of one preset, for the stampPreset path that must not trust the request body. */
export async function readPresetCustomFieldValues(
  presetId: string
): Promise<CustomFieldValueRow[]> {
  const rows = await db
    .select()
    .from(presetCustomFieldValues)
    .where(eq(presetCustomFieldValues.presetId, presetId));
  return rows.map((row) => ({ fieldId: row.fieldId, value: row.value }));
}
