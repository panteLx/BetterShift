"use client";

import { useTranslations } from "next-intl";
import { PanelBody, PanelDialog } from "@/components/panel-dialog";
import { ChoiceChips, ColorSwatches, Field, SectionLabel, ToggleRow } from "@/components/form-kit";
import { useViewSettings } from "@/hooks/useViewSettings";
import { cn } from "@/lib/utils";

export type ViewSettingsState = ReturnType<typeof useViewSettings>;

type LimitValue = "1" | "2" | "3" | "4" | "all";
const LIMITS: LimitValue[] = ["1", "2", "3", "4", "all"];

function toLimit(value: number | null): LimitValue {
  if (value === null) return "all";
  return (LIMITS.includes(String(value) as LimitValue) ? String(value) : "3") as LimitValue;
}

function LimitControl({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
}) {
  const t = useTranslations();
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[9px] bg-surface-sunken p-[3px]">
      {LIMITS.map((limit) => {
        const active = toLimit(value) === limit;
        return (
          <button
            key={limit}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(limit === "all" ? null : Number(limit))}
            className={cn(
              "h-7 min-w-8 rounded-md px-2 font-mono text-[12.5px] font-medium",
              active
                ? "bg-surface-card font-semibold text-fg-strong shadow-segment dark:bg-control"
                : "text-fg-secondary"
            )}
          >
            {limit === "all" ? t("view.showAll") : limit}
          </button>
        );
      })}
    </div>
  );
}

/** Per-device display preferences; they live in localStorage, not in the calendar. */
export function ViewPanel({ settings }: { settings: ViewSettingsState }) {
  const t = useTranslations();
  const weekdays = [
    { day: 1, label: t("view.monday") },
    { day: 2, label: t("view.tuesday") },
    { day: 3, label: t("view.wednesday") },
    { day: 4, label: t("view.thursday") },
    { day: 5, label: t("view.friday") },
    { day: 6, label: t("view.saturday") },
    { day: 0, label: t("view.sunday") },
  ];

  const setWeekdays = (days: number[]) => {
    settings.handleHighlightedWeekdaysChange(days);
    settings.handleHighlightWeekendsChange(days.includes(0) && days.includes(6));
  };

  return (
    <PanelBody>
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <SectionLabel className="mb-0">{t("view.density")}</SectionLabel>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-fg-strong">{t("view.shiftsPerDay")}</div>
              <div className="text-[12.5px] text-fg-secondary">{t("view.shiftsPerDayHint")}</div>
            </div>
            <LimitControl
              label={t("view.shiftsPerDay")}
              value={settings.shiftsPerDay}
              onChange={settings.handleShiftsPerDayChange}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-fg-strong">
                {t("view.externalShiftsPerDay")}
              </div>
              <div className="text-[12.5px] text-fg-secondary">
                {t("view.externalShiftsPerDayHint")}
              </div>
            </div>
            <LimitControl
              label={t("view.externalShiftsPerDay")}
              value={settings.externalShiftsPerDay}
              onChange={settings.handleExternalShiftsPerDayChange}
            />
          </div>
          <ToggleRow
            id="view-notes"
            title={t("view.showNotes")}
            description={t("view.showNotesHint")}
            checked={settings.showShiftNotes}
            onCheckedChange={settings.handleShowShiftNotesChange}
          />
          <ToggleRow
            id="view-titles"
            title={t("view.showFullTitles")}
            description={t("view.showFullTitlesHint")}
            checked={settings.showFullTitles}
            onCheckedChange={settings.handleShowFullTitlesChange}
          />
          <ToggleRow
            id="view-dock"
            title={t("view.showPresetBar")}
            description={t("view.showPresetBarHint")}
            checked={!settings.hidePresetHeader}
            onCheckedChange={(show) => settings.handleHidePresetHeaderChange(!show)}
          />
        </section>

        <section className="flex flex-col gap-3 border-t border-line pt-5">
          <SectionLabel className="mb-0">{t("view.sortOptions")}</SectionLabel>
          <Field label={t("view.sortBy")}>
            <ChoiceChips
              value={settings.shiftSortType}
              onChange={settings.handleShiftSortTypeChange}
              options={[
                { value: "startTime", label: t("view.sortByStartTime") },
                { value: "createdAt", label: t("view.sortByCreatedAt") },
                { value: "title", label: t("view.sortByTitle") },
              ]}
            />
          </Field>
          <Field label={t("view.sortOrder")}>
            <ChoiceChips
              value={settings.shiftSortOrder}
              onChange={settings.handleShiftSortOrderChange}
              options={[
                { value: "asc", label: t("view.sortOrderAsc") },
                { value: "desc", label: t("view.sortOrderDesc") },
              ]}
            />
          </Field>
          <ToggleRow
            id="view-combined"
            title={t("view.combinedSort")}
            description={t("view.combinedSortHint")}
            checked={settings.combinedSortMode}
            onCheckedChange={settings.handleCombinedSortModeChange}
          />
        </section>

        <section className="flex flex-col gap-3 border-t border-line pt-5">
          <SectionLabel className="mb-0">{t("view.dayHighlighting")}</SectionLabel>
          <ToggleRow
            id="view-weekends"
            title={t("view.highlightWeekends")}
            description={t("view.highlightWeekendsHint")}
            checked={settings.highlightedWeekdays.includes(0) && settings.highlightedWeekdays.includes(6)}
            onCheckedChange={(checked) =>
              setWeekdays(
                checked
                  ? Array.from(new Set([...settings.highlightedWeekdays, 0, 6]))
                  : settings.highlightedWeekdays.filter((d) => d !== 0 && d !== 6)
              )
            }
          />
          <Field label={t("view.customWeekdays")} hint={t("view.customWeekdaysHint")}>
            <div className="grid grid-cols-7 gap-1.5">
              {weekdays.map(({ day, label }) => {
                const selected = settings.highlightedWeekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={selected}
                    title={label}
                    onClick={() =>
                      setWeekdays(
                        selected
                          ? settings.highlightedWeekdays.filter((d) => d !== day)
                          : [...settings.highlightedWeekdays, day]
                      )
                    }
                    className={cn(
                      "h-9 rounded-lg border text-[12.5px] font-semibold",
                      selected
                        ? "border-brand bg-brand-soft text-brand-ink"
                        : "border-line bg-surface-card text-fg-secondary"
                    )}
                  >
                    {label.slice(0, 2)}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={t("view.highlightColor")}>
            <ColorSwatches
              size="sm"
              value={settings.highlightColor}
              onChange={settings.handleHighlightColorChange}
            />
          </Field>
        </section>
      </div>
    </PanelBody>
  );
}

export function ViewSettingsSheet({
  open,
  onOpenChange,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ViewSettingsState;
}) {
  const t = useTranslations();
  return (
    <PanelDialog
      bare
      open={open}
      onOpenChange={onOpenChange}
      title={t("view.settingsTitle")}
      description={t("view.settingsDescription")}
    >
      <ViewPanel settings={settings} />
    </PanelDialog>
  );
}
