import { formatDateToLocal, parseLocalDate } from "@/lib/date-utils";

export const CUSTOM_FIELD_TYPES = ["text", "number", "date", "checkbox", "select"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

const TYPE_SET: ReadonlySet<string> = new Set(CUSTOM_FIELD_TYPES);

export interface CustomFieldOption {
  id: string;
  label: string;
}

export interface CustomFieldDefinition {
  id: string;
  calendarId: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options: CustomFieldOption[] | null;
  required: boolean;
  showInCalendar: boolean;
  order: number;
}

export type CustomFieldInputValue = string | number | boolean | null;

export const CUSTOM_FIELD_KEY_MAX = 40;
export const CUSTOM_FIELD_LABEL_MAX = 60;
export const CUSTOM_FIELD_TEXT_MAX = 500;
export const CUSTOM_FIELD_OPTIONS_MAX = 50;

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Lowercases and strips a user-typed key down to [a-z][a-z0-9_]*; null when nothing usable remains. */
export function normalizeKey(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const key = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, CUSTOM_FIELD_KEY_MAX);
  return KEY_PATTERN.test(key) ? key : null;
}

/** Converts a client value into the single TEXT column representation; null means "no value". */
export function serializeValue(type: CustomFieldType, input: unknown): string | null {
  if (input === null || input === undefined) return null;

  switch (type) {
    case "text": {
      if (typeof input !== "string") return null;
      const text = input.trim().slice(0, CUSTOM_FIELD_TEXT_MAX);
      return text === "" ? null : text;
    }
    case "number": {
      if (typeof input === "number") {
        return Number.isFinite(input) ? String(input) : null;
      }
      const trimmed = String(input).trim();
      // Number("") is 0, which would silently satisfy a required field — treat blank as absent.
      if (trimmed === "") return null;
      const n = Number(trimmed);
      return Number.isFinite(n) ? String(n) : null;
    }
    case "date": {
      if (input instanceof Date) return formatDateToLocal(input);
      if (typeof input !== "string") return null;
      const date = input.trim();
      if (!DATE_PATTERN.test(date)) return null;
      // Round-trip through the local parser so an impossible date (2026-02-31) is rejected.
      try {
        return formatDateToLocal(parseLocalDate(date)) === date ? date : null;
      } catch {
        return null;
      }
    }
    case "checkbox":
      if (typeof input === "boolean") return input ? "true" : "false";
      if (input === "true" || input === "false") return input;
      return null;
    case "select": {
      if (typeof input !== "string") return null;
      const id = input.trim();
      return id === "" ? null : id;
    }
  }
}

/** Inverse of serializeValue, for handing a stored value back to a form control. */
export function parseValue(type: CustomFieldType, raw: string): CustomFieldInputValue {
  switch (type) {
    case "number": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case "checkbox":
      return raw === "true";
    case "text":
    case "date":
    case "select":
      return raw;
  }
}

export function validateFieldValue(
  definition: CustomFieldDefinition,
  input: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = serializeValue(definition.type, input);

  if (value === null) {
    // A checkbox is never "missing": an unchecked box is a valid answer, not required-empty, and stores no row.
    if (definition.type === "checkbox") return { ok: true, value: null };
    if (definition.required) {
      return { ok: false, error: `Field "${definition.key}" is required` };
    }
    return { ok: true, value: null };
  }

  if (definition.type === "select") {
    const known = (definition.options ?? []).some((o) => o.id === value);
    if (!known) {
      // An option removed from the definition after the value was stored — drop it like an
      // unknown key, unless the field is required, in which case the gap is a genuine error.
      if (definition.required) {
        return { ok: false, error: `Unknown option for field "${definition.key}"` };
      }
      return { ok: true, value: null };
    }
  }

  return { ok: true, value };
}

function sanitizeOptions(input: unknown): CustomFieldOption[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<string>();
  const options: CustomFieldOption[] = [];
  for (const entry of input.slice(0, CUSTOM_FIELD_OPTIONS_MAX)) {
    if (typeof entry !== "object" || entry === null) continue;
    const { id, label } = entry as Record<string, unknown>;
    const optionId = normalizeKey(id);
    if (!optionId || seen.has(optionId)) continue;
    if (typeof label !== "string" || label.trim() === "") continue;
    seen.add(optionId);
    options.push({ id: optionId, label: label.trim().slice(0, CUSTOM_FIELD_LABEL_MAX) });
  }
  return options.length > 0 ? options : null;
}

/**
 * Whitelists a definition body from the network. `key` is only returned when
 * present and valid — PATCH callers must drop it, since key and type are
 * immutable after creation.
 */
export function sanitizeDefinitionInput(input: unknown): {
  key?: string;
  label: string;
  type: CustomFieldType;
  options: CustomFieldOption[] | null;
  required: boolean;
  showInCalendar: boolean;
} | null {
  if (typeof input !== "object" || input === null) return null;
  const src = input as Record<string, unknown>;

  if (typeof src.type !== "string" || !TYPE_SET.has(src.type)) return null;
  const type = src.type as CustomFieldType;

  if (typeof src.label !== "string") return null;
  const label = src.label.trim().slice(0, CUSTOM_FIELD_LABEL_MAX);
  if (label === "") return null;

  const options = type === "select" ? sanitizeOptions(src.options) : null;
  if (type === "select" && options === null) return null;

  const key = normalizeKey(src.key);

  return {
    ...(key ? { key } : {}),
    label,
    type,
    options,
    required: src.required === true,
    showInCalendar: src.showInCalendar === true,
  };
}

/** Human-readable value for read-only surfaces (day detail, grid cells, exports). */
export function formatValueForDisplay(
  definition: CustomFieldDefinition,
  raw: string,
  locale: string
): string {
  switch (definition.type) {
    case "checkbox":
      return raw === "true" ? "✓" : "";
    case "select":
      return (definition.options ?? []).find((o) => o.id === raw)?.label ?? raw;
    case "number":
      return new Intl.NumberFormat(locale).format(Number(raw));
    case "date":
    case "text":
      return raw;
  }
}
