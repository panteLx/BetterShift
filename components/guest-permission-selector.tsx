"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, Eye, Edit } from "lucide-react";

interface GuestPermissionSelectorProps {
  value: "none" | "read" | "write";
  onChange: (value: "none" | "read" | "write") => void;
  idPrefix?: string;
}

export function GuestPermissionSelector({
  value,
  onChange,
  idPrefix = "guest",
}: GuestPermissionSelectorProps) {
  const t = useTranslations();

  return (
    <div className="space-y-3">
      <RadioGroup
        value={value}
        onValueChange={(val) => onChange(val as "none" | "read" | "write")}
        className="space-y-3"
      >
        {/* No Access */}
        <div className="group relative">
          <Label
            htmlFor={`${idPrefix}-none`}
            className="flex items-start gap-3 p-4 rounded-xl border-2 border-border/50 hover:border-border hover:bg-muted/50 transition-all cursor-pointer"
          >
            <RadioGroupItem
              value="none"
              id={`${idPrefix}-none`}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                <span className="font-semibold text-sm">
                  {t("common.labels.permissions.none")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                {t("share.publicPermissionNoneDesc")}
              </p>
            </div>
          </Label>
        </div>

        {/* Read Only */}
        <div className="group relative">
          <Label
            htmlFor={`${idPrefix}-read`}
            className="flex items-start gap-3 p-4 rounded-xl border-2 border-border/50 hover:border-border hover:bg-muted/50 transition-all cursor-pointer"
          >
            <RadioGroupItem
              value="read"
              id={`${idPrefix}-read`}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="font-semibold text-sm">
                  {t("common.labels.permissions.read")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                {t("share.publicPermissionReadDesc")}
              </p>
            </div>
          </Label>
        </div>

        {/* Read & Write */}
        <div className="group relative">
          <Label
            htmlFor={`${idPrefix}-write`}
            className="flex items-start gap-3 p-4 rounded-xl border-2 border-border/50 hover:border-border hover:bg-muted/50 transition-all cursor-pointer"
          >
            <RadioGroupItem
              value="write"
              id={`${idPrefix}-write`}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Edit className="h-4 w-4 text-green-500 shrink-0" />
                <span className="font-semibold text-sm">
                  {t("common.labels.permissions.write")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                {t("share.publicPermissionWriteDesc")}
              </p>
            </div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
