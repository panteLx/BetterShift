"use client";

import { cn } from "@/lib/utils";

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; badge?: React.ReactNode }[];
  label: string;
  size?: "md" | "lg";
  className?: string;
}

/** Track with at most three segments; the active one is lifted onto a card surface. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex rounded-[10px] bg-surface-sunken p-[3px]", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg font-medium transition-colors",
              size === "lg" ? "h-[34px] text-[13.5px]" : "h-[30px] text-[13px]",
              active
                ? "bg-surface-card font-semibold text-fg-strong shadow-segment dark:bg-control"
                : "text-fg-secondary hover:text-fg-strong"
            )}
          >
            {option.label}
            {option.badge}
          </button>
        );
      })}
    </div>
  );
}
