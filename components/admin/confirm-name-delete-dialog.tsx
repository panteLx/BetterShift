"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelDialog } from "@/components/panel-dialog";
import { Field, inputClass } from "@/components/form-kit";
import { StatusBanner } from "@/components/status-banner";
import { cn } from "@/lib/utils";

interface ConfirmNameDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Typed back by the admin before the delete button unlocks */
  name: string;
  idPrefix: string;
  title: string;
  description: string;
  warning: string;
  understoodLabel: string;
  confirmationLabel: string;
  confirmationHint: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}

/** Irreversible admin delete: tick "understood" and type the name to unlock. */
export function ConfirmNameDeleteDialog({
  open,
  onOpenChange,
  name,
  idPrefix,
  title,
  description,
  warning,
  understoodLabel,
  confirmationLabel,
  confirmationHint,
  confirmLabel,
  onConfirm,
}: ConfirmNameDeleteDialogProps) {
  const t = useTranslations();
  const [confirmation, setConfirmation] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isConfirmed = confirmation === name && understood;

  const reset = () => {
    setConfirmation("");
    setUnderstood(false);
  };

  const handleConfirm = async () => {
    if (!isConfirmed) return;

    setIsSubmitting(true);
    try {
      await onConfirm();
      reset();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      width="sm"
      bodyClassName="flex flex-col gap-4"
      footer={
        <>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="h-10 flex-1 font-semibold"
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || isSubmitting}
            className="h-10 flex-1 font-semibold"
          >
            {isSubmitting ? t("common.saving") : confirmLabel}
          </Button>
        </>
      }
    >
      <StatusBanner tone="danger" icon={TriangleAlert}>
        {warning}
      </StatusBanner>

      <div className="flex items-start gap-3">
        <Checkbox
          id={`${idPrefix}-understood`}
          checked={understood}
          onCheckedChange={(checked) => setUnderstood(checked === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor={`${idPrefix}-understood`}
          className="cursor-pointer text-[13.5px] font-medium leading-snug text-fg-body"
        >
          {understoodLabel}
        </Label>
      </div>

      <Field
        label={confirmationLabel}
        htmlFor={`${idPrefix}-confirmation`}
        hint={confirmationHint}
      >
        <Input
          id={`${idPrefix}-confirmation`}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={name}
          autoComplete="off"
          className={cn(inputClass, "font-mono")}
        />
      </Field>
    </PanelDialog>
  );
}
