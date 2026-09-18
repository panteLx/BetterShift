"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, ToggleRow, inputClass } from "@/components/form-kit";
import type { CustomFieldDefinition, CustomFieldInputValue } from "@/lib/custom-fields";
import { cn } from "@/lib/utils";

// Radix Select can't carry an empty string as an item value, so an unset optional
// select needs its own sentinel that never collides with a real option id.
const SELECT_EMPTY = "__none__";

interface CustomFieldInputsProps {
  definitions: CustomFieldDefinition[];
  values: Record<string, CustomFieldInputValue>;
  onChange: (next: Record<string, CustomFieldInputValue>) => void;
  disabled?: boolean;
}

export function CustomFieldInputs({
  definitions,
  values,
  onChange,
  disabled = false,
}: CustomFieldInputsProps) {
  const t = useTranslations();
  const idPrefix = useId();

  if (definitions.length === 0) return null;

  const setValue = (key: string, value: CustomFieldInputValue) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      {definitions.map((definition) => {
        const inputId = `${idPrefix}-${definition.id}`;
        const value = values[definition.key] ?? null;
        const optional = !definition.required;

        switch (definition.type) {
          case "checkbox":
            return (
              <ToggleRow
                key={definition.id}
                id={inputId}
                title={definition.label}
                checked={value === true}
                onCheckedChange={(checked) => setValue(definition.key, checked)}
                disabled={disabled}
              />
            );

          case "select": {
            const selected = typeof value === "string" ? value : null;
            return (
              <Field key={definition.id} label={definition.label} htmlFor={inputId} optional={optional}>
                <Select
                  value={selected ?? SELECT_EMPTY}
                  onValueChange={(next) =>
                    setValue(definition.key, next === SELECT_EMPTY ? null : next)
                  }
                  disabled={disabled}
                >
                  <SelectTrigger
                    id={inputId}
                    className="h-10 w-full rounded-[9px] px-3 text-[14px] data-[size=default]:h-10"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {optional && (
                      <SelectItem value={SELECT_EMPTY}>{t("customFields.selectNone")}</SelectItem>
                    )}
                    {(definition.options ?? []).map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            );
          }

          case "date":
            return (
              <Field key={definition.id} label={definition.label} htmlFor={inputId} optional={optional}>
                <Input
                  id={inputId}
                  type="date"
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) =>
                    setValue(definition.key, e.target.value === "" ? null : e.target.value)
                  }
                  disabled={disabled}
                  className={cn(inputClass, "font-mono")}
                />
              </Field>
            );

          case "number":
            return (
              <Field key={definition.id} label={definition.label} htmlFor={inputId} optional={optional}>
                <Input
                  id={inputId}
                  type="number"
                  value={typeof value === "number" ? value : ""}
                  onChange={(e) =>
                    setValue(
                      definition.key,
                      e.target.value === "" ? null : Number(e.target.value)
                    )
                  }
                  disabled={disabled}
                  className={inputClass}
                />
              </Field>
            );

          default:
            return (
              <Field key={definition.id} label={definition.label} htmlFor={inputId} optional={optional}>
                <Input
                  id={inputId}
                  type="text"
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) =>
                    setValue(definition.key, e.target.value === "" ? null : e.target.value)
                  }
                  disabled={disabled}
                  className={inputClass}
                />
              </Field>
            );
        }
      })}
    </div>
  );
}
