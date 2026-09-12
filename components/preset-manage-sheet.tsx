"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PanelBody, PanelDialog, PanelFooter } from "@/components/panel-dialog";
import { ReadOnlyBanner } from "@/components/read-only-banner";
import { PresetSection } from "@/components/preset-list";
import {
  EMPTY_PRESET_FORM,
  PresetFormCard,
  presetToFormData,
  samePresetForm,
} from "@/components/preset-form";
import { ShiftPreset } from "@/lib/db/schema";
import { usePresets, type PresetFormData } from "@/hooks/usePresets";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { useReportDirty } from "@/hooks/useDirtyState";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";

interface PresetsPanelProps {
  calendarId: string;
  onClose: () => void;
  readOnly?: boolean;
  /** Called after every successful mutation, for callers holding their own copy of the presets. */
  onPresetsChange?: () => void;
  /** Lets the surrounding frame guard its own close button against unsaved form input. */
  onDirtyChange?: (dirty: boolean) => void;
}

export function PresetsPanel({
  calendarId,
  onClose,
  readOnly = false,
  onPresetsChange,
  onDirtyChange,
}: PresetsPanelProps) {
  const t = useTranslations();
  const permission = useCalendarPermission(calendarId);
  const desktop = useMediaQuery(DESKTOP_QUERY, false);
  const isReadOnly = readOnly || !permission.canEdit;
  const { presets, loading, createPreset, updatePreset, deletePreset, reorderPresets } =
    usePresets(calendarId);

  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const [editingPreset, setEditingPreset] = useState<ShiftPreset | null>(null);
  const [formData, setFormData] = useState<PresetFormData>(EMPTY_PRESET_FORM);
  const [baseline, setBaseline] = useState<PresetFormData>(EMPTY_PRESET_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShiftPreset | null>(null);
  const [pendingDiscard, setPendingDiscard] = useState<(() => void) | null>(null);
  // Holds the dropped order until the reorder request settles, so rows don't snap back.
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);

  const isDirty = !isReadOnly && !samePresetForm(formData, baseline);
  const canSave = !isSaving && formData.title.trim() !== "" && (!editingPreset || isDirty);

  useReportDirty(isDirty, onDirtyChange);

  const ordered = useMemo(() => {
    if (!pendingOrder) return presets;
    const rank = new Map(pendingOrder.map((id, index) => [id, index]));
    const last = pendingOrder.length;
    return [...presets].sort((a, b) => (rank.get(a.id) ?? last) - (rank.get(b.id) ?? last));
  }, [presets, pendingOrder]);
  const primary = ordered.filter((p) => !p.isSecondary);
  const secondary = ordered.filter((p) => p.isSecondary);

  const resetForm = () => {
    setEditingPreset(null);
    setFormData(EMPTY_PRESET_FORM);
    setBaseline(EMPTY_PRESET_FORM);
  };

  // Runs the action directly, or after the user agreed to drop unsaved input.
  const guardDiscard = (action: () => void) => {
    if (isDirty) setPendingDiscard(() => action);
    else action();
  };

  const saveOrder = async (next: ShiftPreset[]) => {
    const ids = next.map((p) => p.id);
    setPendingOrder(ids);
    const success = await reorderPresets(ids.map((id, order) => ({ id, order })));
    setPendingOrder((current) => (current === ids ? null : current));
    if (success) onPresetsChange?.();
  };

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const success = editingPreset
        ? await updatePreset(editingPreset.id, formData)
        : await createPreset(formData);
      if (success) {
        resetForm();
        onPresetsChange?.();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    const target = deleteTarget;
    if (!target) return;
    setDeleteTarget(null);
    setDeletingId(target.id);
    try {
      const success = await deletePreset(target.id);
      if (success) {
        if (editingPreset?.id === target.id) resetForm();
        onPresetsChange?.();
      }
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (preset: ShiftPreset) => {
    if (editingPreset?.id === preset.id) return;
    guardDiscard(() => {
      const data = presetToFormData(preset);
      setEditingPreset(preset);
      setFormData(data);
      setBaseline(data);
      requestAnimationFrame(() => {
        formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        // Focusing on a phone would pop the keyboard over the form
        if (desktop) titleRef.current?.focus({ preventScroll: true });
      });
    });
  };

  const handleCancel = () => {
    if (editingPreset) resetForm();
    else guardDiscard(onClose);
  };

  const rowActions = {
    readOnly: isReadOnly,
    editingId: editingPreset?.id ?? null,
    deletingId,
    onEdit: startEdit,
    onDelete: setDeleteTarget,
  };

  return (
    <>
      <PanelBody className="flex flex-col gap-4">
        {isReadOnly && <ReadOnlyBanner message={t("guest.cannotEdit")} />}

        {presets.length === 0 &&
          (loading ? (
            <div className="flex justify-center py-6 text-fg-tertiary">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <p className="rounded-[11px] border border-dashed border-control px-4 py-5 text-center text-[13px] text-fg-tertiary">
              {t("preset.noPresets")}
            </p>
          ))}

        {primary.length > 0 && (
          <PresetSection
            label={t("presetSheet.primary")}
            presets={primary}
            onReorder={(next) => saveOrder([...next, ...secondary])}
            {...rowActions}
          />
        )}
        {secondary.length > 0 && (
          <PresetSection
            label={t("presetSheet.secondarySection")}
            presets={secondary}
            onReorder={(next) => saveOrder([...primary, ...next])}
            {...rowActions}
          />
        )}

        {!isReadOnly && (
          <PresetFormCard
            formId={formId}
            editing={!!editingPreset}
            value={formData}
            onChange={(patch) => setFormData((current) => ({ ...current, ...patch }))}
            onSubmit={handleSave}
            disabled={isSaving}
            cardRef={formRef}
            titleRef={titleRef}
          />
        )}
      </PanelBody>

      {!isReadOnly && (
        <PanelFooter>
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1 font-semibold"
            onClick={handleCancel}
            disabled={isSaving}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            className="h-10 flex-1 font-semibold"
            disabled={!canSave}
          >
            {isSaving ? t("common.saving") : t("presetSheet.save")}
          </Button>
        </PanelFooter>
      )}

      <ConfirmationDialog
        open={!!pendingDiscard}
        onOpenChange={(open) => !open && setPendingDiscard(null)}
        onConfirm={() => {
          const action = pendingDiscard;
          setPendingDiscard(null);
          resetForm();
          action?.();
        }}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={t("presetSheet.delete")}
        description={t("preset.deleteConfirm")}
        cancelText={t("common.cancel")}
        confirmText={t("common.delete")}
        confirmVariant="destructive"
      />
    </>
  );
}

interface PresetManageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  onPresetsChange?: () => void;
  readOnly?: boolean;
}

export function PresetManageSheet({
  open,
  onOpenChange,
  calendarId,
  onPresetsChange,
  readOnly = false,
}: PresetManageSheetProps) {
  const t = useTranslations();
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  return (
    <>
      <PanelDialog
        bare
        open={open}
        onOpenChange={(next) => {
          if (next) onOpenChange(true);
          else if (dirty) setConfirmClose(true);
          else onOpenChange(false);
        }}
        title={t("presetSheet.title")}
        description={t("presetSheet.description")}
      >
        <PresetsPanel
          key={calendarId}
          calendarId={calendarId}
          onClose={() => onOpenChange(false)}
          readOnly={readOnly}
          onPresetsChange={onPresetsChange}
          onDirtyChange={setDirty}
        />
      </PanelDialog>

      <ConfirmationDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        onConfirm={() => {
          setConfirmClose(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
