"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Info, Lock, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelBody, PanelDialog, PanelFooter } from "@/components/panel-dialog";
import {
  ChoiceChips,
  ColorSwatches,
  Field,
  InfoNote,
  SectionLabel,
  ToggleRow,
} from "@/components/form-kit";
import { useViewSettings } from "@/hooks/useViewSettings";
import { useCalendars } from "@/hooks/useCalendars";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import {
  CalendarViewSettings,
  PersonalViewSettings,
  calendarViewSettingsEqual,
  pickCalendarViewSettings,
  sanitizeCalendarViewSettings,
} from "@/lib/view-settings";
import { cn } from "@/lib/utils";

export type ViewSettingsState = ReturnType<typeof useViewSettings>;

type LimitValue = "1" | "2" | "3" | "4" | "all";
const LIMITS: LimitValue[] = ["1", "2", "3", "4", "all"];

// Handoff rule: locked controls keep their contrast and only lose the fill
const LOCKED_FIELDS =
  "[&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-100 [&_[role=radio][aria-checked=true]:disabled]:bg-transparent [&_[role=switch]:disabled]:border-control [&_[role=switch]:disabled]:bg-surface-sunken";

function toLimit(value: number | null): LimitValue {
  if (value === null) return "all";
  return (LIMITS.includes(String(value) as LimitValue) ? String(value) : "3") as LimitValue;
}

