"use client";

import { useTranslations } from "next-intl";
import { Plus, SlidersHorizontal, Hand } from "lucide-react";
import { ShiftPreset } from "@/lib/db/schema";
import { getShiftCode } from "@/lib/shift-display";
import { cn } from "@/lib/utils";

/** Primary presets first; the dock numbers them 1–9 in this order. */
export function orderStampPresets(presets: ShiftPreset[]): ShiftPreset[] {
  return [...presets.filter((p) => !p.isSecondary), ...presets.filter((p) => p.isSecondary)];
}

interface StampProps {
  presets: ShiftPreset[];
  selectedPresetId: string | undefined;
  onSelectPreset: (id: string | undefined) => void;
  onManage: () => void;
}

export function StampDock({ presets, selectedPresetId, onSelectPreset, onManage }: StampProps) {
  const t = useTranslations();
  const ordered = orderStampPresets(presets);

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
        {ordered.length === 0 && (
          <button
            type="button"
            onClick={onManage}
            className="flex h-[30px] shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-[#e4e7ec] hover:bg-white/10"
          >
            <Plus className="size-3.5" />
            {t("calendarView.createPreset")}
          </button>
        )}
        {ordered.map((preset, index) => {
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
  const ordered = orderStampPresets(presets);
  const active = ordered.find((p) => p.id === selectedPresetId);

  return (
    <div className="border-t border-line bg-surface-panel">
      <div className="flex items-center gap-2 py-2.5 pl-3 pr-3">
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          {ordered.length === 0 && (
            <button
              type="button"
              onClick={onManage}
              className="flex h-12 shrink-0 items-center gap-2 rounded-[10px] border border-dashed border-control px-3 text-[13px] font-medium text-fg-secondary"
            >
              <Plus className="size-4" />
              {t("calendarView.createPreset")}
            </button>
          )}
          {ordered.map((preset) => {
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
