"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BaseSheet } from "@/components/ui/base-sheet";
import { Input } from "@/components/ui/input";
import { ColorSwatches, Field, inputClass } from "@/components/form-kit";
import { DEFAULT_COLOR } from "@/lib/constants";

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
  const initialColor = DEFAULT_COLOR;
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
      description={t("calendar.createDescription")}
      showSaveButton
      onSave={handleSave}
      isSaving={isSaving}
      saveDisabled={!name.trim()}
      hasUnsavedChanges={hasChanges()}
    >
      <div className="flex flex-col gap-4">
        <Field label={t("calendar.name")} htmlFor="name">
          <Input
            id="name"
            placeholder={t("form.namePlaceholder", {
              example: t("calendar.name"),
            })}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            autoFocus
          />
        </Field>

        <Field label={t("form.colorLabel")}>
          <ColorSwatches value={selectedColor} onChange={setSelectedColor} allowCustom />
        </Field>
      </div>
    </BaseSheet>
  );
}
