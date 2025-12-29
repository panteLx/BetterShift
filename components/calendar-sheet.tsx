"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BaseSheet } from "@/components/ui/base-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "@/components/ui/color-picker";
import { PRESET_COLORS } from "@/lib/constants";

interface CalendarSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, color: string) => void | Promise<void>;
}

export function CalendarSheet({
  open,
  onOpenChange,
  onSubmit,
}: CalendarSheetProps) {
  const t = useTranslations();
  const initialColor = PRESET_COLORS[0].value;
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(initialColor);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = () => {
    return name.trim() !== "" || selectedColor !== initialColor;
  };

  const resetForm = () => {
    setName("");
    setSelectedColor(initialColor);
  };

  const handleSave = async () => {
    if (!name.trim() || isSaving) return;

    setIsSaving(true);
    try {
      await onSubmit(name.trim(), selectedColor);

      // Reset form on success
      resetForm();
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BaseSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("calendar.create")}
      description={t("calendar.createDescription", {
        default: "Create a new calendar to organize your shifts",
      })}
      showSaveButton
      onSave={handleSave}
      isSaving={isSaving}
      saveDisabled={!name.trim()}
      hasUnsavedChanges={hasChanges()}
      maxWidth="md"
    >
      <div className="space-y-6">
        <div className="space-y-2.5">
          <Label
            htmlFor="name"
            className="text-sm font-medium flex items-center gap-2"
          >
            <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
            {t("calendar.name")}
          </Label>
          <Input
            id="name"
            placeholder={t("form.namePlaceholder", {
              example: t("calendar.name"),
            })}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 border-border/50 focus:border-primary/50 focus:ring-primary/20 bg-background/50 backdrop-blur-sm transition-all"
            autoFocus
          />
        </div>

        <ColorPicker
          color={selectedColor}
          onChange={setSelectedColor}
          label={t("form.colorLabel")}
          presetColors={PRESET_COLORS}
        />
      </div>
    </BaseSheet>
  );
}
