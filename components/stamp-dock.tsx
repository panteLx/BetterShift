"use client";

import { ComponentProps, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Ellipsis,
  Hand,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ShiftPreset } from "@/lib/db/schema";
import { getShiftCode } from "@/lib/shift-display";
import { cn } from "@/lib/utils";

export function splitStampPresets(presets: ShiftPreset[]) {
  return {
    primary: presets.filter((p) => !p.isSecondary),
    secondary: presets.filter((p) => p.isSecondary),
  };
}

/** Presets that get their own chip and number key 1–9; secondary ones sit under "Weitere". */
export function orderStampPresets(presets: ShiftPreset[]): ShiftPreset[] {
  return splitStampPresets(presets).primary;
}

function presetTime(preset: ShiftPreset, allDayLabel: string) {
  return preset.isAllDay
    ? allDayLabel
    : `${preset.startTime.slice(0, 5)} – ${preset.endTime.slice(0, 5)}`;
}

type MoreVariant = "dock" | "compare" | "bar";

interface MoreChipProps extends ComponentProps<"button"> {
  variant: MoreVariant;
  count: number;
  /** The armed secondary preset; the chip shows it in place so the row keeps its layout. */
  active: ShiftPreset | undefined;
  open: boolean;
}

function MoreChip({ variant, count, active, open, className, ...props }: MoreChipProps) {
  const t = useTranslations();
  const label = (
    <span className="whitespace-nowrap">
      {t("preset.secondary")}
      <span className="opacity-60"> · </span>
      <span className="font-mono">{count}</span>
    </span>
  );

  if (variant === "bar") {
    const Chevron = open ? ChevronDown : ChevronUp;
    return (
      <button
        type="button"
        aria-expanded={open}
        {...props}
        className={cn(
          "flex h-12 shrink-0 items-center gap-2.5 rounded-[10px] border py-1.5 pl-2 pr-2.5 text-left transition-colors",
          active
            ? "border-brand bg-brand-soft"
            : open
              ? "border-control bg-surface-sunken"
              : "border-line bg-surface-card",
          className
        )}
      >
        {active ? (
          <>
            <span
              className="shift-solid flex size-[22px] shrink-0 items-center justify-center rounded-[5px] text-[11px] font-bold"
              style={{ "--shift": active.color } as React.CSSProperties}
            >
              {getShiftCode(active.title)}
            </span>
            <span className="min-w-0">
              <span className="block max-w-[140px] truncate text-[13px] font-semibold text-brand-ink">
                {active.title}
              </span>
              <span className="block font-mono text-[11.5px] text-brand-ink">
                {presetTime(active, t("shift.allDayShift"))}
              </span>
            </span>
          </>
        ) : (
          <>
            <span className="flex size-[22px] shrink-0 items-center justify-center rounded-[5px] bg-surface-sunken text-fg-secondary">
              <Ellipsis className="size-3.5" />
            </span>
            <span className="text-[13px] font-semibold text-fg-strong">{label}</span>
          </>
        )}
        <Chevron className={cn("size-4 shrink-0", active ? "text-brand-ink" : "text-fg-tertiary")} />
      </button>
    );
  }

  const dock = variant === "dock";
  const Chevron = dock ? ChevronUp : ChevronDown;
  const tone = dock
    ? active
      ? "bg-brand text-white"
      : cn("text-[#e4e7ec] hover:bg-white/10", open && "bg-white/10")
    : active
      ? "border-brand bg-brand-soft text-brand-ink"
      : cn(
          "border-line bg-surface-card text-fg-body hover:bg-surface-panel",
          open && "bg-surface-panel"
        );
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "flex shrink-0 items-center gap-[7px] px-2.5 text-[12.5px] font-medium transition-colors",
        dock ? "h-[30px] rounded-lg" : "h-7 rounded-[7px] border",
        tone,
        className
      )}
    >
      {active ? (
        <>
          <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: active.color }} />
          <span className="max-w-[140px] truncate">{active.title}</span>
        </>
      ) : (
        label
      )}
      <Chevron className="-mr-0.5 size-3.5 shrink-0 opacity-70" />
    </button>
  );
}

