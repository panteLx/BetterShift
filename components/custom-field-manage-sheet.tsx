"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { BaseSheet } from "@/components/ui/base-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Field,
  ListRow,
  Pill,
  RowIconButton,
  ToggleRow,
  inputClass,
} from "@/components/form-kit";
import { useCustomFields } from "@/hooks/useCustomFields";
import { useCustomFieldActions } from "@/hooks/useCustomFieldActions";
import { useCustomFieldForm } from "@/hooks/useCustomFieldForm";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { useShifts } from "@/hooks/useShifts";
import { usePresets } from "@/hooks/usePresets";
import { CUSTOM_FIELD_TYPES, type CustomFieldDefinition, type CustomFieldType } from "@/lib/custom-fields";
import { cn } from "@/lib/utils";

interface CustomFieldManageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
}

// Task 8's shift/preset routes attach this at read time (withShiftCustomFields /
// withPresetCustomFields); the ShiftWithCalendar/ShiftPreset types don't declare it yet.
type WithCustomFieldValues = { customFields?: Record<string, unknown> };

function useTypeLabels() {
  const t = useTranslations();
  const labels: Record<CustomFieldType, string> = {
    text: t("customFields.typeText"),
    number: t("customFields.typeNumber"),
    date: t("customFields.typeDate"),
    checkbox: t("customFields.typeCheckbox"),
    select: t("customFields.typeSelect"),
  };
  return labels;
}

function SortableFieldRow({
  definition,
  draggable,
  busy,
  typeLabels,
  onEdit,
  onDelete,
}: {
  definition: CustomFieldDefinition;
  draggable: boolean;
  busy: boolean;
  typeLabels: Record<CustomFieldType, string>;
  onEdit: (definition: CustomFieldDefinition) => void;
  onDelete: (definition: CustomFieldDefinition) => void;
}) {
  const t = useTranslations();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: definition.id, disabled: !draggable });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
      }}
      className={cn("relative", isDragging && "z-10 opacity-60")}
    >
      <ListRow className={cn("gap-2.5 py-2.5 pr-1.5", draggable ? "pl-1.5" : "pl-3.5")}>
        {draggable && (
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={t("presetSheet.dragHandle")}
            className="-my-1 flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-fg-tertiary transition-colors hover:bg-surface-sunken active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-fg-strong">
            {definition.label}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[12px] text-fg-tertiary">{definition.key}</span>
            <Pill>{typeLabels[definition.type]}</Pill>
            {definition.required && <Pill tone="warning">{t("customFields.requiredLabel")}</Pill>}
          </div>
        </div>
        <RowIconButton
          icon={Pencil}
          label={t("preset.edit")}
          onClick={() => onEdit(definition)}
          disabled={busy}
        />
        <RowIconButton
          icon={Trash2}
          tone="danger"
          label={t("presetSheet.delete")}
          onClick={() => onDelete(definition)}
          disabled={busy}
        />
      </ListRow>
    </div>
  );
}

