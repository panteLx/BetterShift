"use client";

import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";
import {
  formatValueForDisplay,
  type CustomFieldDefinition,
  type CustomFieldInputValue,
} from "@/lib/custom-fields";

type CustomFieldValues = Record<string, CustomFieldInputValue>;

interface VisibleField {
  definition: CustomFieldDefinition;
  raw: CustomFieldInputValue;
}

/** Definitions marked for the calendar, with an actual value — an unticked checkbox is not a value. */
function visibleFields(
  values: CustomFieldValues | undefined,
  definitions: CustomFieldDefinition[]
): VisibleField[] {
  if (!values) return [];
  return definitions
    .filter((d) => d.showInCalendar)
    .map((d) => ({ definition: d, raw: values[d.key] }))
    .filter(
      (f): f is VisibleField => f.raw !== null && f.raw !== undefined && f.raw !== "" && f.raw !== false
    );
}

/**
 * Whether CustomFieldSummary would render anything for these values.
 * Shared with the grid row-height calculation so the two never disagree on whether a line is drawn.
 */
export function hasVisibleCustomFields(
  values: CustomFieldValues | undefined,
  definitions: CustomFieldDefinition[]
): boolean {
  return visibleFields(values, definitions).length > 0;
}

interface CustomFieldSummaryProps {
  values: CustomFieldValues | undefined;
  definitions: CustomFieldDefinition[];
  variant: "detail" | "compact";
  className?: string;
}

/**
 * Read-only render of a shift's calendar-visible custom field values.
 * "detail" is one line per field (day detail column); "compact" joins everything
 * into a single truncated line so a grid cell never grows by more than one row.
 */
export function CustomFieldSummary({ values, definitions, variant, className }: CustomFieldSummaryProps) {
  const locale = useLocale();
  const fields = visibleFields(values, definitions);
  if (fields.length === 0) return null;

  const rendered = fields.map((f) => ({
    definition: f.definition,
    text: formatValueForDisplay(f.definition, String(f.raw), locale),
  }));

  if (variant === "compact") {
    return (
      <span className={cn("block truncate text-[10.5px] leading-[14px] opacity-75", className)}>
        {rendered.map((e) => `${e.definition.label}: ${e.text}`).join(" · ")}
      </span>
    );
  }

  return (
    <div className={cn("mt-1 space-y-0.5 text-xs text-fg-secondary", className)}>
      {rendered.map((e) => (
        <div key={e.definition.id} className="truncate">
          <span className="text-fg-tertiary">{e.definition.label}: </span>
          {e.text}
        </div>
      ))}
    </div>
  );
}
