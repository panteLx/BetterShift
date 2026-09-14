"use client";

import { ComponentProps, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Ellipsis,
  Hand,
  ListChecks,
  Plus,
  SlidersHorizontal,
  Tag,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ShiftPreset } from "@/lib/db/schema";
import { getShiftCode, groupPresetsByName, presetTime, shiftVars } from "@/lib/shift-display";
import { cn, isMultiSelectClick } from "@/lib/utils";

export function splitStampPresets(presets: ShiftPreset[]) {
  const { ungrouped, groups } = groupPresetsByName(presets);
  const ordered = [...ungrouped, ...groups.flatMap((group) => group.items)];
  return {
    primary: ordered.filter((p) => !p.isSecondary),
    secondary: ordered.filter((p) => p.isSecondary),
  };
}

/** Presets that get their own chip and number key 1–9; secondary ones sit under "Weitere". */
export function orderStampPresets(presets: ShiftPreset[]): ShiftPreset[] {
  return splitStampPresets(presets).primary;
}

/** Selecting a group arms every preset in it; an already fully-selected group disarms instead. */
function toggleGroupSelection(
  groupIds: string[],
  activeIds: Set<string>,
  onSelectPreset: (id: string, multiSelect: boolean) => void
) {
  const allSelected = groupIds.every((id) => activeIds.has(id));
  groupIds.forEach((id) => {
    if (allSelected || !activeIds.has(id)) onSelectPreset(id, true);
  });
}

type MoreVariant = "dock" | "compare" | "bar";

interface MoreChipProps extends ComponentProps<"button"> {
  variant: MoreVariant;
  count: number;
  /** Selected secondary presets; shown inline when there's exactly one. */
  active: ShiftPreset[];
  open: boolean;
}

function MoreChip({ variant, count, active, open, className, ...props }: MoreChipProps) {
  const t = useTranslations();
  const single = active.length === 1 ? active[0] : undefined;
  const countLabel = (
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
          active.length > 0
            ? "border-brand bg-brand-soft"
            : open
              ? "border-control bg-surface-sunken"
              : "border-line bg-surface-card",
          className
        )}
      >
        {single ? (
          <>
            <span
              className="shift-solid flex size-[22px] shrink-0 items-center justify-center rounded-[5px] text-[11px] font-bold"
              style={shiftVars(single.color)}
            >
              {getShiftCode(single.title)}
            </span>
            <span className="min-w-0">
              <span className="block max-w-[140px] truncate text-[13px] font-semibold text-brand-ink">
                {single.title}
              </span>
              <span className="block font-mono text-[11.5px] text-brand-ink">
                {presetTime(single, t("shift.allDayShift"))}
              </span>
            </span>
          </>
        ) : active.length > 1 ? (
          <>
            <span className="flex size-[22px] shrink-0 items-center justify-center rounded-[5px] bg-brand text-[11px] font-bold text-white">
              {active.length}
            </span>
            <span className="text-[13px] font-semibold text-brand-ink">
              {t("preset.secondary")}
            </span>
          </>
        ) : (
          <>
            <span className="flex size-[22px] shrink-0 items-center justify-center rounded-[5px] bg-surface-sunken text-fg-secondary">
              <Ellipsis className="size-3.5" />
            </span>
            <span className="text-[13px] font-semibold text-fg-strong">{countLabel}</span>
          </>
        )}
        <Chevron className={cn("size-4 shrink-0", active.length > 0 ? "text-brand-ink" : "text-fg-tertiary")} />
      </button>
    );
  }

  const dock = variant === "dock";
  const Chevron = dock ? ChevronUp : ChevronDown;
  const hasActive = active.length > 0;
  const tone = dock
    ? hasActive
      ? "bg-brand text-white"
      : cn("text-dock-ink hover:bg-white/10", open && "bg-white/10")
    : hasActive
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
      {single ? (
        <>
          <span className="size-[7px] shrink-0 rounded-full" style={{ backgroundColor: single.color }} />
          <span className="max-w-[140px] truncate">{single.title}</span>
        </>
      ) : active.length > 1 ? (
        <span className="whitespace-nowrap font-mono">{active.length}</span>
      ) : (
        countLabel
      )}
      <Chevron className="-mr-0.5 size-3.5 shrink-0 opacity-70" />
    </button>
  );
}