function LimitControl({
  value,
  onChange,
  label,
  disabled,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  disabled?: boolean;
}) {
  const t = useTranslations();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex rounded-[9px] p-[3px]",
        disabled ? "ring-1 ring-inset ring-line" : "bg-surface-sunken"
      )}
    >
      {LIMITS.map((limit) => {
        const active = toLimit(value) === limit;
        return (
          <button
            key={limit}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(limit === "all" ? null : Number(limit))}
            className={cn(
              "h-7 min-w-8 rounded-md px-2 font-mono text-[12.5px] font-medium",
              active
                ? disabled
                  ? "font-semibold text-fg-strong ring-1 ring-inset ring-control"
                  : "bg-surface-card font-semibold text-fg-strong shadow-segment dark:bg-control"
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

/** Field UI shared by the personal view and a calendar's own view. */
function ViewFields({
  value,
  onChange,
  disabled = false,
  stampBar,
}: {
  value: CalendarViewSettings;
  onChange: (patch: Partial<CalendarViewSettings>) => void;
  disabled?: boolean;
  /** Only the personal view carries the stamp-bar toggle */
  stampBar?: { checked: boolean; onChange: (checked: boolean) => void };
}) {
  const t = useTranslations();
  const id = useId();
  const weekdays = [
    { day: 1, label: t("view.monday") },
    { day: 2, label: t("view.tuesday") },
    { day: 3, label: t("view.wednesday") },
    { day: 4, label: t("view.thursday") },
    { day: 5, label: t("view.friday") },
    { day: 6, label: t("view.saturday") },
    { day: 0, label: t("view.sunday") },
  ];
  const days = value.highlightedWeekdays;

  return (
    <div className={cn("flex flex-col gap-6", disabled && LOCKED_FIELDS)}>
      <section className="flex flex-col gap-3">
        <SectionLabel className="mb-0">{t("view.density")}</SectionLabel>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-fg-strong">{t("view.shiftsPerDay")}</div>
            <div className="text-[12.5px] text-fg-secondary">{t("view.shiftsPerDayHint")}</div>
          </div>
          <LimitControl
            label={t("view.shiftsPerDay")}
            value={value.shiftsPerDay}
            onChange={(shiftsPerDay) => onChange({ shiftsPerDay })}
            disabled={disabled}
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
            value={value.externalShiftsPerDay}
            onChange={(externalShiftsPerDay) => onChange({ externalShiftsPerDay })}
            disabled={disabled}
          />
        </div>
        <ToggleRow
          id={`${id}-notes`}
          title={t("view.showNotes")}
          description={t("view.showNotesHint")}
          checked={value.showShiftNotes}
          onCheckedChange={(showShiftNotes) => onChange({ showShiftNotes })}
          disabled={disabled}
        />
        <ToggleRow
          id={`${id}-titles`}
          title={t("view.showFullTitles")}
          description={t("view.showFullTitlesHint")}
          checked={value.showFullTitles}
          onCheckedChange={(showFullTitles) => onChange({ showFullTitles })}
          disabled={disabled}
        />
        {stampBar && (
          <ToggleRow
            id={`${id}-dock`}
            title={t("view.showPresetBar")}
            description={t("view.showPresetBarHint")}
            checked={stampBar.checked}
            onCheckedChange={stampBar.onChange}
            disabled={disabled}
          />
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <SectionLabel className="mb-0">{t("view.sortOptions")}</SectionLabel>
        <Field label={t("view.sortBy")}>
          <ChoiceChips
            value={value.sortType}
            onChange={(sortType) => onChange({ sortType })}
            disabled={disabled}
            options={[
              { value: "startTime", label: t("view.sortByStartTime") },
              { value: "createdAt", label: t("view.sortByCreatedAt") },
              { value: "title", label: t("view.sortByTitle") },
            ]}
          />
        </Field>
        <Field label={t("view.sortOrder")}>
          <ChoiceChips
            value={value.sortOrder}
            onChange={(sortOrder) => onChange({ sortOrder })}
            disabled={disabled}
            options={[
              { value: "asc", label: t("view.sortOrderAsc") },
              { value: "desc", label: t("view.sortOrderDesc") },
            ]}
          />
        </Field>
        <ToggleRow
          id={`${id}-combined`}
          title={t("view.combinedSort")}
          description={t("view.combinedSortHint")}
          checked={value.combinedSort}
          onCheckedChange={(combinedSort) => onChange({ combinedSort })}
          disabled={disabled}
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <SectionLabel className="mb-0">{t("view.dayHighlighting")}</SectionLabel>
        <ToggleRow
          id={`${id}-weekends`}
          title={t("view.highlightWeekends")}
          description={t("view.highlightWeekendsHint")}
          checked={days.includes(0) && days.includes(6)}
          onCheckedChange={(checked) =>
            onChange({
              highlightedWeekdays: checked
                ? Array.from(new Set([...days, 0, 6]))
                : days.filter((d) => d !== 0 && d !== 6),
            })
          }
          disabled={disabled}
        />
        <Field label={t("view.customWeekdays")} hint={t("view.customWeekdaysHint")}>
          <div className="grid grid-cols-7 gap-1.5">
            {weekdays.map(({ day, label }) => {
              const selected = days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={selected}
                  title={label}
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      highlightedWeekdays: selected
                        ? days.filter((d) => d !== day)
                        : [...days, day],
                    })
                  }
                  className={cn(
                    "h-9 rounded-lg border text-[12.5px] font-semibold",
                    selected ? "border-brand text-brand-ink" : "border-line text-fg-secondary",
                    !disabled && (selected ? "bg-brand-soft" : "bg-surface-card")
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
            value={value.highlightColor}
            onChange={(highlightColor) => onChange({ highlightColor })}
            disabled={disabled}
          />
        </Field>
      </section>
    </div>
  );
}

/**
 * Settings section for a calendar's own view. Off by default; while off,
 * everyone with access sees their personal view instead.
 */
export function CalendarViewPanel({
  calendarId,
  personal,
  onClose,
  onCancel,
  onDirtyChange,
}: {
  calendarId: string;
  personal: PersonalViewSettings;
  onClose: () => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const t = useTranslations();
  const id = useId();
  const { calendars, updateCalendar } = useCalendars();
  const { canManage } = useCalendarPermission(calendarId);
  const calendar = calendars.find((c) => c.id === calendarId);
  const saved = calendar?.viewSettings ? sanitizeCalendarViewSettings(calendar.viewSettings) : null;
  const personalFields = pickCalendarViewSettings(personal);

  const [enabled, setEnabled] = useState(!!saved);
  const [draft, setDraft] = useState<CalendarViewSettings>(() => saved ?? personalFields);
  const [saving, setSaving] = useState(false);

  const dirty =
    !!calendar &&
    canManage &&
    (enabled !== !!saved || (!!saved && enabled && !calendarViewSettingsEqual(draft, saved)));

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const toggle = (on: boolean) => {
    // Turning it on starts from the saved view, or from the personal one the first time
    if (on) setDraft(saved ?? personalFields);
    setEnabled(on);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateCalendar(calendarId, { viewSettings: enabled ? draft : null });
      onClose();
    } catch {
      // updateCalendar already reported the error
    } finally {
      setSaving(false);
    }
  };

  const editable = canManage && enabled;
  const shown = canManage ? (enabled ? draft : personalFields) : (saved ?? personalFields);
  const ownView = canManage ? enabled : !!saved;

  return (
    <>
      <PanelBody>
        <div className="flex flex-col gap-5">
          <div className={cn("flex flex-col gap-3", !canManage && LOCKED_FIELDS)}>
            <ToggleRow
              id={`${id}-own`}
              title={t("view.calendarOwn")}
              description={t("view.calendarOwnHint")}
              checked={ownView}
              onCheckedChange={toggle}
              disabled={!canManage}
            />
            {ownView && !canManage && (
              <InfoNote icon={Lock}>{t("view.calendarLocked")}</InfoNote>
            )}
            {!ownView && <InfoNote icon={UserRound}>{t("view.calendarOffNote")}</InfoNote>}
          </div>
          <div className="border-t border-line pt-5">
            <ViewFields
              value={shown}
              onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
              disabled={!editable}
            />
          </div>
        </div>
      </PanelBody>
      {canManage && (
        <PanelFooter>
          <p className="hidden min-w-0 flex-1 text-[13px] text-fg-secondary lg:block">
            {t("settings.appliesToAll")}
          </p>
          <Button
            variant="outline"
            className="h-10 flex-1 font-semibold lg:flex-none lg:px-4"
            onClick={onCancel}
          >
            {t("common.cancel")}
          </Button>
          <Button
            className="h-10 flex-1 font-semibold lg:flex-none lg:px-4"
            disabled={!dirty || saving}
            onClick={save}
          >
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </PanelFooter>
      )}
    </>
  );
}

/** Body of "Meine Ansicht"; changes apply immediately. */
export function PersonalViewPanel({
  settings,
  calendarId,
}: {
  settings: ViewSettingsState;
  /** Selected calendar, to point out when its own view takes precedence */
  calendarId?: string | null;
}) {
  const t = useTranslations();
  const { calendars } = useCalendars();
  const calendar = calendarId ? calendars.find((c) => c.id === calendarId) : undefined;
  const { personal, updatePersonal } = settings;

  return (
    <PanelBody>
      <div className="flex flex-col gap-5">
        {calendar?.viewSettings && (
          <InfoNote icon={Info}>
            {t("view.overriddenByCalendar", { calendar: calendar.name })}
          </InfoNote>
        )}
        <ViewFields
          value={personal}
          onChange={updatePersonal}
          stampBar={{
            checked: personal.showStampBar,
            onChange: (showStampBar) => updatePersonal({ showStampBar }),
          }}
        />
      </div>
    </PanelBody>
  );
}

/** "Meine Ansicht": the personal view, applied to every calendar without its own view. */
export function ViewSettingsSheet({
  open,
  onOpenChange,
  settings,
  calendarId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ViewSettingsState;
  calendarId?: string | null;
}) {
  const t = useTranslations();
  return (
    <PanelDialog
      bare
      open={open}
      onOpenChange={onOpenChange}
      title={t("view.settingsTitle")}
      description={
        settings.storedInAccount
          ? t("view.settingsDescription")
          : t("view.settingsDescriptionLocal")
      }
    >
      <PersonalViewPanel settings={settings} calendarId={calendarId} />
    </PanelDialog>
  );
}
