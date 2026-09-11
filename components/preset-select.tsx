import { useTranslations } from "next-intl";
import { Field } from "@/components/form-kit";
import { ShiftPreset } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

interface PresetSelectProps {
  presets: ShiftPreset[];
  /** Id of the applied preset, `null` for a free entry */
  value: string | null;
  onPresetSelect: (preset: ShiftPreset) => void;
  onClear: () => void;
}

const chipClass =
  "flex h-8 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors";

export function PresetSelect({ presets, value, onPresetSelect, onClear }: PresetSelectProps) {
  const t = useTranslations();

  if (presets.length === 0) {
    return null;
  }

  return (
    <Field label={t("preset.preset")}>
      <div role="radiogroup" aria-label={t("preset.preset")} className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const selected = preset.id === value;
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onPresetSelect(preset)}
              className={cn(
                chipClass,
                selected
                  ? "border-brand bg-brand-soft font-semibold text-brand-ink"
                  : "border-line bg-surface-card text-fg-body hover:bg-surface-panel"
              )}
            >
              <span
                className="shift-rail size-[7px] shrink-0 rounded-full"
                style={{ "--shift": preset.color } as React.CSSProperties}
              />
              {preset.title}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          onClick={onClear}
          className={cn(
            chipClass,
            "border-dashed",
            value === null
              ? "border-brand bg-brand-soft font-semibold text-brand-ink"
              : "border-control text-fg-secondary hover:bg-surface-panel"
          )}
        >
          {t("shiftSheet.noPreset")}
        </button>
      </div>
    </Field>
  );
}
