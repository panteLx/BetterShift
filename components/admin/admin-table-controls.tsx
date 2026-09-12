"use client";

import { ComponentProps, ReactNode } from "react";
import { ChevronDown, ChevronUp, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 30px outline icon button used in the actions column of admin tables. */
export function RowActionButton({
  icon: Icon,
  label,
  className,
  ...props
}: { icon: LucideIcon; label: string } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-[30px] shrink-0 items-center justify-center rounded-[7px] border border-line bg-surface-card text-fg-secondary transition-colors hover:bg-surface-panel disabled:pointer-events-none disabled:opacity-40",
        className
      )}
      {...props}
    >
      <Icon className="size-[15px]" />
    </button>
  );
}

/** Clickable column header; shows the direction only on the active column. */
export function SortHeader<T extends string>({
  column,
  label,
  sort,
  onSort,
}: {
  column: T;
  label: ReactNode;
  sort: { column: T; direction: "asc" | "desc" };
  onSort: (column: T) => void;
}) {
  const active = sort.column === column;
  const Icon = sort.direction === "asc" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        "inline-flex max-w-full items-center gap-1 uppercase hover:text-fg-strong",
        active && "text-fg-body"
      )}
    >
      <span className="truncate">{label}</span>
      {active && <Icon className="size-3.5 shrink-0" />}
    </button>
  );
}

/** Square outline trigger for the secondary filter menu; the dot marks a non-default filter. */
export function FilterMenuButton({
  label,
  active,
  ...props
}: { label: string; active: boolean } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "relative flex size-[38px] shrink-0 items-center justify-center rounded-[9px] border bg-surface-card transition-colors hover:bg-surface-panel",
        active ? "border-brand text-brand-ink" : "border-line text-fg-secondary"
      )}
      {...props}
    >
      <SlidersHorizontal className="size-4" />
      {active && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-brand" />}
    </button>
  );
}

export type SortState<T extends string> = { column: T; direction: "asc" | "desc" };

export function nextSort<T extends string>(sort: SortState<T>, column: T): SortState<T> {
  return sort.column === column
    ? { column, direction: sort.direction === "asc" ? "desc" : "asc" }
    : { column, direction: "desc" };
}
