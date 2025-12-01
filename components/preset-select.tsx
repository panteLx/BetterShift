import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShiftPreset } from "@/lib/db/schema";

interface PresetSelectProps {
  presets: ShiftPreset[];
  onPresetSelect: (preset: ShiftPreset) => void;
}

export function PresetSelect({ presets, onPresetSelect }: PresetSelectProps) {
  const t = useTranslations();

  if (presets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2.5 p-4 bg-primary/5 border border-primary/20 rounded-xl">
      <Label className="text-sm font-medium flex items-center gap-2">
        <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
        {t("shift.selectPreset")}
      </Label>
      <Select
        onValueChange={(value) => {
          const preset = presets.find((p) => p.id === value);
          if (preset) onPresetSelect(preset);
        }}
      >
        <SelectTrigger className="h-11 border-primary/30 focus:border-primary/50 focus:ring-primary/20 bg-background/80">
          <SelectValue placeholder={t("shift.none")} />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              {preset.title}{" "}
              {preset.isAllDay
                ? `(${t("shift.allDay")})`
                : `(${preset.startTime} - ${preset.endTime})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
