import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import {
  CheckRow,
  ColorSwatches,
  Field,
  inputClass,
  textareaClass,
} from "@/components/form-kit";
import { ShiftFormData } from "@/components/shift-sheet";
import { CustomFieldInputs } from "@/components/custom-field-inputs";
import { useAutoFocusRef } from "@/hooks/useAutoFocus";
import { useCustomFields } from "@/hooks/useCustomFields";
import { DEFAULT_COLOR } from "@/lib/constants";
import { formatHours } from "@/lib/shift-display";
import { sumRangeDurations, suggestNextTimeRange, validateTimeRanges, toTimeRanges } from "@/lib/time-ranges";
import { cn } from "@/lib/utils";

interface ShiftFormFieldsProps {
  formData: ShiftFormData;
  onFormDataChange: (data: ShiftFormData) => void;
  saveAsPreset: boolean;
  onSaveAsPresetChange: (value: boolean) => void;
  presetName: string;
  onPresetNameChange: (value: string) => void;
  isEditing: boolean;
  readOnly?: boolean;
  splitShiftsEnabled?: boolean;
  calendarId?: string;
  /** Externally synced shifts show their custom field values but cannot edit them. */
  syncedFromExternal?: boolean;
}

const TIME_PATTERN = /^\d{2}:\d{2}$/;

