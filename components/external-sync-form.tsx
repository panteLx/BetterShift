"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { ChevronDown, FileUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ColorSwatches, Field, inputClass, SectionLabel } from "@/components/form-kit";
import { SegmentedControl } from "@/components/segmented-control";
import { formatSyncInterval } from "@/components/external-sync-list";
import {
  AUTO_SYNC_INTERVALS,
  ExternalSyncFormValues,
  SyncDisplayMode,
  SyncImportType,
} from "@/hooks/useExternalSyncForm";
import { cn } from "@/lib/utils";

interface ExternalSyncFormProps {
  values: ExternalSyncFormValues;
  setField: <K extends keyof ExternalSyncFormValues>(
    key: K,
    value: ExternalSyncFormValues[K]
  ) => void;
  mode: "add" | "edit";
  /** Uploaded file: no address and no auto-sync */
  isOneTimeImport?: boolean;
  disabled?: boolean;
}

export function ExternalSyncForm({
  values,
  setField,
  mode,
  isOneTimeImport = false,
  disabled = false,
}: ExternalSyncFormProps) {
  const t = useTranslations();
  const id = useId();
  const adding = mode === "add";
  const fileImport = adding ? values.importType === "file" : isOneTimeImport;

  return (
    <div className="flex flex-col gap-4">
      <Field label={t("common.labels.name")} htmlFor={`${id}-name`}>
        <Input
          id={`${id}-name`}
          className={inputClass}
          placeholder={t("form.namePlaceholder", { example: t("externalSync.syncTypeCustom") })}
          value={values.name}
          onChange={(e) => setField("name", e.target.value)}
          disabled={disabled}
        />
      </Field>

      {adding && (
        <Field
          label={t("externalSync.importMethod")}
          hint={
            fileImport
              ? t("externalSync.importMethodFileHint")
              : t("externalSync.importMethodUrlHint")
          }
        >
          <SegmentedControl<SyncImportType>
            label={t("externalSync.importMethod")}
            value={values.importType}
            onChange={(next) => {
              setField("importType", next);
              setField("url", "");
              setField("file", null);
            }}
            options={[
              { value: "url", label: t("syncSheet.sourceUrl") },
              { value: "file", label: t("syncSheet.sourceFile") },
            ]}
          />
        </Field>
      )}

      {adding && fileImport ? (
        <Field label={t("externalSync.fileLabel")}>
          <label
            className={cn(
              "flex h-10 cursor-pointer items-center gap-2.5 rounded-[9px] border border-dashed px-3 text-[13px] transition-colors focus-within:ring-[3px] focus-within:ring-ring/50 hover:bg-surface-panel",
              values.file ? "border-brand text-fg-strong" : "border-control text-fg-secondary"
            )}
          >
            <FileUp className="size-4 shrink-0" />
            <span className={cn("min-w-0 flex-1 truncate", values.file && "font-mono text-[12.5px]")}>
              {values.file ? values.file.name : t("syncSheet.chooseFile")}
            </span>
            <input
              type="file"
              accept=".ics,.ical"
              className="sr-only"
              disabled={disabled}
              value=""
              onChange={(e) => setField("file", e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>
      ) : (
        !fileImport && (
          <Field
            label={t("syncSheet.urlLabel")}
            htmlFor={`${id}-url`}
            hint={adding ? t("externalSync.urlHintCustom") : undefined}
          >
            <Input
              id={`${id}-url`}
              className={cn(
                inputClass,
                "font-mono text-[12.5px]",
                !adding && "cursor-default bg-surface-panel text-fg-secondary"
              )}
              placeholder={t("form.urlPlaceholder")}
              value={values.url}
              onChange={(e) => setField("url", e.target.value)}
              readOnly={!adding}
              disabled={disabled}
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
        )
      )}

      <Field label={t("syncSheet.colorLabel")}>
        <ColorSwatches
          value={values.color}
          onChange={(color) => setField("color", color)}
          allowCustom
          disabled={disabled}
        />
      </Field>

      <Field label={t("syncSheet.displayLabel")}>
        <SegmentedControl<SyncDisplayMode>
          label={t("syncSheet.displayLabel")}
          value={values.displayMode}
          onChange={(next) => setField("displayMode", next)}
          options={[
            { value: "minimal", label: t("syncSheet.displayMinimal") },
            { value: "normal", label: t("syncSheet.displayNormal") },
          ]}
        />
      </Field>

      {!fileImport && (
        <IntervalSlider
          value={values.autoSyncInterval}
          onChange={(minutes) => setField("autoSyncInterval", minutes)}
          disabled={disabled}
        />
      )}

      <div className="flex flex-col gap-[9px]">
        <CheckboxRow
          id={`${id}-hidden`}
          label={t("syncSheet.hideShifts")}
          checked={values.isHidden}
          onCheckedChange={(checked) => setField("isHidden", checked)}
          disabled={disabled}
        />
        {/* Hidden shifts never count, so the stats option is implied and locked. */}
        <CheckboxRow
          id={`${id}-stats`}
          label={t("syncSheet.excludeFromStats")}
          checked={values.isHidden || values.hideFromStats}
          onCheckedChange={(checked) => setField("hideFromStats", checked)}
          disabled={disabled || values.isHidden}
        />
      </div>

      {adding && !fileImport && <UrlHints />}
    </div>
  );
}

function IntervalSlider({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const index = Math.max(0, AUTO_SYNC_INTERVALS.indexOf(value));
  const valueText =
    value === 0
      ? t("externalSync.autoSyncManual")
      : t("syncSheet.intervalValue", { interval: formatSyncInterval(value) });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="flex-1 text-[13px] font-semibold text-fg-body">
          {t("syncSheet.autoSyncLabel")}
        </span>
        <span className="font-mono text-[12.5px] font-medium text-fg-strong">{valueText}</span>
      </div>
      <SliderPrimitive.Root
        value={[index]}
        onValueChange={([next]) => onChange(AUTO_SYNC_INTERVALS[next])}
        max={AUTO_SYNC_INTERVALS.length - 1}
        step={1}
        disabled={disabled}
        className="relative flex h-5 w-full touch-none select-none items-center data-[disabled]:opacity-50"
      >
        <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-sunken">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-brand" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={t("syncSheet.autoSyncLabel")}
          aria-valuetext={valueText}
          className="block size-4 rounded-full border-2 border-brand bg-surface-card outline-none transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </SliderPrimitive.Root>
      <div className="flex justify-between text-[11.5px] text-fg-tertiary">
        <span>{t("externalSync.autoSyncManual")}</span>
        <span>{t("externalSync.autoSync24hShort")}</span>
      </div>
    </div>
  );
}

function CheckboxRow({
  id,
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-[9px]">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        disabled={disabled}
        className="size-[17px] rounded-[5px] border-[1.5px] border-control shadow-none data-[state=checked]:border-brand data-[state=checked]:bg-brand dark:data-[state=checked]:bg-brand"
      />
      <label
        htmlFor={id}
        className={cn(
          "text-[13.5px] text-fg-body",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        )}
      >
        {label}
      </label>
    </div>
  );
}

function UrlHints() {
  const t = useTranslations();
  const hints = [
    { title: t("externalSync.syncTypeICloud"), body: t("externalSync.hintICloud") },
    { title: t("externalSync.syncTypeGoogle"), body: t("externalSync.hintGoogle") },
    { title: t("externalSync.customCalendar"), body: t("externalSync.hintCustom") },
  ];

  return (
    <div className="pt-1">
      <SectionLabel>{t("externalSync.hintsTitle")}</SectionLabel>
      <p className="mb-2 text-[12px] text-fg-tertiary">{t("externalSync.hintsDescription")}</p>
      <div className="overflow-hidden rounded-[11px] border border-line bg-surface-card">
        {hints.map((hint) => (
          <details key={hint.title} className="group border-b border-line-subtle last:border-b-0">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-[13.5px] font-medium text-fg-strong transition-colors hover:bg-surface-panel [&::-webkit-details-marker]:hidden">
              {hint.title}
              <ChevronDown className="size-4 text-fg-tertiary transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-3.5 pb-3 text-[12.5px] leading-relaxed text-fg-secondary">{hint.body}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