/** Secondary presets as rows; picking the armed one disarms it. */
function SecondaryPresetList({
  presets,
  selectedPresetId,
  onPick,
  touch = false,
}: {
  presets: ShiftPreset[];
  selectedPresetId: string | undefined;
  onPick: (id: string | undefined) => void;
  touch?: boolean;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-px">
      {presets.map((preset) => {
        const active = preset.id === selectedPresetId;
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(active ? undefined : preset.id)}
            className={cn(
              "flex items-center gap-2.5 rounded-[8px] px-2.5 text-left outline-none transition-colors",
              touch ? "h-11 text-[14px]" : "h-9 text-[13px]",
              active
                ? "bg-brand-soft text-brand-ink"
                : "text-fg-body hover:bg-surface-sunken focus-visible:bg-surface-sunken"
            )}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: preset.color }} />
            <span className="min-w-0 flex-1 truncate font-medium">{preset.title}</span>
            <span
              className={cn(
                "shrink-0 font-mono text-[12px]",
                active ? "text-brand-ink" : "text-fg-tertiary"
              )}
            >
              {presetTime(preset, t("presetSheet.allDayShort"))}
            </span>
            <Check className={cn("size-3.5 shrink-0", !active && "invisible")} />
          </button>
        );
      })}
    </div>
  );
}

interface MorePresetsProps {
  /** Secondary presets only. */
  presets: ShiftPreset[];
  selectedPresetId: string | undefined;
  onSelectPreset: (id: string | undefined) => void;
}