export function CustomFieldManageSheet({
  open,
  onOpenChange,
  calendarId,
}: CustomFieldManageSheetProps) {
  const t = useTranslations();
  const typeLabels = useTypeLabels();
  const permission = useCalendarPermission(calendarId);
  const canManage = permission.can("manageCustomFields");
  const { customFields, isLoading } = useCustomFields(calendarId);
  const { createField, updateField, deleteField, reorderFields } =
    useCustomFieldActions(calendarId);
  const { shifts } = useShifts(calendarId);
  const { presets } = usePresets(calendarId);
  const form = useCustomFieldForm();

  const [showEditor, setShowEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomFieldDefinition | null>(null);
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);

  const ordered = useMemo(() => {
    if (!pendingOrder) return customFields;
    const rank = new Map(pendingOrder.map((id, index) => [id, index]));
    const last = pendingOrder.length;
    return [...customFields].sort((a, b) => (rank.get(a.id) ?? last) - (rank.get(b.id) ?? last));
  }, [customFields, pendingOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const isDirty = showEditor && form.isDirty;

  const closeEditor = () => {
    setShowEditor(false);
    form.reset();
  };

  const startCreate = () => {
    form.startCreate();
    setShowEditor(true);
  };

  const startEdit = (definition: CustomFieldDefinition) => {
    form.startEdit(definition);
    setShowEditor(true);
  };

  const saveOrder = async (nextIds: string[]) => {
    setPendingOrder(nextIds);
    await reorderFields(nextIds);
    setPendingOrder((current) => (current === nextIds ? null : current));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = ordered.map((f) => f.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    void saveOrder(arrayMove(ids, oldIndex, newIndex));
  };

  const hasOptions = form.formData.type !== "select" || form.formData.options.length > 0;
  const canSave =
    !isSaving &&
    form.formData.label.trim() !== "" &&
    !!form.formData.key &&
    hasOptions &&
    (form.isNew || form.isDirty);

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const options = form.formData.type === "select" ? form.formData.options : null;
      if (form.editing) {
        const success = await updateField(form.editing.id, {
          label: form.formData.label.trim(),
          options,
          required: form.formData.required,
          showInCalendar: form.formData.showInCalendar,
        });
        if (success) closeEditor();
      } else {
        const result = await createField({
          key: form.formData.key,
          label: form.formData.label.trim(),
          type: form.formData.type,
          options,
          required: form.formData.required,
          showInCalendar: form.formData.showInCalendar,
        });
        if (result === "ok") closeEditor();
        else if (result === "key-in-use") form.setKeyInUse(true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCounts = useMemo(() => {
    if (!deleteTarget) return { shifts: 0, presets: 0 };
    const key = deleteTarget.key;
    return {
      shifts: shifts.filter((s) => (s as WithCustomFieldValues).customFields?.[key] !== undefined)
        .length,
      presets: presets.filter(
        (p) => (p as WithCustomFieldValues).customFields?.[key] !== undefined
      ).length,
    };
  }, [deleteTarget, shifts, presets]);

  const handleDeleteConfirm = async () => {
    const target = deleteTarget;
    if (!target) return;
    setDeleteTarget(null);
    setDeletingId(target.id);
    try {
      const success = await deleteField(target.id);
      if (success && form.editing?.id === target.id) closeEditor();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <BaseSheet
        open={open}
        onOpenChange={onOpenChange}
        title={t("customFields.title")}
        description={t("customFields.description")}
        hasUnsavedChanges={isDirty}
        footer={
          showEditor ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-10 flex-1 font-semibold"
                onClick={closeEditor}
                disabled={isSaving}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                className="h-10 flex-1 font-semibold"
                onClick={handleSave}
                disabled={!canSave}
              >
                {isSaving ? t("common.saving") : t("common.save")}
              </Button>
            </>
          ) : canManage ? (
            <Button type="button" className="h-10 w-full font-semibold" onClick={startCreate}>
              <Plus className="size-4" />
              {t("customFields.addButton")}
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-4">
          {customFields.length === 0 && !isLoading && (
            <p className="rounded-[11px] border border-dashed border-control px-4 py-5 text-center text-[13px] text-fg-tertiary">
              {t("customFields.empty")}
            </p>
          )}

          {ordered.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={ordered.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {ordered.map((definition) => (
                    <SortableFieldRow
                      key={definition.id}
                      definition={definition}
                      draggable={canManage && ordered.length > 1}
                      busy={deletingId === definition.id}
                      typeLabels={typeLabels}
                      onEdit={startEdit}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {showEditor && (
            <div className="flex flex-col gap-4 border-t border-line pt-4">
              <Field label={t("customFields.labelLabel")} htmlFor="custom-field-label">
                <Input
                  id="custom-field-label"
                  className={inputClass}
                  value={form.formData.label}
                  onChange={(e) => form.setLabel(e.target.value)}
                  disabled={isSaving}
                  autoFocus
                />
              </Field>

              <Field
                label={t("customFields.keyLabel")}
                htmlFor="custom-field-key"
                hint={
                  form.keyInUse ? (
                    <span className="text-danger">{t("customFields.keyInUse")}</span>
                  ) : (
                    t("customFields.keyHint")
                  )
                }
              >
                <Input
                  id="custom-field-key"
                  className={cn(inputClass, "font-mono")}
                  value={form.formData.key}
                  onChange={(e) => form.setKey(e.target.value)}
                  disabled={isSaving || !!form.editing}
                  aria-invalid={form.keyInUse}
                />
              </Field>

              <Field
                label={t("customFields.typeLabel")}
                htmlFor="custom-field-type"
                hint={form.editing ? t("customFields.typeImmutableHint") : undefined}
              >
                <Select
                  value={form.formData.type}
                  onValueChange={(value) => form.setType(value as CustomFieldType)}
                  disabled={!!form.editing || isSaving}
                >
                  <SelectTrigger
                    id="custom-field-type"
                    className="h-10 w-full rounded-[9px] px-3 text-[14px] data-[size=default]:h-10"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOM_FIELD_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {typeLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {form.formData.type === "select" && (
                <Field
                  label={t("customFields.optionsLabel")}
                  hint={
                    form.formData.options.length === 0 ? t("customFields.optionsHint") : undefined
                  }
                >
                  <div className="flex flex-col gap-2">
                    {form.formData.options.map((option, index) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <Input
                          className={inputClass}
                          value={option.label}
                          onChange={(e) => form.setOptionLabel(index, e.target.value)}
                          disabled={isSaving}
                        />
                        <RowIconButton
                          icon={X}
                          label={t("common.delete")}
                          onClick={() => form.removeOption(index)}
                          disabled={isSaving}
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 self-start font-semibold"
                      onClick={form.addOption}
                      disabled={isSaving}
                    >
                      <Plus className="size-4" />
                      {t("customFields.addOption")}
                    </Button>
                  </div>
                </Field>
              )}

              <ToggleRow
                id="custom-field-required"
                title={t("customFields.requiredLabel")}
                description={t("customFields.requiredHint")}
                checked={form.formData.required}
                onCheckedChange={form.setRequired}
                disabled={isSaving}
              />
              <ToggleRow
                id="custom-field-show-in-calendar"
                title={t("customFields.showInCalendarLabel")}
                description={t("customFields.showInCalendarHint")}
                checked={form.formData.showInCalendar}
                onCheckedChange={form.setShowInCalendar}
                disabled={isSaving}
              />
            </div>
          )}
        </div>
      </BaseSheet>

      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={t("presetSheet.delete")}
        description={t("customFields.deleteConfirm", deleteCounts)}
        cancelText={t("common.cancel")}
        confirmText={t("common.delete")}
        confirmVariant="destructive"
      />
    </>
  );
}