export function ShiftFormFields({
  formData,
  onFormDataChange,
  saveAsPreset,
  onSaveAsPresetChange,
  presetName,
  onPresetNameChange,
  isEditing,
  readOnly = false,
  splitShiftsEnabled = false,
  calendarId,
  syncedFromExternal = false,
}: ShiftFormFieldsProps) {
  const t = useTranslations();
  const locale = useLocale();
  const titleRef = useAutoFocusRef<HTMLInputElement>(!readOnly);
  const { customFields } = useCustomFields(calendarId ?? null);
  const customFieldsDisabled = readOnly || syncedFromExternal;

  const validTimes =
    !formData.isAllDay &&
    TIME_PATTERN.test(formData.startTime) &&
    TIME_PATTERN.test(formData.endTime);
  // formatHours takes minutes (see other call sites); sumRangeDurations already
  // returns minutes, unlike the old calculateShiftDuration(...) call this replaced.
  const duration = validTimes
    ? formatHours(sumRangeDurations(toTimeRanges(formData)), locale)
    : "–";
  const timesDisabled = readOnly || formData.isAllDay;

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      {/* Creating uses the day shown in the header; editing may move the shift */}
      {isEditing && (
        <Field label={t("shift.date")} htmlFor="date">
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => onFormDataChange({ ...formData, date: e.target.value })}
            disabled={readOnly}
            className={cn(inputClass, "font-mono")}
          />
        </Field>
      )}

      <div className="flex flex-col gap-2.5 lg:gap-3">
        <div className="flex gap-2.5">
          <Field label={t("shiftSheet.start")} htmlFor="startTime" className="flex-1">
            <Input
              id="startTime"
              type="time"
              value={formData.startTime}
              onChange={(e) => onFormDataChange({ ...formData, startTime: e.target.value })}
              disabled={timesDisabled}
              className={cn(inputClass, "font-mono")}
            />
          </Field>
          <Field label={t("shiftSheet.end")} htmlFor="endTime" className="flex-1">
            <Input
              id="endTime"
              type="time"
              value={formData.endTime}
              onChange={(e) => onFormDataChange({ ...formData, endTime: e.target.value })}
              disabled={timesDisabled}
              className={cn(inputClass, "font-mono")}
            />
          </Field>
          <Field label={t("shiftSheet.duration")} className="w-[74px] shrink-0">
            <output
              aria-live="polite"
              className="flex h-10 items-center justify-center rounded-[9px] bg-surface-sunken font-mono text-[14px] font-medium text-fg-body"
            >
              {duration}
            </output>
          </Field>
        </div>

        {!formData.isAllDay && (formData.segments?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-2">
            {(formData.segments ?? []).map((segment, index) => (
              <div key={index} className="flex items-end gap-2.5">
                <Field label={t("shiftSheet.start")} className="flex-1">
                  <Input
                    type="time"
                    value={segment.startTime}
                    onChange={(e) => {
                      const next = [...(formData.segments ?? [])];
                      next[index] = { ...next[index], startTime: e.target.value };
                      onFormDataChange({ ...formData, segments: next });
                    }}
                    disabled={readOnly}
                    className={cn(inputClass, "font-mono")}
                  />
                </Field>
                <Field label={t("shiftSheet.end")} className="flex-1">
                  <Input
                    type="time"
                    value={segment.endTime}
                    onChange={(e) => {
                      const next = [...(formData.segments ?? [])];
                      next[index] = { ...next[index], endTime: e.target.value };
                      onFormDataChange({ ...formData, segments: next });
                    }}
                    disabled={readOnly}
                    className={cn(inputClass, "font-mono")}
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="mb-[1px] shrink-0"
                  aria-label={t("timeRanges.remove")}
                  disabled={readOnly}
                  onClick={() => {
                    const next = (formData.segments ?? []).filter((_, i) => i !== index);
                    onFormDataChange({ ...formData, segments: next });
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {!formData.isAllDay && splitShiftsEnabled && !readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              onFormDataChange({
                ...formData,
                segments: [
                  ...(formData.segments ?? []),
                  suggestNextTimeRange(toTimeRanges(formData)),
                ],
              })
            }
          >
            <Plus className="size-4" />
            {t("timeRanges.add")}
          </Button>
        )}

        {!formData.isAllDay &&
          (() => {
            const error = validateTimeRanges(toTimeRanges(formData));
            return error ? (
              <p className="text-[13px] text-danger-body">{t(`timeRanges.errors.${error}`)}</p>
            ) : null;
          })()}

        <CheckRow
          id="allDay"
          label={t("shiftSheet.allDay")}
          checked={!!formData.isAllDay}
          onCheckedChange={(checked) => onFormDataChange({ ...formData, isAllDay: checked })}
          disabled={readOnly}
        />
      </div>

      <Field label={t("shift.titleLabel")} htmlFor="title">
        <Input
          id="title"
          placeholder={t("shift.titlePlaceholder")}
          value={formData.title}
          onChange={(e) => onFormDataChange({ ...formData, title: e.target.value })}
          disabled={readOnly}
          className={inputClass}
          ref={titleRef}
        />
      </Field>

      <Field label={t("form.colorLabel")}>
        <ColorSwatches
          value={formData.color || DEFAULT_COLOR}
          onChange={(color) => onFormDataChange({ ...formData, color })}
          allowCustom
          disabled={readOnly}
        />
      </Field>

      <Field label={t("calendarView.note")} htmlFor="notes" optional>
        <Textarea
          id="notes"
          placeholder={t("form.notesPlaceholder")}
          value={formData.notes}
          onChange={(e) => onFormDataChange({ ...formData, notes: e.target.value })}
          disabled={readOnly}
          rows={3}
          className={cn(textareaClass, "min-h-16")}
        />
      </Field>

      <CustomFieldInputs
        definitions={customFields}
        values={formData.customFields ?? {}}
        onChange={(customFields) => onFormDataChange({ ...formData, customFields })}
        disabled={customFieldsDisabled}
      />

      {!isEditing && !readOnly && (
        <div className="flex flex-col gap-2.5 lg:gap-3">
          <CheckRow
            id="savePreset"
            label={t("preset.saveAsPreset")}
            checked={saveAsPreset}
            onCheckedChange={onSaveAsPresetChange}
          />
          {saveAsPreset && (
            <Field label={t("preset.presetName")} htmlFor="presetName">
              <Input
                id="presetName"
                placeholder={t("preset.presetNamePlaceholder")}
                value={presetName}
                onChange={(e) => onPresetNameChange(e.target.value)}
                className={inputClass}
              />
            </Field>
          )}
        </div>
      )}
    </div>
  );
}