/** Trailing "Weitere · N" chip that opens the secondary presets in a popover. */
export function MorePresets({
  variant,
  presets,
  selectedPresetId,
  onSelectPreset,
}: MorePresetsProps & { variant: "dock" | "compare" }) {
  const [open, setOpen] = useState(false);
  if (presets.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <MoreChip
          variant={variant}
          count={presets.length}
          active={presets.find((p) => p.id === selectedPresetId)}
          open={open}
        />
      </PopoverTrigger>
      <PopoverContent
        side={variant === "dock" ? "top" : "bottom"}
        align={variant === "dock" ? "end" : "start"}
        sideOffset={8}
        collisionPadding={12}
        className="w-[260px] rounded-[12px] border-line bg-surface-card p-1"
      >
        <SecondaryPresetList
          presets={presets}
          selectedPresetId={selectedPresetId}
          onPick={(id) => {
            onSelectPreset(id);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

interface StampProps {
  presets: ShiftPreset[];
  selectedPresetId: string | undefined;
  onSelectPreset: (id: string | undefined) => void;
  onManage: () => void;
}

export function StampDock({ presets, selectedPresetId, onSelectPreset, onManage }: StampProps) {
  const t = useTranslations();
  const { primary, secondary } = splitStampPresets(presets);

  return (
    <div
      role="toolbar"
      aria-label={t("calendarView.stamp")}
      className="absolute bottom-5 left-1/2 z-20 flex max-w-[calc(100%-36px)] -translate-x-1/2 items-center gap-1.5 rounded-xl border border-transparent bg-dock p-1.5 shadow-dock dark:border-dock-line"
    >
      <span className="shrink-0 pl-2 pr-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-faint dark:text-fg-tertiary">
        {t("calendarView.stamp")}
      </span>
      <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {presets.length === 0 && (
          <button
            type="button"
            onClick={onManage}
            className="flex h-[30px] shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-[#e4e7ec] hover:bg-white/10"
          >
            <Plus className="size-3.5" />
            {t("calendarView.createPreset")}
          </button>
        )}
        {primary.map((preset, index) => {
          const active = preset.id === selectedPresetId;
          const key = index < 9 ? String(index + 1) : null;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelectPreset(active ? undefined : preset.id)}
              title={
                preset.isAllDay
                  ? preset.title
                  : `${preset.title} · ${preset.startTime}–${preset.endTime}`
              }
              className={cn(
                "flex h-[30px] shrink-0 items-center gap-[7px] rounded-lg px-2.5 text-[12.5px] font-medium transition-colors",
                active ? "bg-brand text-white" : "text-[#e4e7ec] hover:bg-white/10"
              )}
            >
              <span
                className="size-[7px] shrink-0 rounded-full"
                style={{ backgroundColor: preset.color }}
              />
              <span className="max-w-[140px] truncate">{preset.title}</span>
              {key && (
                <kbd
                  className={cn(
                    "rounded-[4px] bg-white/18 px-1 py-px font-mono text-[10px] font-normal",
                    active ? "text-white" : "text-[#e4e7ec]"
                  )}
                >
                  {key}
                </kbd>
              )}
            </button>
          );
        })}
      </div>
      <MorePresets
        variant="dock"
        presets={secondary}
        selectedPresetId={selectedPresetId}
        onSelectPreset={onSelectPreset}
      />
      <div className="mx-0.5 h-[22px] w-px shrink-0 bg-dock-line" />
      <button
        type="button"
        onClick={onManage}
        title={t("calendarView.managePresets")}
        aria-label={t("calendarView.managePresets")}
        className="flex size-[30px] shrink-0 items-center justify-center rounded-lg text-fg-faint transition-colors hover:bg-white/10 hover:text-white"
      >
        <SlidersHorizontal className="size-[15px]" />
      </button>
    </div>
  );
}

export function MobilePresetBar({
  presets,
  selectedPresetId,
  onSelectPreset,
  onManage,
  onAddShift,
}: StampProps & { onAddShift: () => void }) {
  const t = useTranslations();
  const [moreOpen, setMoreOpen] = useState(false);
  const { primary, secondary } = splitStampPresets(presets);
  const active = presets.find((p) => p.id === selectedPresetId);
  const activeSecondary = active?.isSecondary ? active : undefined;
  // Otherwise the list would pop up by itself once a preset is marked secondary again
  if (moreOpen && secondary.length === 0) setMoreOpen(false);

  return (
    <div className="border-t border-line bg-surface-panel">
      {moreOpen && (
        <div className="px-3 pt-2.5">
          <div className="rounded-[10px] border border-line bg-surface-card p-1">
            <SecondaryPresetList
              touch
              presets={secondary}
              selectedPresetId={selectedPresetId}
              onPick={(id) => {
                onSelectPreset(id);
                setMoreOpen(false);
              }}
            />
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 py-2.5 pl-3 pr-3">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          {presets.length === 0 && (
            <button
              type="button"
              onClick={onManage}
              className="flex h-12 shrink-0 items-center gap-2 rounded-[10px] border border-dashed border-control px-3 text-[13px] font-medium text-fg-secondary"
            >
              <Plus className="size-4" />
              {t("calendarView.createPreset")}
            </button>
          )}
          {primary.map((preset) => {
            const on = preset.id === selectedPresetId;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={on}
                onClick={() => onSelectPreset(on ? undefined : preset.id)}
                className={cn(
                  "flex h-12 shrink-0 items-center gap-2.5 rounded-[10px] border py-1.5 pl-2 pr-3 text-left transition-colors",
                  on
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-surface-card"
                )}
              >
                <span
                  className="shift-solid flex size-[22px] shrink-0 items-center justify-center rounded-[5px] text-[11px] font-bold"
                  style={{ "--shift": preset.color } as React.CSSProperties}
                >
                  {getShiftCode(preset.title)}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block max-w-[140px] truncate text-[13px] font-semibold",
                      on ? "text-brand-ink" : "text-fg-strong"
                    )}
                  >
                    {preset.title}
                  </span>
                  <span
                    className={cn(
                      "block font-mono text-[11.5px]",
                      on ? "text-brand-ink" : "text-fg-tertiary"
                    )}
                  >
                    {preset.isAllDay
                      ? t("shift.allDayShift")
                      : `${preset.startTime} – ${preset.endTime}`}
                  </span>
                </span>
              </button>
            );
          })}
          {secondary.length > 0 && (
            <MoreChip
              variant="bar"
              count={secondary.length}
              active={activeSecondary}
              open={moreOpen}
              onClick={() => setMoreOpen((current) => !current)}
            />
          )}
        </div>
        <button
          type="button"
          onClick={onAddShift}
          aria-label={t("calendarView.addShiftManually")}
          className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-brand text-white shadow-[0_8px_18px_-6px_rgb(37_99_235/0.55)]"
        >
          <Plus className="size-6" />
        </button>
      </div>
      {active && (
        <div className="flex items-center gap-2 px-4 pb-2.5 text-[12px] leading-snug text-fg-secondary">
          <Hand className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {t("calendarView.stampHint", { title: active.title })}
          </span>
          <button
            type="button"
            onClick={onManage}
            className="shrink-0 font-semibold text-brand-ink"
          >
            {t("calendarView.manage")}
          </button>
        </div>
      )}
    </div>
  );
}
