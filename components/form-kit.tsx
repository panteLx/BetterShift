"use client";

import { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { HexColorPicker } from "react-colorful";
import { Pipette, type LucideIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PRESET_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/*
 * Building blocks for sheets and settings sections. They only encode the
 * visual system; data handling stays in the owning component or hook.
 */

export function Field({
  label,
  htmlFor,
  optional,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  optional?: boolean;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations();
  return (
    // min-w-0 lets native date/time inputs shrink instead of overflowing their column
    <div className={cn("flex min-w-0 flex-col gap-1.5 lg:gap-2", className)}>
      <Label htmlFor={htmlFor} className="text-[13px] font-semibold text-fg-body">
        {label}
        {optional && (
          <span className="font-normal text-fg-tertiary">{t("formKit.optional")}</span>
        )}
      </Label>
      {children}
      {hint && <p className="text-[12px] text-fg-tertiary">{hint}</p>}
    </div>
  );
}

/** Uppercase label above a group of rows. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("eyebrow mb-2", className)}>{children}</div>;
}

// text-base (16px) below md prevents iOS Safari's auto-zoom on focus
export const zoomSafeText = "text-base md:text-[14px]";
export const inputClass = `h-10 rounded-[9px] px-3 ${zoomSafeText}`;
export const textareaClass = `resize-none rounded-[9px] px-3 py-2.5 ${zoomSafeText}`;

export function ColorSwatches({
  value,
  onChange,
  colors = PRESET_COLORS,
  allowCustom = false,
  disabled = false,
  size = "md",
}: {
  value: string;
  onChange: (color: string) => void;
  colors?: { name: string; value: string }[];
  allowCustom?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const t = useTranslations();
  const isCustom = !colors.some((c) => c.value.toLowerCase() === value?.toLowerCase());
  const box = size === "sm" ? "size-8 rounded-lg" : "size-[34px] rounded-[9px]";

  return (
    <div role="radiogroup" className="flex flex-wrap items-center gap-2">
      {colors.map((color) => {
        const selected = color.value.toLowerCase() === value?.toLowerCase();
        return (
          <button
            key={color.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color.name}
            disabled={disabled}
            onClick={() => onChange(color.value)}
            className={cn(box, "transition-shadow disabled:opacity-50")}
            style={{
              backgroundColor: color.value,
              boxShadow: selected
                ? `0 0 0 2px var(--background), 0 0 0 4px ${color.value}`
                : undefined,
            }}
          />
        );
      })}
      {allowCustom && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex h-[34px] items-center gap-2 rounded-[9px] border border-dashed px-3 text-[13px] font-medium text-fg-secondary",
                isCustom ? "border-brand" : "border-control"
              )}
            >
              {isCustom ? (
                <span className="size-3.5 rounded-[4px]" style={{ backgroundColor: value }} />
              ) : (
                <Pipette className="size-3.5" />
              )}
              {t("formKit.customColor")}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <HexColorPicker color={value} onChange={onChange} />
            <div className="mt-2 text-center font-mono text-[12px] text-fg-secondary">{value}</div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/** Checkbox with a clickable label, optionally with a hint line below it. */
export function CheckRow({
  id,
  checked,
  onCheckedChange,
  disabled,
  label,
  hint,
  children,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        disabled={disabled}
        className="mt-px size-[17px] rounded-[5px] border-[1.5px] border-control bg-surface-card shadow-none"
      />
      <label
        htmlFor={id}
        className={cn(
          "text-[13.5px] leading-[18px] text-fg-body",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        )}
      >
        {children ?? label}
        {hint && <span className="mt-px block text-[12px] text-fg-tertiary">{hint}</span>}
      </label>
    </div>
  );
}

export function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-[14px] font-semibold text-fg-strong">{title}</span>
        {description && (
          <span className="mt-0.5 block text-[12.5px] text-fg-secondary">{description}</span>
        )}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

export function ChoiceChips<T extends string>({
  value,
  onChange,
  options,
  label,
  disabled,
}: {
  value: T | undefined;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; color?: string }[];
  label?: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-8 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors disabled:opacity-50",
              selected
                ? "border-brand bg-brand-soft font-semibold text-brand-ink"
                : "border-line bg-surface-card text-fg-body hover:bg-surface-panel"
            )}
          >
            {option.color && (
              <span className="size-[7px] rounded-full" style={{ backgroundColor: option.color }} />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function OptionCards<T extends string>({
  value,
  onChange,
  options,
  label,
  columns = 2,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; title: ReactNode; description?: ReactNode }[];
  label?: string;
  columns?: 2 | 3 | 4;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "grid gap-2",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        columns === 4 && "grid-cols-2 sm:grid-cols-4"
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[10px] border px-3 py-2.5 text-left transition-colors",
              option.description ? "" : "text-center",
              selected
                ? "border-brand bg-brand-soft"
                : "border-line bg-surface-card hover:bg-surface-panel"
            )}
          >
            <span
              className={cn(
                "block text-[13.5px] font-semibold",
                selected ? "text-brand-ink" : "text-fg-strong"
              )}
            >
              {option.title}
            </span>
            {option.description && (
              <span
                className={cn(
                  "mt-0.5 block text-[12px]",
                  selected ? "text-brand-ink" : "text-fg-tertiary"
                )}
              >
                {option.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Neutral hint box, e.g. explaining what an option does. */
export function InfoNote({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-[10px] border border-line bg-surface-panel px-3 py-2.5 text-[12px] leading-relaxed text-fg-secondary",
        className
      )}
    >
      <Icon className="mt-px size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** The single red block of a panel. */
export function DangerZone({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[11px] border border-danger-line bg-danger-surface px-4 py-3.5">
      <Icon className="size-[18px] shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-danger">{title}</div>
        {description && <div className="text-[13px] text-danger-body">{description}</div>}
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

/** Bordered row used by every list in sheets (presets, links, syncs, people). */
export function ListRow({
  children,
  className,
  highlighted,
}: {
  children: ReactNode;
  className?: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[11px] border bg-surface-card px-3.5 py-3",
        highlighted ? "border-brand" : "border-line",
        className
      )}
    >
      {children}
    </div>
  );
}

export function RowIconButton({
  icon: Icon,
  label,
  onClick,
  tone = "neutral",
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-surface-sunken disabled:opacity-40",
        tone === "danger" ? "text-danger" : "text-fg-secondary"
      )}
    >
      <Icon className="size-[17px]" />
    </button>
  );
}

/** Small rounded label, e.g. "Sekundär", "Nur lesen", "aktiv". */
export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "violet";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-sunken text-fg-secondary",
    brand: "bg-brand-soft text-brand-ink",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    violet: "bg-[#f4f0ff] text-[#6d28d9] dark:bg-[#a78bfa]/15 dark:text-[#d3c4fe]",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
