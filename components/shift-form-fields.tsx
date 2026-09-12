import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckRow,
  ColorSwatches,
  Field,
  inputClass,
  textareaClass,
} from "@/components/form-kit";
import { ShiftFormData } from "@/components/shift-sheet";
import { useAutoFocusRef } from "@/hooks/useAutoFocus";
import { DEFAULT_COLOR } from "@/lib/constants";
import { calculateShiftDuration } from "@/lib/date-utils";
import { formatHours } from "@/lib/shift-display";
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
}: ShiftFormFieldsProps) {
  const t = useTranslations();
  const locale = useLocale();
  const titleRef = useAutoFocusRef<HTMLInputElement>(!readOnly);

  const validTimes =
    !formData.isAllDay &&
    TIME_PATTERN.test(formData.startTime) &&
    TIME_PATTERN.test(formData.endTime);
  const duration = validTimes
    ? formatHours(calculateShiftDuration(formData.startTime, formData.endTime), locale)
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