/** Secondary presets as rows; picking one toggles it (additively when multiSelect is on). */
function SecondaryPresetList({
  presets,
  selectedPresetIds,
  onPick,
  touch = false,
}: {
  presets: ShiftPreset[];
  selectedPresetIds: string[];
  onPick: (id: string, multiSelect: boolean) => void;
  touch?: boolean;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-px">
      {presets.map((preset) => {
        const active = selectedPresetIds.includes(preset.id);
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={active}
            onClick={(event) => onPick(preset.id, isMultiSelectClick(event))}
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
  selectedPresetIds: string[];
  onSelectPreset: (id: string | undefined, multiSelect?: boolean) => void;
  /** When on, picking a preset never closes the popover (stamp bar's multi-select toggle). */
  multiMode?: boolean;
}

/** Trailing "Weitere · N" chip that opens the secondary presets in a popover. */
export function MorePresets({
  variant,
  presets,
  selectedPresetIds,
  onSelectPreset,
  multiMode = false,
}: MorePresetsProps & { variant: "dock" | "compare" }) {
  const [open, setOpen] = useState(false);
  if (presets.length === 0) return null;
  const selectedSet = new Set(selectedPresetIds);
  const active = presets.filter((p) => selectedSet.has(p.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <MoreChip variant={variant} count={presets.length} active={active} open={open} />
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
          selectedPresetIds={selectedPresetIds}
          onPick={(id, clickMultiSelect) => {
            const multiSelect = multiMode || clickMultiSelect;
            onSelectPreset(id, multiSelect);
            if (!multiSelect) setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

interface StampProps {
  presets: ShiftPreset[];
  selectedPresetIds: string[];
  onSelectPreset: (id: string | undefined, multiSelect?: boolean) => void;
  onManage: () => void;
}

/** Toggle button that switches primary chips from replace-on-click to add/remove-on-click. */
export function MultiSelectToggle({
  variant,
  active,
  onClick,
}: {
  variant: "dock" | "bar" | "compare";
  active: boolean;
  onClick: () => void;
}) {
  const t = useTranslations();
  const label = t("calendarView.multiSelect");
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "flex shrink-0 items-center justify-center transition-colors",
        variant === "dock"
          ? "size-[30px] rounded-lg"
          : variant === "bar"
            ? "size-9 rounded-lg"
            : "size-7 rounded-[7px]",
        active
          ? variant === "compare"
            ? "bg-brand-soft text-brand-ink"
            : "bg-brand text-white"
          : variant === "dock"
            ? "text-fg-faint hover:bg-white/10 hover:text-white"
            : variant === "bar"
              ? "text-fg-secondary hover:bg-surface-sunken"
              : "text-fg-tertiary hover:bg-surface-sunken"
      )}
    >
      <ListChecks
        className={cn(
          variant === "bar" ? "size-[18px]" : variant === "dock" ? "size-[15px]" : "size-3.5"
        )}
      />
    </button>
  );
}

export function StampDock({ presets, selectedPresetIds, onSelectPreset, onManage }: StampProps) {
  const t = useTranslations();
  const { primary, secondary } = splitStampPresets(presets);
  const groups = useMemo(() => groupPresetsByName(presets).groups, [presets]);
  const [multiMode, setMultiMode] = useState(false);
  const activeIds = new Set(selectedPresetIds);

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
            className="flex h-[30px] shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-dock-ink hover:bg-white/10"
          >
            <Plus className="size-3.5" />
            {t("calendarView.createPreset")}
          </button>
        )}
        {primary.map((preset, index) => {
          const active = activeIds.has(preset.id);
          const key = index < 9 ? String(index + 1) : null;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={(event) =>
                onSelectPreset(preset.id, multiMode || isMultiSelectClick(event))
              }
              title={
                preset.isAllDay
                  ? preset.title
                  : `${preset.title} · ${preset.startTime}–${preset.endTime}`
              }
              className={cn(
                "flex h-[30px] shrink-0 items-center gap-[7px] rounded-lg px-2.5 text-[12.5px] font-medium transition-colors",
                active ? "bg-brand text-white" : "text-dock-ink hover:bg-white/10"
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
                    active ? "text-white" : "text-dock-ink"
                  )}
                >
                  {key}
                </kbd>
              )}
            </button>
          );
        })}
        {groups.map((group) => {
          const ids = group.items.map((p) => p.id);
          const allSelected = ids.every((id) => activeIds.has(id));
          return (
            <button
              key={group.name}
              type="button"
              aria-pressed={allSelected}
              onClick={() => toggleGroupSelection(ids, activeIds, onSelectPreset)}
              title={t("preset.selectGroupHint")}
              className={cn(
                "flex h-[30px] shrink-0 items-center gap-[7px] rounded-lg border border-dashed px-2.5 text-[12.5px] font-medium transition-colors",
                allSelected
                  ? "border-white/40 bg-brand text-white"
                  : "border-white/15 text-dock-ink hover:bg-white/10"
              )}
            >
              <Tag className="size-3" />
              <span className="max-w-[110px] truncate">{group.name}</span>
              <span className="opacity-70">({group.items.length})</span>
            </button>
          );
        })}
      </div>
      <MorePresets
        variant="dock"
        presets={secondary}
        selectedPresetIds={selectedPresetIds}
        onSelectPreset={onSelectPreset}
        multiMode={multiMode}
      />
      <MultiSelectToggle variant="dock" active={multiMode} onClick={() => setMultiMode((m) => !m)} />
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
  selectedPresetIds,
  onSelectPreset,
  onManage,
}: StampProps) {
  const t = useTranslations();
  const [moreOpen, setMoreOpen] = useState(false);
  const [multiMode, setMultiMode] = useState(false);
  const { primary, secondary } = splitStampPresets(presets);
  const groups = useMemo(() => groupPresetsByName(presets).groups, [presets]);
  const activeIds = new Set(selectedPresetIds);
  const activePresets = presets.filter((p) => activeIds.has(p.id));
  const activeSecondary = activePresets.filter((p) => p.isSecondary);
  // Otherwise the list would pop up by itself once nothing secondary is armed anymore
  if (moreOpen && secondary.length === 0) setMoreOpen(false);

  return (
    <div className="border-t border-line bg-surface-panel">
      {moreOpen && (
        <div className="px-3 pt-2.5">
          <div className="rounded-[10px] border border-line bg-surface-card p-1">
            <SecondaryPresetList
              touch
              presets={secondary}
              selectedPresetIds={selectedPresetIds}
              onPick={(id, clickMultiSelect) => {
                const multiSelect = multiMode || clickMultiSelect;
                onSelectPreset(id, multiSelect);
                if (!multiSelect) setMoreOpen(false);
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
            const on = activeIds.has(preset.id);
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={on}
                onClick={() => onSelectPreset(preset.id, multiMode)}
                className={cn(
                  "flex h-12 shrink-0 items-center gap-2.5 rounded-[10px] border py-1.5 pl-2 pr-3 text-left transition-colors",
                  on
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-surface-card"
                )}
              >
                <span
                  className="shift-solid flex size-[22px] shrink-0 items-center justify-center rounded-[5px] text-[11px] font-bold"
                  style={shiftVars(preset.color)}
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
                    {presetTime(preset, t("shift.allDayShift"))}
                  </span>
                </span>
              </button>
            );
          })}
          {groups.map((group) => {
            const ids = group.items.map((p) => p.id);
            const allSelected = ids.every((id) => activeIds.has(id));
            return (
              <button
                key={group.name}
                type="button"
                aria-pressed={allSelected}
                onClick={() => toggleGroupSelection(ids, activeIds, onSelectPreset)}
                className={cn(
                  "flex h-12 shrink-0 items-center gap-2 rounded-[10px] border border-dashed px-3 text-left transition-colors",
                  allSelected
                    ? "border-brand bg-brand-soft text-brand-ink"
                    : "border-control text-fg-secondary"
                )}
              >
                <Tag className="size-3.5 shrink-0" />
                <span className="text-[13px] font-medium">
                  {group.name} ({group.items.length})
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
        <MultiSelectToggle variant="bar" active={multiMode} onClick={() => setMultiMode((m) => !m)} />
      </div>
      {activePresets.length > 0 && (
        <div className="flex items-center gap-2 px-4 pb-2.5 text-[12px] leading-snug text-fg-secondary">
          <Hand className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {activePresets.length === 1
              ? t("calendarView.stampHint", { title: activePresets[0].title })
              : t("calendarView.stampHintMulti", { count: activePresets.length })}
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
