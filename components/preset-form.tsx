"use client";

import { Ref, useId } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { CheckRow, ColorSwatches, Field, inputClass } from "@/components/form-kit";
import { ShiftPreset } from "@/lib/db/schema";
import { DEFAULT_COLOR } from "@/lib/constants";
import type { PresetFormData } from "@/hooks/usePresets";
import { cn } from "@/lib/utils";

export const EMPTY_PRESET_FORM: PresetFormData = {
  title: "",
  startTime: "09:00",
  endTime: "17:00",
  color: DEFAULT_COLOR,
  notes: "",
  isSecondary: false,
  isAllDay: false,
  hideFromStats: false,
};

export function presetToFormData(preset: ShiftPreset): PresetFormData {
  return {
    title: preset.title,
    startTime: preset.startTime,
    endTime: preset.endTime,
    color: preset.color,
    notes: preset.notes || "",
    isSecondary: preset.isSecondary || false,
    isAllDay: preset.isAllDay || false,
    hideFromStats: preset.hideFromStats || false,
  };
}

export function samePresetForm(a: PresetFormData, b: PresetFormData): boolean {
  return (Object.keys(a) as (keyof PresetFormData)[]).every((key) => a[key] === b[key]);
}


interface PresetFormCardProps {
  formId: string;
  editing: boolean;
  value: PresetFormData;
  onChange: (patch: Partial<PresetFormData>) => void;
  onSubmit: () => void;
  disabled?: boolean;
  cardRef?: Ref<HTMLFormElement>;
  titleRef?: Ref<HTMLInputElement>;
}

/** "Neue Vorlage" card; the same card edits an existing preset. */
export function PresetFormCard({
  formId,
  editing,
  value,
  onChange,
  onSubmit,
  disabled,
  cardRef,
  titleRef,
}: PresetFormCardProps) {
  const t = useTranslations();
  const id = useId();
  const fieldClass = cn(inputClass, "bg-surface-card");

  return (
    <form
      id={formId}
      ref={cardRef}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex scroll-mt-4 flex-col gap-3 rounded-[11px] border border-line bg-surface-panel p-4"
    >
      <div className="text-[14px] font-semibold text-fg-strong">
        {editing ? t("preset.edit") : t("presetSheet.newPreset")}
      </div>

      <Field label={t("shift.titleLabel")} htmlFor={`${id}-title`}>
        <Input
          id={`${id}-title`}
          ref={titleRef}
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={t("presetSheet.titlePlaceholder")}
          className={fieldClass}
          disabled={disabled}
        />
      </Field>

      {!value.isAllDay && (
        <div className="grid grid-cols-2 gap-2.5">
          <Field label={t("presetSheet.start")} htmlFor={`${id}-start`}>
            <Input
              id={`${id}-start`}
              type="time"
              value={value.startTime}
              onChange={(e) => onChange({ startTime: e.target.value })}
              className={cn(fieldClass, "font-mono")}
              disabled={disabled}
            />
          </Field>
          <Field label={t("presetSheet.end")} htmlFor={`${id}-end`}>
            <Input
              id={`${id}-end`}
              type="time"
              value={value.endTime}
              onChange={(e) => onChange({ endTime: e.target.value })}
              className={cn(fieldClass, "font-mono")}
              disabled={disabled}
            />
          </Field>
        </div>
      )}

      <ColorSwatches
        value={value.color}
        onChange={(color) => onChange({ color })}
        allowCustom
        disabled={disabled}
      />

      <Field label={t("form.notesLabel")} htmlFor={`${id}-notes`}>
        <Input
          id={`${id}-notes`}
          value={value.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder={t("form.notesPlaceholder")}
          className={fieldClass}
          disabled={disabled}
        />
      </Field>

      <div className="flex flex-col gap-2.5 pt-0.5">
        <CheckRow
          id={`${id}-allday`}
          checked={value.isAllDay}
          onCheckedChange={(isAllDay) => onChange({ isAllDay })}
          disabled={disabled}
        >
          {t("presetSheet.allDay")}
        </CheckRow>
        <CheckRow
          id={`${id}-secondary`}
          checked={value.isSecondary}
          onCheckedChange={(isSecondary) => onChange({ isSecondary })}
          disabled={disabled}
          hint={t("presetSheet.markAsSecondaryHint")}
        >
          {t("presetSheet.markAsSecondary")}
        </CheckRow>
        <CheckRow
          id={`${id}-stats`}
          checked={value.hideFromStats}
          onCheckedChange={(hideFromStats) => onChange({ hideFromStats })}
          disabled={disabled}
          hint={t("presetSheet.hideFromStatsHint")}
        >
          {t("preset.hideFromStats")}
        </CheckRow>
      </div>
    </form>
  );
}
