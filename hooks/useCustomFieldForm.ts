import { useState } from "react";
import {
  normalizeKey,
  type CustomFieldDefinition,
  type CustomFieldOption,
  type CustomFieldType,
} from "@/lib/custom-fields";

export interface CustomFieldFormData {
  key: string;
  label: string;
  type: CustomFieldType;
  options: CustomFieldOption[];
  required: boolean;
  showInCalendar: boolean;
}

const EMPTY_FORM: CustomFieldFormData = {
  key: "",
  label: "",
  type: "text",
  options: [],
  required: false,
  showInCalendar: false,
};

function definitionToForm(definition: CustomFieldDefinition): CustomFieldFormData {
  return {
    key: definition.key,
    label: definition.label,
    type: definition.type,
    options: definition.options ?? [],
    required: definition.required,
    showInCalendar: definition.showInCalendar,
  };
}

function sameForm(a: CustomFieldFormData, b: CustomFieldFormData): boolean {
  return (
    a.key === b.key &&
    a.label === b.label &&
    a.type === b.type &&
    a.required === b.required &&
    a.showInCalendar === b.showInCalendar &&
    JSON.stringify(a.options) === JSON.stringify(b.options)
  );
}

// Not derived from the label (which can be edited freely afterwards): stable and
// always pattern-valid, unlike a raw generateTempId() which may start with a digit.
function generateOptionId(): string {
  return `opt_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Holds the field definition being created or edited in the catalog sheet.
 * Follows hooks/useShiftForm.ts's shape: form state plus the transforms the
 * sheet needs, kept out of the component itself.
 */
export function useCustomFieldForm() {
  const [editing, setEditing] = useState<CustomFieldDefinition | null>(null);
  const [formData, setFormData] = useState<CustomFieldFormData>(EMPTY_FORM);
  const [baseline, setBaseline] = useState<CustomFieldFormData>(EMPTY_FORM);
  const [keyEditedByUser, setKeyEditedByUser] = useState(false);
  const [keyInUse, setKeyInUse] = useState(false);

  const isNew = editing === null;
  const isDirty = !sameForm(formData, baseline);

  const startCreate = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setBaseline(EMPTY_FORM);
    setKeyEditedByUser(false);
    setKeyInUse(false);
  };

  const startEdit = (definition: CustomFieldDefinition) => {
    const data = definitionToForm(definition);
    setEditing(definition);
    setFormData(data);
    setBaseline(data);
    setKeyEditedByUser(true); // the key input is disabled once a definition exists anyway
    setKeyInUse(false);
  };

  const reset = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setBaseline(EMPTY_FORM);
    setKeyEditedByUser(false);
    setKeyInUse(false);
  };

  const setLabel = (label: string) => {
    setFormData((current) => ({
      ...current,
      label,
      // Auto-derive the key from the label until the user types one themselves.
      key: isNew && !keyEditedByUser ? normalizeKey(label) ?? "" : current.key,
    }));
    setKeyInUse(false);
  };

  const setKey = (key: string) => {
    setKeyEditedByUser(true);
    setFormData((current) => ({ ...current, key }));
    setKeyInUse(false);
  };

  const setType = (type: CustomFieldType) => {
    setFormData((current) => ({
      ...current,
      type,
      options: type === "select" ? current.options : [],
    }));
  };

  const setRequired = (required: boolean) =>
    setFormData((current) => ({ ...current, required }));

  const setShowInCalendar = (showInCalendar: boolean) =>
    setFormData((current) => ({ ...current, showInCalendar }));

  const addOption = () =>
    setFormData((current) => ({
      ...current,
      options: [...current.options, { id: generateOptionId(), label: "" }],
    }));

  const setOptionLabel = (index: number, label: string) =>
    setFormData((current) => ({
      ...current,
      options: current.options.map((option, i) => (i === index ? { ...option, label } : option)),
    }));

  const removeOption = (index: number) =>
    setFormData((current) => ({
      ...current,
      options: current.options.filter((_, i) => i !== index),
    }));

  return {
    editing,
    isNew,
    formData,
    isDirty,
    keyInUse,
    setKeyInUse,
    startCreate,
    startEdit,
    reset,
    setLabel,
    setKey,
    setType,
    setRequired,
    setShowInCalendar,
    addOption,
    setOptionLabel,
    removeOption,
  };
}
